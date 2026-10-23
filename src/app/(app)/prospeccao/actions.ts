"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { researchInputSchema } from "@/domain/research/research";
import { requireActiveMember } from "@/lib/auth/session";
import type { Json } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formValues, readText, type ActionState } from "@/lib/validation/form-data";
import { currentSnapshot } from "@/server/repositories/research";

export async function createResearch(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const member = await requireActiveMember();
  const parsed = researchInputSchema.safeParse({
    researchType: readText(formData, "researchType"),
    query: readText(formData, "query"),
    objective: readText(formData, "objective"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { status: "error", message: "Revise os campos destacados.", fieldErrors, values: formValues(formData), submittedAt: Date.now() };
  }

  const supabase = await createSupabaseServerClient();
  let snapshot;
  try {
    snapshot = await currentSnapshot(supabase);
  } catch {
    return { status: "error", message: "Não foi possível ler as configurações. Tente novamente.", values: formValues(formData), submittedAt: Date.now() };
  }

  const { data, error } = await supabase
    .from("research_sessions")
    .insert({
      created_by: member.id,
      research_type: parsed.data.researchType,
      query: parsed.data.query,
      objective: parsed.data.objective,
      region_label: snapshot.geoReference?.address ?? null,
      reference_latitude: snapshot.geoReference?.latitude ?? null,
      reference_longitude: snapshot.geoReference?.longitude ?? null,
      radius_km: snapshot.radiusKm,
      configuration_snapshot: snapshot as unknown as NonNullable<Json>,
    })
    .select("id")
    .single();
  if (error) {
    return { status: "error", message: "Não foi possível criar a pesquisa. Tente novamente.", values: formValues(formData), submittedAt: Date.now() };
  }
  revalidatePath("/pesquisas");
  revalidatePath("/dashboard");
  redirect(`/pesquisas/${data.id}`);
}
