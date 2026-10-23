import {
  normalizeBrazilianPhone,
  normalizeCnpj,
  normalizeCompanyName,
  normalizeWebsiteDomain,
  sanitizeWebsiteUrl,
} from "@/domain/rules/normalization";
import { parseCoordinatePair } from "@/domain/settings/geo";
import type { InformationStatus } from "@/domain/types/information";

import { BRAZIL_STATES, DUPLICATE_REASON_LABELS, type DuplicateReason } from "./options";

export { BRAZIL_STATES, DUPLICATE_REASON_LABELS, type DuplicateReason } from "./options";


/** Valores do formulário, como digitados. */
export type CompanyFormInput = {
  name: string;
  cnpj: string;
  segment: string;
  website: string;
  phone: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  coordinates: string;
  locationConfirmed: boolean;
};

/** Empresa pronta para gravar, já normalizada. */
export type CompanyDraft = {
  name: string;
  normalizedName: string;
  cnpj: string | null;
  segment: string | null;
  website: string | null;
  websiteDomain: string | null;
  phone: string | null;
  phoneNormalized: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  locationStatus: InformationStatus;
};

export type CompanyFieldErrors = Partial<Record<keyof CompanyFormInput, string>>;

export type ParseResult =
  | { ok: true; draft: CompanyDraft }
  | { ok: false; errors: CompanyFieldErrors };

const LIMITS = { name: 200, segment: 120, address: 200, neighborhood: 120, city: 120 } as const;

function optional(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed : null;
}

/**
 * Valida e normaliza o cadastro manual. Nada é completado por suposição:
 * um telefone sem DDD ou um site inválido viram erro, não um valor "corrigido".
 */
export function parseCompanyInput(input: CompanyFormInput): ParseResult {
  const errors: CompanyFieldErrors = {};

  const name = optional(input.name);
  if (!name) errors.name = "Informe o nome da empresa.";
  else if (name.length > LIMITS.name) errors.name = `Use no máximo ${LIMITS.name} caracteres.`;
  const normalizedName = name ? normalizeCompanyName(name) : "";
  if (name && !normalizedName) errors.name = "O nome precisa ter letras ou números.";

  const cnpjText = optional(input.cnpj);
  const cnpj = cnpjText ? normalizeCnpj(cnpjText) : null;
  if (cnpjText && !cnpj) errors.cnpj = "CNPJ inválido. Confira os dígitos verificadores.";

  const websiteText = optional(input.website);
  const website = websiteText ? sanitizeWebsiteUrl(websiteText) : null;
  if (websiteText && !website) errors.website = "Endereço de site inválido.";

  const phone = optional(input.phone);
  const phoneNormalized = phone ? normalizeBrazilianPhone(phone) : null;
  if (phone && !phoneNormalized) errors.phone = "Informe o telefone com DDD, ex.: (47) 3433-0000.";

  const state = optional(input.state)?.toUpperCase() ?? null;
  if (state && !(BRAZIL_STATES as readonly string[]).includes(state)) errors.state = "Use a sigla do estado, ex.: SC.";

  const postalDigits = input.postalCode.replace(/\D/g, "");
  if (postalDigits && postalDigits.length !== 8) errors.postalCode = "O CEP tem 8 dígitos.";

  const coordinatesText = optional(input.coordinates);
  const coordinates = coordinatesText ? parseCoordinatePair(coordinatesText) : null;
  if (coordinatesText && !coordinates) errors.coordinates = 'Use o formato "-26.27, -48.85".';
  if (input.locationConfirmed && !coordinatesText) {
    errors.coordinates = "Informe as coordenadas para marcar a localização como conferida.";
  }

  const segment = optional(input.segment);
  const address = optional(input.address);
  const neighborhood = optional(input.neighborhood);
  const city = optional(input.city);
  for (const [field, value] of Object.entries({ segment, address, neighborhood, city }) as [keyof typeof LIMITS, string | null][]) {
    if (value && value.length > LIMITS[field]) errors[field] = `Use no máximo ${LIMITS[field]} caracteres.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    draft: {
      name: name!,
      normalizedName,
      cnpj,
      segment,
      website,
      websiteDomain: website ? normalizeWebsiteDomain(website) : null,
      phone,
      phoneNormalized,
      address,
      neighborhood,
      city,
      state,
      postalCode: postalDigits || null,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      // Coordenadas digitadas sem conferência no mapa não contam como confirmadas.
      locationStatus: coordinates ? (input.locationConfirmed ? "confirmed" : "source_declared") : "unknown",
    },
  };
}

// -----------------------------------------------------------------------------
// Origem de cada campo (RN-12)
// -----------------------------------------------------------------------------

export const TRACKED_FIELDS = [
  "name", "cnpj", "segment", "website", "phone", "address", "neighborhood", "city", "state", "postalCode", "location",
] as const;
export type TrackedField = (typeof TRACKED_FIELDS)[number];

export type FieldProvenance = {
  status: InformationStatus;
  source: string;
  observedAt: string;
  by?: string;
};

export type ProvenanceMap = Partial<Record<TrackedField, FieldProvenance>>;

function fieldValue(draft: CompanyDraft, field: TrackedField): string | null {
  if (field === "location") {
    return draft.latitude === null ? null : `${draft.latitude},${draft.longitude},${draft.locationStatus}`;
  }
  const value = draft[field];
  return value === null ? null : String(value);
}

/**
 * Atualiza a origem dos campos alterados num cadastro manual. Campos que não
 * mudaram mantêm a origem anterior (ex.: dado vindo de uma fonte externa).
 */
export function manualProvenance(
  draft: CompanyDraft,
  previous: { draft: CompanyDraft; provenance: ProvenanceMap } | null,
  context: { observedAt: string; userId: string },
): ProvenanceMap {
  const result: ProvenanceMap = { ...(previous?.provenance ?? {}) };
  for (const field of TRACKED_FIELDS) {
    const value = fieldValue(draft, field);
    const before = previous ? fieldValue(previous.draft, field) : null;
    if (value === null) {
      delete result[field];
      continue;
    }
    if (previous && value === before && result[field]) continue;
    result[field] = {
      status: field === "location" ? draft.locationStatus : "confirmed",
      source: "Cadastro manual",
      observedAt: context.observedAt,
      by: context.userId,
    };
  }
  return result;
}

// -----------------------------------------------------------------------------
// Duplicidade (seção 7: sinalizar, nunca unir automaticamente)
// -----------------------------------------------------------------------------


export type ExistingCompanyKeys = {
  id: string;
  name: string;
  normalizedName: string;
  cnpj: string | null;
  websiteDomain: string | null;
  phoneNormalized: string | null;
  neighborhood: string | null;
  city: string | null;
};

export type DuplicateCandidate = {
  id: string;
  name: string;
  location: string | null;
  reasons: DuplicateReason[];
  /** `certain` = mesmo CNPJ; `probable` = coincidência que precisa de revisão (pode ser filial). */
  strength: "certain" | "probable";
};

export function findDuplicateCandidates(
  draft: CompanyDraft,
  existing: ExistingCompanyKeys[],
  excludeId?: string,
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  for (const company of existing) {
    if (company.id === excludeId) continue;
    const reasons: DuplicateReason[] = [];
    if (draft.cnpj && company.cnpj === draft.cnpj) reasons.push("cnpj");
    if (draft.websiteDomain && company.websiteDomain === draft.websiteDomain) reasons.push("website");
    if (draft.phoneNormalized && company.phoneNormalized === draft.phoneNormalized) reasons.push("phone");
    if (draft.normalizedName && company.normalizedName === draft.normalizedName) reasons.push("name");
    if (reasons.length === 0) continue;
    candidates.push({
      id: company.id,
      name: company.name,
      location: [company.neighborhood, company.city].filter(Boolean).join(", ") || null,
      reasons,
      strength: reasons.includes("cnpj") ? "certain" : "probable",
    });
  }
  return candidates.sort((a, b) => (a.strength === b.strength ? b.reasons.length - a.reasons.length : a.strength === "certain" ? -1 : 1));
}

/** Identificadores que mudaram numa edição (base para não repetir avisos já revisados). */
export function changedIdentifiers(before: CompanyDraft, after: CompanyDraft): Set<DuplicateReason> {
  const changed = new Set<DuplicateReason>();
  if (before.cnpj !== after.cnpj) changed.add("cnpj");
  if (before.websiteDomain !== after.websiteDomain) changed.add("website");
  if (before.phoneNormalized !== after.phoneNormalized) changed.add("phone");
  if (before.normalizedName !== after.normalizedName) changed.add("name");
  return changed;
}

/**
 * Na edição, só avisa sobre coincidências em identificadores alterados: as
 * demais já existiam e foram revisadas quando a empresa foi cadastrada.
 * CNPJ igual continua sempre bloqueado (o banco também impede).
 */
export function relevantDuplicates(
  candidates: DuplicateCandidate[],
  changed: Set<DuplicateReason> | null,
): DuplicateCandidate[] {
  if (changed === null) return candidates;
  return candidates.flatMap((candidate) => {
    if (candidate.strength === "certain") return [candidate];
    const reasons = candidate.reasons.filter((reason) => changed.has(reason));
    return reasons.length ? [{ ...candidate, reasons }] : [];
  });
}

// -----------------------------------------------------------------------------
// Busca
// -----------------------------------------------------------------------------

/**
 * Termo de busca seguro para os filtros da API: remove caracteres com
 * significado especial na sintaxe de filtros (vírgula, parênteses, curingas).
 */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()*%\\:"'.]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
