"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireActiveMember } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  reviewId: z.uuid(),
  decision: z.enum(["same_company", "different_company"]),
  note: z.string().trim().max(2000),
});

export type DuplicateDecisionState = { status: "success" | "error"; message: string; companyId?: string };

/** Decisão humana (seção 7): aplicada pela função do banco, com responsável e data. */
export async function resolveDuplicate(input: { reviewId: string; decision: "same_company" | "different_company"; note?: string }): Promise<DuplicateDecisionState> {
  await requireActiveMember();
  const parsed = schema.safeParse({ ...input, note: input.note ?? "" });
  if (!parsed.success) return { status: "error", message: "Decisão inválida." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("resolve_duplicate_review", {
    p_review_id: parsed.data.reviewId,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note || undefined,
  });
  if (error) {
    return { status: "error", message: error.code === "55000" ? "Esta revisão já foi decidida por outra pessoa." : "Não foi possível registrar a decisão." };
  }
  revalidatePath("/empresas/duplicidades");
  revalidatePath("/empresas");
  revalidatePath(`/empresas/${data}`);
  return {
    status: "success",
    companyId: data,
    message: parsed.data.decision === "same_company" ? "Registro ligado à empresa cadastrada." : "Cadastrada como empresa nova.",
  };
}
