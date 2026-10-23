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
import { BRASILAPI_SOURCE_NAME, enrichFromCnpj } from "@/domain/sources/brasilapi";
import { GEOCODING_SOURCE_NAME, geocodingQuery } from "@/domain/sources/geocoding";
import { fetchCnpj } from "@/server/integrations/brasilapi";
import { geocodeAddress } from "@/server/integrations/nominatim";
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

// -----------------------------------------------------------------------------
// Fontes externas sob demanda (só completam campos vazios)
// -----------------------------------------------------------------------------

type SourceActionState = { status: "success" | "error"; message: string; submittedAt: number };

function sourceResult(status: SourceActionState["status"], message: string): SourceActionState {
  return { status, message, submittedAt: Date.now() };
}

/** BrasilAPI: completa segmento e endereço a partir do CNPJ; guarda situação cadastral, CNAE e porte. */
export async function enrichCompanyFromCnpj(input: { companyId: string }): Promise<SourceActionState> {
  await requireActiveMember();
  if (!idSchema.safeParse(input.companyId).success) return sourceResult("error", "Empresa inválida.");
  const supabase = await createSupabaseServerClient();
  const company = await supabase.from("companies").select("*").eq("id", input.companyId).maybeSingle();
  if (company.error || !company.data) return sourceResult("error", "Empresa não encontrada.");
  if (!company.data.cnpj) return sourceResult("error", "Cadastre o CNPJ antes de consultar.");

  const response = await fetchCnpj(company.data.cnpj);
  if (!response.ok) return sourceResult("error", response.message);

  const observedAt = new Date().toISOString();
  const enrichment = enrichFromCnpj(rowToDraft(company.data), response.data);
  const provenance = { ...((company.data.field_provenance ?? {}) as ProvenanceMap) };
  for (const field of enrichment.filled) provenance[field] = { status: "source_declared", source: BRASILAPI_SOURCE_NAME, observedAt };

  if (enrichment.filled.length) {
    const { changes } = enrichment;
    const updated = await supabase
      .from("companies")
      .update({
        ...(changes.segment ? { segment: changes.segment } : {}),
        ...(changes.address ? { address: changes.address } : {}),
        ...(changes.neighborhood ? { neighborhood: changes.neighborhood } : {}),
        ...(changes.city ? { city: changes.city } : {}),
        ...(changes.state ? { state: changes.state } : {}),
        ...(changes.postalCode ? { postal_code: changes.postalCode } : {}),
        field_provenance: provenance as unknown as NonNullable<Json>,
      })
      .eq("id", input.companyId);
    if (updated.error) return sourceResult("error", "Os dados chegaram, mas não puderam ser gravados.");
  }

  const metadata = { ...enrichment.metadata, consultadoEm: observedAt } as unknown as NonNullable<Json>;
  const existing = await supabase
    .from("company_sources")
    .select("id")
    .eq("source_name", BRASILAPI_SOURCE_NAME)
    .eq("source_record_id", company.data.cnpj)
    .maybeSingle();
  const source = existing.data
    ? await supabase.from("company_sources").update({ last_verified_at: observedAt, evidence_metadata: metadata }).eq("id", existing.data.id)
    : await supabase.from("company_sources").insert({
        company_id: input.companyId,
        source_name: BRASILAPI_SOURCE_NAME,
        source_record_id: company.data.cnpj,
        last_verified_at: observedAt,
        evidence_metadata: metadata,
      });
  if (source.error) return sourceResult("error", "Os dados foram completados, mas o registro da fonte falhou.");

  revalidatePath(`/empresas/${input.companyId}`);
  revalidatePath("/empresas");
  const filled = enrichment.filled.map((field) => FIELD_NAMES[field] ?? field);
  const parts = [filled.length ? `Completado: ${filled.join(", ")}` : "Nenhum campo vazio para completar"];
  if (enrichment.isActive === false) parts.push(`atenção: situação cadastral “${enrichment.metadata.situacao}”`);
  return sourceResult("success", `${parts.join(" · ")}.`);
}

const FIELD_NAMES: Partial<Record<string, string>> = {
  segment: "segmento",
  address: "endereço",
  neighborhood: "bairro",
  city: "cidade",
  state: "UF",
  postalCode: "CEP",
};

/** Nominatim: localização aproximada pelo endereço, só quando a empresa ainda não tem coordenadas. */
export async function geocodeCompany(input: { companyId: string }): Promise<SourceActionState> {
  await requireActiveMember();
  if (!idSchema.safeParse(input.companyId).success) return sourceResult("error", "Empresa inválida.");
  const supabase = await createSupabaseServerClient();
  const company = await supabase.from("companies").select("*").eq("id", input.companyId).maybeSingle();
  if (company.error || !company.data) return sourceResult("error", "Empresa não encontrada.");
  if (company.data.latitude !== null) return sourceResult("error", "A empresa já tem localização. Para trocar, edite o cadastro.");
  const query = geocodingQuery(rowToDraft(company.data));
  if (!query) return sourceResult("error", "Cadastre endereço e cidade antes de localizar.");

  const result = await geocodeAddress(query);
  if (!result.ok) {
    if ("message" in result) return sourceResult("error", result.message);
    return sourceResult(
      "error",
      result.reason === "not_found" ? "Endereço não encontrado. Confira o cadastro." : "O endereço só foi localizado de forma aproximada demais (bairro ou cidade).",
    );
  }

  const observedAt = new Date().toISOString();
  const provenance = {
    ...((company.data.field_provenance ?? {}) as ProvenanceMap),
    location: {
      status: "source_declared" as const,
      source: `${GEOCODING_SOURCE_NAME} — ${result.precision === "street" ? "posição aproximada na rua" : "pelo endereço"}`,
      observedAt,
    },
  };
  const updated = await supabase
    .from("companies")
    .update({
      latitude: result.latitude,
      longitude: result.longitude,
      location_status: "source_declared",
      field_provenance: provenance as unknown as NonNullable<Json>,
    })
    .eq("id", input.companyId);
  if (updated.error) return sourceResult("error", "A localização foi encontrada, mas não pôde ser gravada.");
  revalidatePath(`/empresas/${input.companyId}`);
  revalidatePath("/empresas");
  return sourceResult("success", "Localização encontrada pelo endereço. Ela ainda não está confirmada.");
}

/** Confirmação humana da localização (DP-09): só depois dela a proximidade pode chegar a 100. */
export async function confirmCompanyLocation(input: { companyId: string }): Promise<SourceActionState> {
  const member = await requireActiveMember();
  if (!idSchema.safeParse(input.companyId).success) return sourceResult("error", "Empresa inválida.");
  const supabase = await createSupabaseServerClient();
  const company = await supabase.from("companies").select("latitude, location_status, field_provenance").eq("id", input.companyId).maybeSingle();
  if (company.error || !company.data) return sourceResult("error", "Empresa não encontrada.");
  if (company.data.latitude === null) return sourceResult("error", "A empresa ainda não tem localização para confirmar.");
  if (company.data.location_status === "confirmed") return sourceResult("error", "A localização já está confirmada.");

  const observedAt = new Date().toISOString();
  const provenance = {
    ...((company.data.field_provenance ?? {}) as ProvenanceMap),
    location: { status: "confirmed" as const, source: `Conferida por ${member.displayName}`, observedAt, by: member.id },
  };
  const updated = await supabase
    .from("companies")
    .update({ location_status: "confirmed", location_verified_at: observedAt, field_provenance: provenance as unknown as NonNullable<Json> })
    .eq("id", input.companyId);
  if (updated.error) return sourceResult("error", "Não foi possível confirmar a localização.");
  revalidatePath(`/empresas/${input.companyId}`);
  revalidatePath("/empresas");
  return sourceResult("success", "Localização confirmada. Recalcule a pontuação das oportunidades para usar a nova informação.");
}
