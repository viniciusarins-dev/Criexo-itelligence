import "server-only";

import { z } from "zod";

import {
  sanitizeSearchTerm,
  type CompanyDraft,
  type ExistingCompanyKeys,
  type ProvenanceMap,
} from "@/domain/companies/company";
import { normalizeCompanyName } from "@/domain/rules/normalization";
import { parseScoringConfig, scoreToStars, type ScoringConfig } from "@/domain/scoring";
import { requireActiveMember } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/supabase/types";

export const COMPANY_PAGE_SIZE = 20;

export const COMPANY_SORTS = {
  atualizacao: "Atualização mais recente",
  nome: "Nome (A–Z)",
  distancia: "Mais próximas",
  pontuacao: "Maior pontuação",
} as const;
export type CompanySort = keyof typeof COMPANY_SORTS;

/** Filtro especial: empresas que ainda não têm nenhuma oportunidade. */
export const NO_OPPORTUNITY = "sem_oportunidade";

export const companyListParamsSchema = z.object({
  q: z.string().max(200).optional().catch(undefined),
  segmento: z.string().max(120).optional().catch(undefined),
  status: z.string().max(60).optional().catch(undefined),
  ordem: z.enum(Object.keys(COMPANY_SORTS) as [CompanySort, ...CompanySort[]]).catch("atualizacao"),
  pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type CompanyListParams = z.infer<typeof companyListParamsSchema>;

export type StatusOption = { key: string; label: string };

export type CompanyListRow = {
  id: string;
  name: string;
  segment: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  phone: string | null;
  distanceKm: number | null;
  locationStatus: Enums<"information_status">;
  score: number | null;
  stars: number | null;
  confidence: number | null;
  commercialStatus: string | null;
  productName: string | null;
  opportunityCount: number;
  lastVerifiedAt: string | null;
  updatedAt: string;
};

export type CompanyList = {
  rows: CompanyListRow[];
  total: number;
  page: number;
  pageCount: number;
  segments: string[];
  statuses: StatusOption[];
  referenceConfigured: boolean;
};

export class CompanyLoadError extends Error {
  constructor(section: string, cause: unknown) {
    super(`Falha ao carregar ${section}`, { cause });
    this.name = "CompanyLoadError";
  }
}

async function activeScoringConfig(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data, error } = await supabase.from("scoring_configs").select("config").eq("is_active", true).maybeSingle();
  if (error) throw new CompanyLoadError("pontuação", error);
  return data ? parseScoringConfig(data.config) : null;
}

function starsFor(score: number | null, config: ScoringConfig | null) {
  return score === null || !config ? null : scoreToStars(score, config.starBands);
}

export async function listCompanies(params: CompanyListParams): Promise<CompanyList> {
  await requireActiveMember();
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("company_overview")
    .select(
      "id, name, segment, neighborhood, city, state, website, phone, distance_km, location_status, score, confidence, commercial_status, product_name, opportunity_count, last_verified_at, updated_at",
      { count: "exact" },
    );

  const term = params.q ? sanitizeSearchTerm(params.q) : "";
  if (term) {
    const normalized = normalizeCompanyName(term);
    const filters = [`segment.ilike.*${term}*`, `neighborhood.ilike.*${term}*`, `city.ilike.*${term}*`];
    if (normalized) filters.unshift(`normalized_name.ilike.*${normalized}*`);
    query = query.or(filters.join(","));
  }
  if (params.segmento) query = query.eq("segment", params.segmento);
  if (params.status === NO_OPPORTUNITY) query = query.eq("opportunity_count", 0);
  else if (params.status) query = query.eq("commercial_status", params.status);

  switch (params.ordem) {
    case "nome":
      query = query.order("name", { ascending: true });
      break;
    case "distancia":
      query = query.order("distance_km", { ascending: true, nullsFirst: false }).order("name");
      break;
    case "pontuacao":
      query = query.order("score", { ascending: false, nullsFirst: false }).order("name");
      break;
    default:
      query = query.order("updated_at", { ascending: false });
  }

  const from = (params.pagina - 1) * COMPANY_PAGE_SIZE;
  query = query.range(from, from + COMPANY_PAGE_SIZE - 1);

  const [result, segments, statuses, reference, config] = await Promise.all([
    query,
    supabase.from("companies").select("segment").not("segment", "is", null).order("segment").limit(1000),
    supabase.from("commercial_statuses").select("key, label").eq("is_active", true).order("position"),
    supabase.from("system_settings").select("key").eq("key", "geo.reference").maybeSingle(),
    activeScoringConfig(supabase),
  ]);

  // Página além do fim (ex.: filtro mudou): a API responde 416; tratamos como lista vazia.
  if (result.error && result.status !== 416) throw new CompanyLoadError("empresas", result.error);
  if (segments.error) throw new CompanyLoadError("segmentos", segments.error);
  if (statuses.error) throw new CompanyLoadError("status", statuses.error);
  if (reference.error) throw new CompanyLoadError("configurações", reference.error);

  const total = result.count ?? 0;
  return {
    rows: (result.data ?? []).map((row) => ({
      id: row.id!,
      name: row.name!,
      segment: row.segment,
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
      website: row.website,
      phone: row.phone,
      distanceKm: row.distance_km === null ? null : Number(row.distance_km),
      locationStatus: row.location_status ?? "unknown",
      score: row.score === null ? null : Number(row.score),
      stars: starsFor(row.score === null ? null : Number(row.score), config),
      confidence: row.confidence === null ? null : Number(row.confidence),
      commercialStatus: row.commercial_status,
      productName: row.product_name,
      opportunityCount: row.opportunity_count ?? 0,
      lastVerifiedAt: row.last_verified_at,
      updatedAt: row.updated_at!,
    })),
    total,
    page: params.pagina,
    pageCount: Math.max(1, Math.ceil(total / COMPANY_PAGE_SIZE)),
    segments: [...new Set(segments.data.map((row) => row.segment!).filter(Boolean))],
    statuses: statuses.data,
    referenceConfigured: Boolean(reference.data),
  };
}

// -----------------------------------------------------------------------------
// Detalhes
// -----------------------------------------------------------------------------

export type CompanyDetails = {
  company: Tables<"companies">;
  provenance: ProvenanceMap;
  distanceKm: number | null;
  referenceConfigured: boolean;
  createdByName: string | null;
  sources: Tables<"company_sources">[];
  opportunities: {
    id: string;
    productName: string | null;
    status: string;
    statusLabel: string;
    isSaved: boolean;
    score: number | null;
    stars: number | null;
    confidence: number | null;
    isComplete: boolean | null;
    updatedAt: string;
  }[];
  activities: {
    id: string;
    type: Enums<"activity_type">;
    note: string | null;
    previousStatus: string | null;
    newStatus: string | null;
    userName: string | null;
    createdAt: string;
  }[];
  statusLabels: Record<string, string>;
};

const uuidSchema = z.uuid();

export async function getCompany(id: string): Promise<CompanyDetails | null> {
  await requireActiveMember();
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();

  const company = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
  if (company.error) throw new CompanyLoadError("empresa", company.error);
  if (!company.data) return null;

  const [overview, sources, opportunities, statuses, profiles, reference, config] = await Promise.all([
    supabase.from("company_overview").select("distance_km").eq("id", id).maybeSingle(),
    supabase.from("company_sources").select("*").eq("company_id", id).order("collected_at", { ascending: false }),
    supabase
      .from("opportunities")
      .select("id, commercial_status, is_saved, score, confidence, score_is_complete, updated_at, product:product_ideas(name)")
      .eq("company_id", id)
      .order("score", { ascending: false, nullsFirst: false }),
    supabase.from("commercial_statuses").select("key, label"),
    supabase.from("profiles").select("id, display_name"),
    supabase.from("system_settings").select("key").eq("key", "geo.reference").maybeSingle(),
    activeScoringConfig(supabase),
  ]);
  for (const [section, result] of [
    ["distância", overview],
    ["fontes", sources],
    ["oportunidades", opportunities],
    ["status", statuses],
    ["equipe", profiles],
    ["configurações", reference],
  ] as const) {
    if (result.error) throw new CompanyLoadError(section, result.error);
  }

  const opportunityIds = (opportunities.data ?? []).map((row) => row.id);
  const activities = opportunityIds.length
    ? await supabase
        .from("commercial_activities")
        .select("id, activity_type, note, previous_status, new_status, user_id, created_at")
        .in("opportunity_id", opportunityIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [], error: null };
  if (activities.error) throw new CompanyLoadError("histórico", activities.error);

  const statusLabels = Object.fromEntries((statuses.data ?? []).map((row) => [row.key, row.label]));
  const names = new Map((profiles.data ?? []).map((row) => [row.id, row.display_name]));
  const provenance = (company.data.field_provenance ?? {}) as ProvenanceMap;
  const distance = overview.data?.distance_km;

  return {
    company: company.data,
    provenance,
    distanceKm: distance === null || distance === undefined ? null : Number(distance),
    referenceConfigured: Boolean(reference.data),
    createdByName: names.get(company.data.created_by) ?? null,
    sources: sources.data ?? [],
    opportunities: (opportunities.data ?? []).map((row) => {
      const score = row.score === null ? null : Number(row.score);
      return {
        id: row.id,
        productName: row.product?.name ?? null,
        status: row.commercial_status,
        statusLabel: statusLabels[row.commercial_status] ?? row.commercial_status,
        isSaved: row.is_saved,
        score,
        stars: starsFor(score, config),
        confidence: row.confidence === null ? null : Number(row.confidence),
        isComplete: row.score_is_complete,
        updatedAt: row.updated_at,
      };
    }),
    activities: (activities.data ?? []).map((row) => ({
      id: row.id,
      type: row.activity_type,
      note: row.note,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      userName: names.get(row.user_id) ?? null,
      createdAt: row.created_at,
    })),
    statusLabels,
  };
}

// -----------------------------------------------------------------------------
// Apoio ao cadastro
// -----------------------------------------------------------------------------

/** Empresas que coincidem em algum identificador com o rascunho (para revisão humana). */
export async function companiesMatching(draft: CompanyDraft): Promise<ExistingCompanyKeys[]> {
  const supabase = await createSupabaseServerClient();
  const filters: string[] = [`normalized_name.eq."${draft.normalizedName}"`];
  if (draft.cnpj) filters.push(`cnpj.eq.${draft.cnpj}`);
  if (draft.websiteDomain) filters.push(`website_domain.eq."${draft.websiteDomain}"`);
  if (draft.phoneNormalized) filters.push(`phone_normalized.eq.${draft.phoneNormalized}`);

  const { data, error } = await supabase
    .from("companies")
    .select("id, name, normalized_name, cnpj, website_domain, phone_normalized, neighborhood, city")
    .or(filters.join(","))
    .limit(20);
  if (error) throw new CompanyLoadError("duplicidades", error);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    cnpj: row.cnpj,
    websiteDomain: row.website_domain,
    phoneNormalized: row.phone_normalized,
    neighborhood: row.neighborhood,
    city: row.city,
  }));
}
