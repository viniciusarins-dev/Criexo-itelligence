"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { aiEvidence, manualEvidence, manualIdeaSchema, normalizeIdeaName } from "@/domain/ideas/idea";
import { buildProductIdeasPrompt } from "@/domain/research/prompt";
import { requireActiveMember } from "@/lib/auth/session";
import type { Json } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formValues, readText, type ActionState } from "@/lib/validation/form-data";
import { readAiConfig } from "@/server/ai/config";
import { generateIdeasWithGemini } from "@/server/ai/gemini";
import { allIdeaNames, parseSnapshot, startOfDayInSaoPaulo } from "@/server/repositories/research";
import { syncResearchStatus } from "@/server/research-status";

const uuid = z.uuid();

function refresh(sessionId?: string | null, ideaId?: string) {
  revalidatePath("/produtos");
  revalidatePath("/pesquisas");
  if (sessionId) revalidatePath(`/pesquisas/${sessionId}`);
  if (ideaId) revalidatePath(`/produtos/${ideaId}`);
}

export async function addManualIdea(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const member = await requireActiveMember();
  const sessionText = readText(formData, "researchSessionId");
  const sessionId = sessionText ? uuid.safeParse(sessionText) : null;
  if (sessionId && !sessionId.success) return { status: "error", message: "Pesquisa inválida.", submittedAt: Date.now() };

  const parsed = manualIdeaSchema.safeParse({
    name: readText(formData, "name"),
    problemStatement: readText(formData, "problemStatement"),
    targetSegment: readText(formData, "targetSegment"),
    proposedApplication: readText(formData, "proposedApplication"),
    expectedBenefit: readText(formData, "expectedBenefit"),
    description: readText(formData, "description"),
    technicalConstraints: readText(formData, "technicalConstraints"),
    missingInformation: readText(formData, "missingInformation"),
    evidenceLines: readText(formData, "evidenceLines"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { status: "error", message: "Revise os campos destacados.", fieldErrors, values: formValues(formData), submittedAt: Date.now() };
  }

  const supabase = await createSupabaseServerClient();
  if (sessionId) {
    const session = await supabase.from("research_sessions").select("status").eq("id", sessionId.data).maybeSingle();
    if (session.error || !session.data) return { status: "error", message: "Pesquisa não encontrada.", submittedAt: Date.now() };
    if (!["draft", "awaiting_approval", "ready"].includes(session.data.status)) {
      return { status: "error", message: "A busca desta pesquisa já foi feita. Execute-a novamente para incluir novas ideias.", values: formValues(formData), submittedAt: Date.now() };
    }
  }
  const idea = parsed.data;
  const { data, error } = await supabase
    .from("product_ideas")
    .insert({
      research_session_id: sessionId?.data ?? null,
      name: idea.name,
      normalized_name: normalizeIdeaName(idea.name),
      problem_statement: idea.problemStatement,
      target_segment: idea.targetSegment,
      proposed_application: idea.proposedApplication,
      expected_benefit: idea.expectedBenefit,
      description: idea.description,
      technical_constraints: idea.technicalConstraints,
      missing_information: idea.missingInformation,
      evidence: manualEvidence(idea.evidenceLines, member.displayName, new Date().toISOString()) as unknown as NonNullable<Json>,
      origin: "manual",
      created_by: member.id,
    })
    .select("id")
    .single();
  if (error) return { status: "error", message: "Não foi possível registrar a ideia. Tente novamente.", values: formValues(formData), submittedAt: Date.now() };

  if (sessionId) await syncResearchStatus(supabase, sessionId.data);
  refresh(sessionId?.data, data.id);
  if (!sessionId) redirect(`/produtos/${data.id}`);
  return { status: "success", message: "Ideia registrada. Ela aguarda aprovação.", submittedAt: Date.now() };
}

const decisionSchema = z.object({
  ideaId: z.uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(2000),
});

/** RN-03: decisão individual, gravada pela função do banco com responsável e histórico. */
export async function decideIdea(input: { ideaId: string; decision: "approved" | "rejected"; note?: string }): Promise<ActionState> {
  await requireActiveMember();
  const parsed = decisionSchema.safeParse({ ...input, note: input.note ?? "" });
  if (!parsed.success) return { status: "error", message: "Decisão inválida.", submittedAt: Date.now() };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("decide_product_idea", {
    p_idea_id: parsed.data.ideaId,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note || undefined,
  });
  if (error) return { status: "error", message: "Não foi possível registrar a decisão. Tente novamente.", submittedAt: Date.now() };
  if (data?.research_session_id) {
    await syncResearchStatus(supabase, data.research_session_id);
    // Novas execuções reaproveitam as ideias da pesquisa original.
    const reruns = await supabase.from("research_sessions").select("id").eq("rerun_of", data.research_session_id);
    for (const rerun of reruns.data ?? []) await syncResearchStatus(supabase, rerun.id);
  }
  refresh(data?.research_session_id, parsed.data.ideaId);
  return {
    status: "success",
    message: parsed.data.decision === "approved" ? "Ideia aprovada." : "Ideia rejeitada.",
    submittedAt: Date.now(),
  };
}

/** Sugestões da IA para uma pesquisa. Sem configuração ou acima do limite diário, nada é chamado. */
export async function generateAiIdeas(input: { researchSessionId: string }): Promise<ActionState> {
  const member = await requireActiveMember();
  const sessionId = uuid.safeParse(input.researchSessionId);
  if (!sessionId.success) return { status: "error", message: "Pesquisa inválida.", submittedAt: Date.now() };

  const config = readAiConfig();
  if (!config.ok) {
    return { status: "error", message: `IA não configurada. Falta definir: ${config.missing.join(", ")}.`, submittedAt: Date.now() };
  }

  const supabase = await createSupabaseServerClient();
  const session = await supabase
    .from("research_sessions")
    .select("id, research_type, query, objective, status, configuration_snapshot")
    .eq("id", sessionId.data)
    .maybeSingle();
  if (session.error || !session.data) return { status: "error", message: "Pesquisa não encontrada.", submittedAt: Date.now() };
  if (!["draft", "awaiting_approval", "ready"].includes(session.data.status)) {
    return { status: "error", message: "A busca desta pesquisa já foi feita. Execute-a novamente para novas ideias.", submittedAt: Date.now() };
  }

  const used = await supabase
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfDayInSaoPaulo(new Date()));
  if (used.error) return { status: "error", message: "Não foi possível verificar o limite de uso da IA.", submittedAt: Date.now() };
  if ((used.count ?? 0) >= config.config.dailyLimit) {
    return { status: "error", message: `Limite diário de ${config.config.dailyLimit} uso(s) da IA atingido.`, submittedAt: Date.now() };
  }

  const existing = await allIdeaNames(supabase);
  const snapshot = parseSnapshot(session.data.configuration_snapshot);
  const prompt = buildProductIdeasPrompt({
    researchType: session.data.research_type,
    query: session.data.query,
    objective: session.data.objective,
    capacitySummary: snapshot?.capacitySummary ?? null,
    existingIdeas: existing.slice(0, 50).map((idea) => idea.name),
  });

  const result = await generateIdeasWithGemini(prompt, { apiKey: config.config.apiKey, model: config.config.model });
  await supabase.from("ai_usage_log").insert({
    provider: config.config.provider,
    model: config.config.model,
    purpose: "product_ideas",
    research_session_id: sessionId.data,
    status: result.ok ? "succeeded" : result.code === "invalid_output" ? "rejected_output" : "failed",
    error_code: result.ok ? null : result.code,
    created_by: member.id,
  });
  if (!result.ok) return { status: "error", message: result.message, submittedAt: Date.now() };

  const observedAt = new Date().toISOString();
  const rows = result.ideas.map((idea) => ({
    research_session_id: sessionId.data,
    name: idea.name,
    normalized_name: normalizeIdeaName(idea.name),
    problem_statement: idea.problem,
    target_segment: idea.targetSegment,
    proposed_application: idea.application,
    expected_benefit: idea.expectedBenefit,
    technical_constraints: idea.technicalDifficulties.join("\n") || null,
    missing_information: idea.missingInformation.join("\n") || null,
    evidence: aiEvidence(idea, config.config.provider, observedAt) as unknown as NonNullable<Json>,
    origin: "ai" as const,
    ai_provider: config.config.provider,
    ai_model: config.config.model,
    created_by: member.id,
  }));
  const { error } = await supabase.from("product_ideas").insert(rows);
  if (error) return { status: "error", message: "A IA respondeu, mas as sugestões não puderam ser gravadas.", submittedAt: Date.now() };

  await syncResearchStatus(supabase, sessionId.data);
  refresh(sessionId.data);
  return { status: "success", message: `${rows.length} sugestão(ões) da IA aguardando sua decisão.`, submittedAt: Date.now() };
}
