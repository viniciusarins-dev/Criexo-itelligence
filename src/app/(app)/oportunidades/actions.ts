"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  ACTIVITY_KINDS,
  contactedStatus,
  optionalNoteSchema,
  requiredNoteSchema,
} from "@/domain/opportunities/opportunity";
import { requireActiveMember } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formValues, readChecked, readText, type ActionState } from "@/lib/validation/form-data";
import { loadStatuses } from "@/server/repositories/opportunities";
import { recalculateOpportunityScore } from "@/server/scoring";

const uuid = z.uuid();

function fail(message: string, formData?: FormData, fieldErrors?: Record<string, string>): ActionState {
  return { status: "error", message, fieldErrors, values: formData ? formValues(formData) : undefined, submittedAt: Date.now() };
}

function refresh(opportunityId: string, companyId?: string) {
  revalidatePath(`/oportunidades/${opportunityId}`);
  revalidatePath("/oportunidades");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  if (companyId) revalidatePath(`/empresas/${companyId}`);
  revalidatePath("/empresas");
}

/** Mensagens das funções do banco (códigos definidos nas migrations). */
function dbMessage(code: string | undefined, fallback: string) {
  if (code === "42501") return "Você não tem permissão para esta ação.";
  if (code === "P0002") return "Oportunidade não encontrada.";
  if (code === "22023") return "A oportunidade já está neste status ou o status é inválido.";
  return fallback;
}

export async function createOpportunity(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const member = await requireActiveMember();
  const companyId = uuid.safeParse(readText(formData, "companyId"));
  if (!companyId.success) return fail("Empresa inválida.");
  const ideaText = readText(formData, "productIdeaId");
  const ideaId = ideaText ? uuid.safeParse(ideaText) : null;
  if (ideaId && !ideaId.success) return fail("Produto inválido.");

  const supabase = await createSupabaseServerClient();
  if (ideaId) {
    const idea = await supabase.from("product_ideas").select("approval_status").eq("id", ideaId.data).maybeSingle();
    if (idea.error) return fail("Não foi possível verificar o produto. Tente novamente.");
    // RN-03: só ideias aprovadas viram oportunidade.
    if (idea.data?.approval_status !== "approved") return fail("Escolha um produto aprovado.");
  }

  const { data, error } = await supabase
    .from("opportunities")
    .insert({ company_id: companyId.data, product_idea_id: ideaId?.data ?? null, created_by: member.id })
    .select("id")
    .single();

  if (error?.code === "23505") {
    let existing = supabase.from("opportunities").select("id").eq("company_id", companyId.data);
    existing = ideaId ? existing.eq("product_idea_id", ideaId.data) : existing.is("product_idea_id", null);
    const found = await existing.maybeSingle();
    if (found.data) redirect(`/oportunidades/${found.data.id}?existente=1`);
    return fail("Já existe uma oportunidade para esta empresa e este produto.");
  }
  if (error) return fail(dbMessage(error.code, "Não foi possível criar a oportunidade. Tente novamente."));

  refresh(data.id, companyId.data);
  redirect(`/oportunidades/${data.id}?criada=1`);
}

export async function setSaved(input: { opportunityId: string; saved: boolean }): Promise<ActionState> {
  await requireActiveMember();
  const id = uuid.safeParse(input.opportunityId);
  if (!id.success) return fail("Oportunidade inválida.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_opportunity_saved", { p_opportunity_id: id.data, p_saved: input.saved });
  if (error) return fail(dbMessage(error.code, "Não foi possível salvar. Tente novamente."));
  refresh(id.data, data?.company_id);
  return { status: "success", message: input.saved ? "Oportunidade salva." : "Removida dos salvos.", submittedAt: Date.now() };
}

const statusInput = z.object({ opportunityId: z.uuid(), status: z.string().min(1).max(60) });

/** Mudança de status sempre pela função do banco, que grava o histórico. */
export async function changeStatus(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireActiveMember();
  const parsed = statusInput.safeParse({ opportunityId: readText(formData, "opportunityId"), status: readText(formData, "status") });
  if (!parsed.success) return fail("Escolha um status.", formData, { status: "Escolha um status." });
  const note = optionalNoteSchema.safeParse(readText(formData, "note"));
  if (!note.success) return fail("Revise a observação.", formData, { note: note.error.issues[0].message });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("change_opportunity_status", {
    p_opportunity_id: parsed.data.opportunityId,
    p_new_status: parsed.data.status,
    p_note: note.data ?? undefined,
  });
  if (error) return fail(dbMessage(error.code, "Não foi possível mudar o status. Tente novamente."), formData);
  refresh(parsed.data.opportunityId, data?.company_id);
  const statuses = await loadStatuses(supabase);
  const label = statuses.find((status) => status.key === parsed.data.status)?.label ?? parsed.data.status;
  return { status: "success", message: `Status alterado para ${label}.`, submittedAt: Date.now() };
}

/** Versão para os cartões do pipeline (sem formulário). */
export async function moveOpportunity(input: { opportunityId: string; status: string }): Promise<ActionState> {
  const formData = new FormData();
  formData.set("opportunityId", input.opportunityId);
  formData.set("status", input.status);
  return changeStatus({ status: "idle" }, formData);
}

export async function addActivity(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const member = await requireActiveMember();
  const id = uuid.safeParse(readText(formData, "opportunityId"));
  if (!id.success) return fail("Oportunidade inválida.");
  const kind = z.enum(ACTIVITY_KINDS).safeParse(readText(formData, "kind"));
  if (!kind.success) return fail("Tipo de registro inválido.", formData);
  const note = requiredNoteSchema.safeParse(readText(formData, "note"));
  if (!note.success) return fail("Revise o registro.", formData, { note: note.error.issues[0].message });

  const supabase = await createSupabaseServerClient();
  const opportunity = await supabase.from("opportunities").select("company_id, commercial_status").eq("id", id.data).maybeSingle();
  if (opportunity.error || !opportunity.data) return fail("Oportunidade não encontrada.");

  const { error } = await supabase
    .from("commercial_activities")
    .insert({ opportunity_id: id.data, user_id: member.id, activity_type: kind.data, note: note.data });
  if (error) return fail(dbMessage(error.code, "Não foi possível registrar. Tente novamente."), formData);

  let message = kind.data === "contact" ? "Contato registrado." : "Observação registrada.";
  // Mover para "Contatada" só quando o usuário marca a opção.
  if (kind.data === "contact" && readChecked(formData, "markContacted")) {
    const target = contactedStatus(await loadStatuses(supabase));
    if (target && opportunity.data.commercial_status !== target.key) {
      const moved = await supabase.rpc("change_opportunity_status", { p_opportunity_id: id.data, p_new_status: target.key });
      if (moved.error) message += " O status não pôde ser alterado.";
      else message += ` Status: ${target.label}.`;
    }
  }
  refresh(id.data, opportunity.data.company_id);
  return { status: "success", message, submittedAt: Date.now() };
}

/** Recalcula a pontuação (ex.: depois de confirmar a localização) e registra no histórico. */
export async function recalculateScore(input: { opportunityId: string }): Promise<ActionState> {
  await requireActiveMember();
  if (!z.uuid().safeParse(input.opportunityId).success) return { status: "error", message: "Oportunidade inválida.", submittedAt: Date.now() };
  const supabase = await createSupabaseServerClient();
  let result;
  try {
    result = await recalculateOpportunityScore(supabase, input.opportunityId);
  } catch {
    return { status: "error", message: "Não foi possível recalcular a pontuação.", submittedAt: Date.now() };
  }
  if (!result.ok) return { status: "error", message: result.message, submittedAt: Date.now() };
  if (!result.after) return { status: "error", message: "Ainda não há dados para pontuar: falta localização e avaliação dos demais critérios.", submittedAt: Date.now() };

  const before = result.before === null ? "sem nota" : result.before.toFixed(0);
  const after = result.after.score!.toFixed(0);
  await supabase.rpc("record_score_recalculation", { p_opportunity_id: input.opportunityId, p_note: `Nota ${before} → ${after} (versão ${result.version}).` });
  revalidatePath(`/oportunidades/${input.opportunityId}`);
  revalidatePath("/oportunidades");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return { status: "success", message: `Pontuação recalculada: ${before} → ${after}.`, submittedAt: Date.now() };
}
