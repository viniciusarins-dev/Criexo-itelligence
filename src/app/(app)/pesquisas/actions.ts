"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { canSearch, rankInternalMatches, searchOutcome, searchTerms } from "@/domain/research/research";
import { requireActiveMember } from "@/lib/auth/session";
import type { Json } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/validation/form-data";
import { currentSnapshot, ideaSessionIds } from "@/server/repositories/research";
import { syncResearchStatus } from "@/server/research-status";

const uuid = z.uuid();

/** Única fonte ativa nesta etapa: as empresas já cadastradas no sistema. */
const INTERNAL_SOURCE = "Base interna";

function fail(message: string): ActionState {
  return { status: "error", message, submittedAt: Date.now() };
}

export async function runSearch(input: { researchSessionId: string }): Promise<ActionState> {
  const member = await requireActiveMember();
  const sessionId = uuid.safeParse(input.researchSessionId);
  if (!sessionId.success) return fail("Pesquisa inválida.");
  const supabase = await createSupabaseServerClient();

  const session = await supabase.from("research_sessions").select("id, query, status, rerun_of").eq("id", sessionId.data).maybeSingle();
  if (session.error || !session.data) return fail("Pesquisa não encontrada.");
  if (session.data.status !== "ready") return fail("A busca só pode começar com todas as ideias decididas e ao menos uma aprovada.");

  const ideas = await supabase
    .from("product_ideas")
    .select("id, approval_status, target_segment")
    .in("research_session_id", ideaSessionIds(session.data));
  if (ideas.error) return fail("Não foi possível ler as ideias da pesquisa.");
  if (!canSearch(ideas.data.map((idea) => idea.approval_status))) {
    return fail("Decida todas as ideias e aprove ao menos uma antes de buscar.");
  }
  const approved = ideas.data.filter((idea) => idea.approval_status === "approved");

  const startedAt = new Date().toISOString();
  await supabase.from("research_sessions").update({ status: "running", started_at: startedAt, error_message: null }).eq("id", sessionId.data);
  const run = await supabase
    .from("research_source_runs")
    .insert({ research_session_id: sessionId.data, source_name: INTERNAL_SOURCE, status: "running", started_at: startedAt })
    .select("id")
    .single();

  try {
    if (run.error) throw run.error;
    const candidates = await supabase.from("company_overview").select("id, name, segment, distance_km").limit(2000);
    if (candidates.error) throw candidates.error;

    const terms = searchTerms(session.data.query, approved.map((idea) => idea.target_segment));
    const matches = rankInternalMatches(
      candidates.data.map((row) => ({
        id: row.id!,
        name: row.name!,
        segment: row.segment,
        distanceKm: row.distance_km === null ? null : Number(row.distance_km),
      })),
      terms,
    );

    const results: Json[] = [];
    for (const [index, match] of matches.entries()) {
      for (const idea of approved) {
        // Reaproveita a oportunidade existente (empresa × produto); nunca duplica.
        const existing = await supabase
          .from("opportunities")
          .select("id")
          .eq("company_id", match.id)
          .eq("product_idea_id", idea.id)
          .maybeSingle();
        if (existing.error) throw existing.error;
        let opportunityId = existing.data?.id;
        if (!opportunityId) {
          const created = await supabase
            .from("opportunities")
            .insert({ company_id: match.id, product_idea_id: idea.id, research_session_id: sessionId.data, created_by: member.id })
            .select("id")
            .single();
          if (created.error) throw created.error;
          opportunityId = created.data.id;
        }
        results.push({
          research_session_id: sessionId.data,
          opportunity_id: opportunityId,
          company_id: match.id,
          product_idea_id: idea.id,
          source_name: INTERNAL_SOURCE,
          match_reason: match.reason,
          rank: index + 1,
        });
      }
    }
    if (results.length) {
      const inserted = await supabase
        .from("research_session_results")
        .insert(results as unknown as { research_session_id: string; opportunity_id: string; company_id: string; source_name: string; match_reason: string; rank: number }[]);
      if (inserted.error) throw inserted.error;
    }

    const finishedAt = new Date().toISOString();
    await supabase
      .from("research_source_runs")
      .update({ status: "succeeded", results_count: matches.length, finished_at: finishedAt, request_metadata: { terms } })
      .eq("id", run.data.id);
    await supabase
      .from("research_sessions")
      .update({ status: searchOutcome(matches.length, 0, 1), completed_at: finishedAt })
      .eq("id", sessionId.data);
  } catch {
    const finishedAt = new Date().toISOString();
    if (run.data) {
      await supabase
        .from("research_source_runs")
        .update({ status: "failed", finished_at: finishedAt, error_message: "Falha ao consultar a base interna." })
        .eq("id", run.data.id);
    }
    await supabase
      .from("research_sessions")
      .update({ status: "failed", completed_at: finishedAt, error_message: "A busca falhou. Os dados já registrados não foram afetados." })
      .eq("id", sessionId.data);
    revalidatePath(`/pesquisas/${sessionId.data}`);
    return fail("A busca falhou. Tente executar a pesquisa novamente.");
  }

  revalidatePath(`/pesquisas/${sessionId.data}`);
  revalidatePath("/pesquisas");
  revalidatePath("/oportunidades");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return { status: "success", message: "Busca concluída.", submittedAt: Date.now() };
}

/** Nova execução: cria outra pesquisa com os mesmos parâmetros; a anterior fica intacta. */
export async function rerunResearch(input: { researchSessionId: string }): Promise<ActionState> {
  const member = await requireActiveMember();
  const sessionId = uuid.safeParse(input.researchSessionId);
  if (!sessionId.success) return fail("Pesquisa inválida.");
  const supabase = await createSupabaseServerClient();
  const session = await supabase
    .from("research_sessions")
    .select("id, research_type, query, objective, rerun_of")
    .eq("id", sessionId.data)
    .maybeSingle();
  if (session.error || !session.data) return fail("Pesquisa não encontrada.");

  let snapshot;
  try {
    snapshot = await currentSnapshot(supabase);
  } catch {
    return fail("Não foi possível ler as configurações atuais.");
  }
  const created = await supabase
    .from("research_sessions")
    .insert({
      created_by: member.id,
      research_type: session.data.research_type,
      query: session.data.query,
      objective: session.data.objective,
      rerun_of: session.data.rerun_of ?? session.data.id,
      region_label: snapshot.geoReference?.address ?? null,
      reference_latitude: snapshot.geoReference?.latitude ?? null,
      reference_longitude: snapshot.geoReference?.longitude ?? null,
      radius_km: snapshot.radiusKm,
      configuration_snapshot: snapshot as unknown as NonNullable<Json>,
    })
    .select("id")
    .single();
  if (created.error) return fail("Não foi possível criar a nova execução.");
  await syncResearchStatus(supabase, created.data.id);
  revalidatePath("/pesquisas");
  redirect(`/pesquisas/${created.data.id}`);
}
