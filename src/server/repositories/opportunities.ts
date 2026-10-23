import "server-only";

import { z } from "zod";

import { sanitizeSearchTerm } from "@/domain/companies/company";
import type { CommercialStatus } from "@/domain/opportunities/opportunity";
import { normalizeCompanyName } from "@/domain/rules/normalization";
import { parseScoringConfig, scoreToStars, type ScoringConfig } from "@/domain/scoring";
import { requireActiveMember } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export class OpportunityLoadError extends Error {
  constructor(section: string, cause: unknown) {
    super(`Falha ao carregar ${section}`, { cause });
    this.name = "OpportunityLoadError";
  }
}

export const OPPORTUNITY_PAGE_SIZE = 25;

export const OPPORTUNITY_SORTS = {
  atualizacao: "Atualização mais recente",
  pontuacao: "Maior pontuação",
  empresa: "Empresa (A–Z)",
} as const;
export type OpportunitySort = keyof typeof OPPORTUNITY_SORTS;

export const opportunityListParamsSchema = z.object({
  q: z.string().max(200).optional().catch(undefined),
  status: z.string().max(60).optional().catch(undefined),
  salvas: z.enum(["1"]).optional().catch(undefined),
  ordem: z.enum(Object.keys(OPPORTUNITY_SORTS) as [OpportunitySort, ...OpportunitySort[]]).catch("atualizacao"),
  pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type OpportunityListParams = z.infer<typeof opportunityListParamsSchema>;

export type OpportunityCard = {
  id: string;
  companyId: string;
  companyName: string;
  segment: string | null;
  place: string | null;
  productName: string | null;
  status: string;
  isSaved: boolean;
  score: number | null;
  stars: number | null;
  confidence: number | null;
  isComplete: boolean | null;
  updatedAt: string;
};

const CARD_SELECT =
  "id, commercial_status, is_saved, score, confidence, score_is_complete, updated_at, company:companies!inner(id, name, normalized_name, segment, neighborhood, city), product:product_ideas(name)";

type CardRow = {
  id: string;
  commercial_status: string;
  is_saved: boolean;
  score: number | null;
  confidence: number | null;
  score_is_complete: boolean | null;
  updated_at: string;
  company: { id: string; name: string; segment: string | null; neighborhood: string | null; city: string | null };
  product: { name: string } | null;
};

function toCard(row: CardRow, config: ScoringConfig | null): OpportunityCard {
  const score = row.score === null ? null : Number(row.score);
  return {
    id: row.id,
    companyId: row.company.id,
    companyName: row.company.name,
    segment: row.company.segment,
    place: [row.company.neighborhood, row.company.city].filter(Boolean).join(", ") || null,
    productName: row.product?.name ?? null,
    status: row.commercial_status,
    isSaved: row.is_saved,
    score,
    stars: score === null || !config ? null : scoreToStars(score, config.starBands),
    confidence: row.confidence === null ? null : Number(row.confidence),
    isComplete: row.score_is_complete,
    updatedAt: row.updated_at,
  };
}

export async function loadStatuses(supabase: Client): Promise<CommercialStatus[]> {
  const { data, error } = await supabase
    .from("commercial_statuses")
    .select("key, label, position, category")
    .eq("is_active", true)
    .order("position");
  if (error) throw new OpportunityLoadError("status", error);
  return data.map((row) => ({ ...row, category: row.category as CommercialStatus["category"] }));
}

async function loadConfig(supabase: Client): Promise<ScoringConfig | null> {
  const { data, error } = await supabase.from("scoring_configs").select("config").eq("is_active", true).maybeSingle();
  if (error) throw new OpportunityLoadError("pontuação", error);
  return data ? parseScoringConfig(data.config) : null;
}

export async function listOpportunities(params: OpportunityListParams) {
  await requireActiveMember();
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("opportunities").select(CARD_SELECT, { count: "exact" });
  const term = params.q ? normalizeCompanyName(sanitizeSearchTerm(params.q)) : "";
  if (term) query = query.ilike("company.normalized_name", `%${term}%`);
  if (params.status) query = query.eq("commercial_status", params.status);
  if (params.salvas) query = query.eq("is_saved", true);
  if (params.ordem === "pontuacao") query = query.order("score", { ascending: false, nullsFirst: false });
  else if (params.ordem === "empresa") query = query.order("company(name)", { ascending: true });
  else query = query.order("updated_at", { ascending: false });

  const from = (params.pagina - 1) * OPPORTUNITY_PAGE_SIZE;
  query = query.range(from, from + OPPORTUNITY_PAGE_SIZE - 1);

  const [result, statuses, config] = await Promise.all([query, loadStatuses(supabase), loadConfig(supabase)]);
  if (result.error && result.status !== 416) throw new OpportunityLoadError("oportunidades", result.error);
  const total = result.count ?? 0;

  return {
    rows: ((result.data ?? []) as unknown as CardRow[]).map((row) => toCard(row, config)),
    total,
    page: params.pagina,
    pageCount: Math.max(1, Math.ceil(total / OPPORTUNITY_PAGE_SIZE)),
    statuses,
  };
}

/** Limite de cartões no quadro; acima disso a tela avisa e sugere a tabela. */
export const PIPELINE_LIMIT = 300;

export async function loadPipeline(options: { onlySaved: boolean }) {
  await requireActiveMember();
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("opportunities")
    .select(CARD_SELECT, { count: "exact" })
    .order("score", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(PIPELINE_LIMIT);
  if (options.onlySaved) query = query.eq("is_saved", true);

  const [result, statuses, config] = await Promise.all([query, loadStatuses(supabase), loadConfig(supabase)]);
  if (result.error) throw new OpportunityLoadError("pipeline", result.error);
  const cards = ((result.data ?? []) as unknown as CardRow[]).map((row) => toCard(row, config));

  return {
    statuses,
    columns: statuses.map((status) => ({ status, cards: cards.filter((card) => card.status === status.key) })),
    total: result.count ?? cards.length,
    truncated: (result.count ?? 0) > cards.length,
  };
}

// -----------------------------------------------------------------------------
// Detalhes
// -----------------------------------------------------------------------------

export type ScoreBreakdownItem = {
  criterion: string;
  weight: number;
  rawScore: number | null;
  weightedScore: number | null;
  informationStatus: Enums<"information_status">;
  missingData: string[];
};

const uuidSchema = z.uuid();

export async function getOpportunity(id: string) {
  await requireActiveMember();
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();

  const opportunity = await supabase
    .from("opportunities")
    .select(
      "id, commercial_status, is_saved, saved_at, score, confidence, score_version, score_is_complete, current_score_id, created_at, updated_at, created_by, company:companies!inner(id, name, segment, neighborhood, city, phone_normalized, website, website_domain), product:product_ideas(id, name, approval_status)",
    )
    .eq("id", id)
    .maybeSingle();
  if (opportunity.error) throw new OpportunityLoadError("oportunidade", opportunity.error);
  if (!opportunity.data) return null;

  const [statuses, activities, profiles, config, score] = await Promise.all([
    loadStatuses(supabase),
    supabase
      .from("commercial_activities")
      .select("id, activity_type, note, previous_status, new_status, user_id, created_at")
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("id, display_name"),
    loadConfig(supabase),
    opportunity.data.current_score_id
      ? supabase
          .from("opportunity_scores")
          .select("score, score_min, score_max, stars, confidence, is_complete, computed_at, score_version, breakdowns:score_breakdowns(criterion, weight, raw_score, weighted_score, information_status, missing_data)")
          .eq("id", opportunity.data.current_score_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (activities.error) throw new OpportunityLoadError("histórico", activities.error);
  if (profiles.error) throw new OpportunityLoadError("equipe", profiles.error);
  if (score.error) throw new OpportunityLoadError("pontuação", score.error);

  const names = new Map(profiles.data.map((row) => [row.id, row.display_name]));
  const row = opportunity.data;
  const scoreValue = row.score === null ? null : Number(row.score);

  return {
    id: row.id,
    status: row.commercial_status,
    isSaved: row.is_saved,
    savedAt: row.saved_at,
    score: scoreValue,
    stars: scoreValue === null || !config ? null : scoreToStars(scoreValue, config.starBands),
    confidence: row.confidence === null ? null : Number(row.confidence),
    scoreVersion: row.score_version,
    isComplete: row.score_is_complete,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByName: names.get(row.created_by) ?? null,
    company: row.company,
    product: row.product,
    statuses,
    scoreDetails: score.data
      ? {
          scoreMin: Number(score.data.score_min),
          scoreMax: Number(score.data.score_max),
          computedAt: score.data.computed_at,
          breakdowns: (score.data.breakdowns ?? []).map(
            (item): ScoreBreakdownItem => ({
              criterion: item.criterion,
              weight: Number(item.weight),
              rawScore: item.raw_score === null ? null : Number(item.raw_score),
              weightedScore: item.weighted_score === null ? null : Number(item.weighted_score),
              informationStatus: item.information_status,
              missingData: Array.isArray(item.missing_data) ? (item.missing_data as string[]) : [],
            }),
          ),
        }
      : null,
    activities: activities.data.map((activity) => ({
      id: activity.id,
      type: activity.activity_type,
      note: activity.note,
      previousStatus: activity.previous_status,
      newStatus: activity.new_status,
      userName: names.get(activity.user_id) ?? null,
      createdAt: activity.created_at,
    })),
  };
}

export type OpportunityDetails = NonNullable<Awaited<ReturnType<typeof getOpportunity>>>;

/** Ideias aprovadas, para associar a uma nova oportunidade. */
export async function approvedIdeas() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_ideas")
    .select("id, name")
    .eq("approval_status", "approved")
    .order("name")
    .limit(200);
  if (error) throw new OpportunityLoadError("ideias aprovadas", error);
  return data;
}
