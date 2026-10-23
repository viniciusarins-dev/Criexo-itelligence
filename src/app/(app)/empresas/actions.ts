"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  changedIdentifiers,
  findDuplicateCandidates,
  relevantDuplicates,
  manualProvenance,
  parseCompanyInput,
  type CompanyDraft,
  type CompanyFieldErrors,
  type DuplicateCandidate,
  type ProvenanceMap,
} from "@/domain/companies/company";
import { requireActiveMember } from "@/lib/auth/session";
import type { Json } from "@/lib/supabase/database.types";
import type { Tables } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formValues, readChecked, readText, type FormValues } from "@/lib/validation/form-data";
import { companiesMatching } from "@/server/repositories/companies";

export type CompanyFormState = {
  status: "idle" | "error" | "duplicates";
  message?: string;
  fieldErrors?: CompanyFieldErrors;
  duplicates?: DuplicateCandidate[];
  values?: FormValues;
  submittedAt?: number;
};

function draftToRow(draft: CompanyDraft) {
  return {
    name: draft.name,
    normalized_name: draft.normalizedName,
    cnpj: draft.cnpj,
    segment: draft.segment,
    website: draft.website,
    website_domain: draft.websiteDomain,
    phone: draft.phone,
    phone_normalized: draft.phoneNormalized,
    address: draft.address,
    neighborhood: draft.neighborhood,
    city: draft.city,
    state: draft.state,
    postal_code: draft.postalCode,
    latitude: draft.latitude,
    longitude: draft.longitude,
    location_status: draft.locationStatus,
  };
}

function rowToDraft(row: Pick<Tables<"companies">, keyof ReturnType<typeof draftToRow>>): CompanyDraft {
  return {
    name: row.name,
    normalizedName: row.normalized_name,
    cnpj: row.cnpj,
    segment: row.segment,
    website: row.website,
    websiteDomain: row.website_domain,
    phone: row.phone,
    phoneNormalized: row.phone_normalized,
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    locationStatus: row.location_status,
  };
}

const idSchema = z.uuid();

export async function saveCompany(_previous: CompanyFormState, formData: FormData): Promise<CompanyFormState> {
  const member = await requireActiveMember();
  const values = formValues(formData);
  const fail = (message: string, extra: Partial<CompanyFormState> = {}): CompanyFormState => ({
    status: "error",
    message,
    values,
    submittedAt: Date.now(),
    ...extra,
  });

  const idText = readText(formData, "id");
  const id = idText ? idSchema.safeParse(idText) : null;
  if (id && !id.success) return fail("Empresa inválida.");

  const parsed = parseCompanyInput({
    name: readText(formData, "name"),
    cnpj: readText(formData, "cnpj"),
    segment: readText(formData, "segment"),
    website: readText(formData, "website"),
    phone: readText(formData, "phone"),
    address: readText(formData, "address"),
    neighborhood: readText(formData, "neighborhood"),
    city: readText(formData, "city"),
    state: readText(formData, "state"),
    postalCode: readText(formData, "postalCode"),
    coordinates: readText(formData, "coordinates"),
    locationConfirmed: readChecked(formData, "locationConfirmed"),
  });
  if (!parsed.ok) return fail("Revise os campos destacados.", { fieldErrors: parsed.errors });
  const draft = parsed.draft;

  const supabase = await createSupabaseServerClient();
  let current: Tables<"companies"> | null = null;
  if (id) {
    const result = await supabase.from("companies").select("*").eq("id", id.data).maybeSingle();
    if (result.error) return fail("Não foi possível carregar a empresa. Tente novamente.");
    if (!result.data) return fail("Empresa não encontrada.");
    current = result.data;
  }

  let duplicates: DuplicateCandidate[];
  try {
    duplicates = relevantDuplicates(
      findDuplicateCandidates(draft, await companiesMatching(draft), id?.data),
      current ? changedIdentifiers(rowToDraft(current), draft) : null,
    );
  } catch {
    return fail("Não foi possível verificar duplicidades. Tente novamente.");
  }
  const sameCnpj = duplicates.find((candidate) => candidate.strength === "certain");
  if (sameCnpj) {
    return fail("Já existe uma empresa com este CNPJ.", { fieldErrors: { cnpj: "CNPJ já cadastrado." }, duplicates: [sameCnpj] });
  }
  if (duplicates.length > 0 && formData.get("confirmDuplicates") !== "1") {
    return {
      status: "duplicates",
      message: "Encontramos empresas parecidas. Confira antes de continuar.",
      duplicates,
      values,
      submittedAt: Date.now(),
    };
  }

  const observedAt = new Date().toISOString();
  const row = draftToRow(draft);
  let savedId: string;

  if (id && current) {
    const provenance = manualProvenance(
      draft,
      { draft: rowToDraft(current), provenance: (current.field_provenance ?? {}) as ProvenanceMap },
      { observedAt, userId: member.id },
    );
    const locationChanged =
      current.latitude !== draft.latitude ||
      current.longitude !== draft.longitude ||
      current.location_status !== draft.locationStatus;
    const { error } = await supabase
      .from("companies")
      .update({
        ...row,
        field_provenance: provenance as unknown as NonNullable<Json>,
        location_verified_at:
          draft.locationStatus === "confirmed"
            ? locationChanged
              ? observedAt
              : (current.location_verified_at ?? observedAt)
            : null,
      })
      .eq("id", id.data);
    if (error) return fail(error.code === "23505" ? "Já existe uma empresa com este CNPJ." : "Não foi possível salvar. Tente novamente.");
    savedId = id.data;
  } else {
    const provenance = manualProvenance(draft, null, { observedAt, userId: member.id });
    const { data, error } = await supabase
      .from("companies")
      .insert({
        ...row,
        field_provenance: provenance as unknown as NonNullable<Json>,
        location_verified_at: draft.locationStatus === "confirmed" ? observedAt : null,
        created_by: member.id,
      })
      .select("id")
      .single();
    if (error) return fail(error.code === "23505" ? "Já existe uma empresa com este CNPJ." : "Não foi possível cadastrar. Tente novamente.");
    savedId = data.id;
  }

  revalidatePath("/empresas");
  revalidatePath("/dashboard");
  redirect(`/empresas/${savedId}?salvo=1`);
}
