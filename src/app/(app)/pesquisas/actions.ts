"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActiveMember } from "@/lib/auth/session";
import type { Json } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/validation/form-data";
import { currentSnapshot } from "@/server/repositories/research";
import { executeSearch, SearchError } from "@/server/research/search";
import { syncResearchStatus } from "@/server/research-status";

const uuid = z.uuid();

function fail(message: string): ActionState {
  return { status: "error", message, submittedAt: Date.now() };
}

export async function runSearch(input: { researchSessionId: string }): Promise<ActionState> {
  const member = await requireActiveMember();
  const sessionId = uuid.safeParse(input.researchSessionId);
  if (!sessionId.success) return fail("Pesquisa inválida.");
  const supabase = await createSupabaseServerClient();

  let summary;
  try {
    summary = await executeSearch(supabase, member.id, sessionId.data);
  } catch (error) {
    if (error instanceof SearchError) return fail(error.message);
    const finishedAt = new Date().toISOString();
    await supabase
      .from("research_source_runs")
      .update({ status: "failed", finished_at: finishedAt, error_message: "Busca interrompida por erro." })
      .eq("research_session_id", sessionId.data)
      .eq("status", "running");
    await supabase
      .from("research_sessions")
      .update({ status: "failed", completed_at: finishedAt, error_message: "A busca falhou. Os dados já registrados não foram afetados." })
      .eq("id", sessionId.data);
    revalidatePath(`/pesquisas/${sessionId.data}`);
    return fail("A busca falhou. Tente executar a pesquisa novamente.");
  }

  revalidatePath(`/pesquisas/${sessionId.data}`);
  revalidatePath("/pesquisas");
  revalidatePath("/empresas");
  revalidatePath("/oportunidades");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  const parts = [`Busca concluída: ${summary.found} empresa(s)`];
  if (summary.imported) parts.push(`${summary.imported} nova(s) do OpenStreetMap`);
  if (summary.failedSources.length) parts.push(`fonte(s) com problema: ${summary.failedSources.join(", ")}`);
  return { status: "success", message: `${parts.join(" · ")}.`, submittedAt: Date.now() };
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
