import "server-only";

import { z } from "zod";

import { findSimilarIdeas, type ExistingIdea } from "@/domain/ideas/idea";
import { geoReferenceSchema, radiusKmSchema, type GeoReference } from "@/domain/settings/geo";
import { capacitySummary, productionSettingsSchema } from "@/domain/settings/production";
import type { Evidence } from "@/domain/types/information";
import { requireActiveMember } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums, Json } from "@/lib/supabase/types";
import { readAiConfig } from "@/server/ai/config";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export class ResearchLoadError extends Error {
  constructor(section: string, cause: unknown) {
    super(`Falha ao carregar ${section}`, { cause });
    this.name = "ResearchLoadError";
  }
}

/** Cópia das configurações vigentes, gravada na pesquisa para que continue explicável. */
export type ResearchSnapshot = {
  geoReference: GeoReference | null;
  radiusKm: number | null;
  capacitySummary: string | null;
  productionSettingsId: string | null;
  scoringVersion: number | null;
  capturedAt: string;
};

export async function currentSnapshot(supabase: Client): Promise<ResearchSnapshot> {
  const [settings, production, scoring] = await Promise.all([
    supabase.from("system_settings").select("key, value").in("key", ["geo.reference", "geo.radius_km"]),
    supabase.from("production_settings").select("id, settings").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("scoring_configs").select("version").eq("is_active", true).maybeSingle(),
  ]);
  if (settings.error) throw new ResearchLoadError("configurações", settings.error);
  if (production.error) throw new ResearchLoadError("capacidade produtiva", production.error);
  if (scoring.error) throw new ResearchLoadError("pontuação", scoring.error);

  const byKey = new Map(settings.data.map((row) => [row.key, row.value]));
  const geo = geoReferenceSchema.safeParse(byKey.get("geo.reference"));
  const radius = radiusKmSchema.safeParse(byKey.get("geo.radius_km"));
  const capacity = production.data ? productionSettingsSchema.safeParse(production.data.settings) : null;

  return {
    geoReference: geo.success ? geo.data : null,
    radiusKm: radius.success ? radius.data : null,
    capacitySummary: capacity?.success ? capacitySummary(capacity.data) : null,
    productionSettingsId: production.data?.id ?? null,
    scoringVersion: scoring.data?.version ?? null,
    capturedAt: new Date().toISOString(),
  };
}

export function parseSnapshot(value: Json): ResearchSnapshot | null {
  const schema = z.object({
    geoReference: geoReferenceSchema.nullable(),
    radiusKm: z.number().nullable(),
    capacitySummary: z.string().nullable(),
    productionSettingsId: z.string().nullable(),
    scoringVersion: z.number().nullable(),
    capturedAt: z.string(),
  });
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// -----------------------------------------------------------------------------
// IA
// -----------------------------------------------------------------------------

/** Início do dia atual em São Paulo, em ISO (para o limite diário de uso da IA). */
export function startOfDayInSaoPaulo(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  // São Paulo não tem horário de verão desde 2019: UTC−3.
  return new Date(`${parts}T00:00:00-03:00`).toISOString();
}

export type AiStatus =
  | { configured: false; missing: string[] }
  | { configured: true; provider: string; model: string; dailyLimit: number; usedToday: number };

export async function aiStatus(supabase: Client): Promise<AiStatus> {
  const config = readAiConfig();
  if (!config.ok) return { configured: false, missing: config.missing };
  const { count, error } = await supabase
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfDayInSaoPaulo(new Date()));
  if (error) throw new ResearchLoadError("uso da IA", error);
  return {
    configured: true,
    provider: config.config.provider,
    model: config.config.model,
    dailyLimit: config.config.dailyLimit,
    usedToday: count ?? 0,
  };
}

export async function loadNewResearchContext() {
  await requireActiveMember();
  const supabase = await createSupabaseServerClient();
  const [snapshot, ai] = await Promise.all([currentSnapshot(supabase), aiStatus(supabase)]);
  return { snapshot, ai };
}

// -----------------------------------------------------------------------------
// Pesquisas
// -----------------------------------------------------------------------------

export const RESEARCH_PAGE_SIZE = 20;

export async function listResearch(page: number) {
  await requireActiveMember();
  const supabase = await createSupabaseServerClient();
  const from = (page - 1) * RESEARCH_PAGE_SIZE;
  const [sessions, profiles] = await Promise.all([
    supabase
      .from("research_sessions")
      .select("id, research_type, query, status, created_at, completed_at, created_by, rerun_of, error_message", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + RESEARCH_PAGE_SIZE - 1),
    supabase.from("profiles").select("id, display_name"),
  ]);
  if (sessions.error && sessions.status !== 416) throw new ResearchLoadError("pesquisas", sessions.error);
  if (profiles.error) throw new ResearchLoadError("equipe", profiles.error);

  const ids = (sessions.data ?? []).map((row) => row.id);
  const [ideas, results, runs] = ids.length
    ? await Promise.all([
        supabase.from("product_ideas").select("research_session_id, approval_status").in("research_session_id", ids),
        supabase.from("research_session_results").select("research_session_id, company_id").in("research_session_id", ids),
        supabase.from("research_source_runs").select("research_session_id, source_name, status").in("research_session_id", ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  for (const result of [ideas, results, runs]) if (result.error) throw new ResearchLoadError("resumo das pesquisas", result.error);

  const names = new Map(profiles.data.map((row) => [row.id, row.display_name]));
  const total = sessions.count ?? 0;
  return {
    rows: (sessions.data ?? []).map((row) => {
      const sessionIdeas = (ideas.data ?? []).filter((idea) => idea.research_session_id === row.id);
      const companies = new Set((results.data ?? []).filter((result) => result.research_session_id === row.id).map((result) => result.company_id));
      return {
        id: row.id,
        researchType: row.research_type,
        query: row.query,
        status: row.status,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        createdBy: names.get(row.created_by) ?? null,
        isRerun: Boolean(row.rerun_of),
        errorMessage: row.error_message,
        approvedIdeas: sessionIdeas.filter((idea) => idea.approval_status === "approved").length,
        pendingIdeas: sessionIdeas.filter((idea) => idea.approval_status === "pending").length,
        companiesFound: companies.size,
        sources: [...new Set((runs.data ?? []).filter((run) => run.research_session_id === row.id).map((run) => run.source_name))],
      };
    }),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / RESEARCH_PAGE_SIZE)),
  };
}

export type IdeaView = {
  id: string;
  name: string;
  problemStatement: string | null;
  targetSegment: string | null;
  proposedApplication: string | null;
  expectedBenefit: string | null;
  description: string | null;
  technicalConstraints: string | null;
  missingInformation: string | null;
  evidence: Evidence[];
  origin: Enums<"idea_origin">;
  aiProvider: string | null;
  approvalStatus: Enums<"approval_status">;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  similar: { id: string; name: string; approvalStatus: ExistingIdea["approvalStatus"] }[];
};

const IDEA_SELECT =
  "id, name, problem_statement, target_segment, proposed_application, expected_benefit, description, technical_constraints, missing_information, evidence, origin, ai_provider, approval_status, decided_by, decided_at, decision_note, created_at, research_session_id";

type IdeaRow = {
  id: string;
  name: string;
  problem_statement: string | null;
  target_segment: string | null;
  proposed_application: string | null;
  expected_benefit: string | null;
  description: string | null;
  technical_constraints: string | null;
  missing_information: string | null;
  evidence: Json;
  origin: Enums<"idea_origin">;
  ai_provider: string | null;
  approval_status: Enums<"approval_status">;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
};

export function toIdeaView(row: IdeaRow, names: Map<string, string>, allIdeas: ExistingIdea[]): IdeaView {
  return {
    id: row.id,
    name: row.name,
    problemStatement: row.problem_statement,
    targetSegment: row.target_segment,
    proposedApplication: row.proposed_application,
    expectedBenefit: row.expected_benefit,
    description: row.description,
    technicalConstraints: row.technical_constraints,
    missingInformation: row.missing_information,
    evidence: Array.isArray(row.evidence) ? (row.evidence as unknown as Evidence[]) : [],
    origin: row.origin,
    aiProvider: row.ai_provider,
    approvalStatus: row.approval_status,
    decidedBy: row.decided_by ? (names.get(row.decided_by) ?? null) : null,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    similar: findSimilarIdeas(row.name, allIdeas, row.id).map(({ id, name, approvalStatus }) => ({ id, name, approvalStatus })),
  };
}

export async function allIdeaNames(supabase: Client): Promise<ExistingIdea[]> {
  const { data, error } = await supabase.from("product_ideas").select("id, name, approval_status").limit(2000);
  if (error) throw new ResearchLoadError("ideias", error);
  return data.map((row) => ({ id: row.id, name: row.name, approvalStatus: row.approval_status }));
}

/** Ideias de uma pesquisa (uma nova execução usa as ideias da pesquisa original). */
export function ideaSessionIds(session: { id: string; rerun_of: string | null }): string[] {
  return session.rerun_of ? [session.id, session.rerun_of] : [session.id];
}

const uuidSchema = z.uuid();

export async function getResearch(id: string) {
  await requireActiveMember();
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();

  const session = await supabase.from("research_sessions").select("*").eq("id", id).maybeSingle();
  if (session.error) throw new ResearchLoadError("pesquisa", session.error);
  if (!session.data) return null;

  const [ideas, runs, results, profiles, existing, ai, reruns] = await Promise.all([
    supabase.from("product_ideas").select(IDEA_SELECT).in("research_session_id", ideaSessionIds(session.data)).order("created_at"),
    supabase.from("research_source_runs").select("*").eq("research_session_id", id).order("created_at"),
    supabase
      .from("research_session_results")
      .select(
        "rank, match_reason, source_name, opportunity_id, is_new_company, possible_duplicate_url, company:companies!inner(id, name, segment, neighborhood, city), idea:product_ideas(name), opportunity:opportunities!inner(score, score_is_complete)",
      )
      .eq("research_session_id", id)
      .order("rank"),
    supabase.from("profiles").select("id, display_name"),
    allIdeaNames(supabase),
    aiStatus(supabase),
    supabase.from("research_sessions").select("id, created_at, status").eq("rerun_of", session.data.rerun_of ?? id).order("created_at"),
  ]);
  for (const result of [ideas, runs, results, profiles, reruns]) if (result.error) throw new ResearchLoadError("pesquisa", result.error);

  const names = new Map((profiles.data ?? []).map((row) => [row.id, row.display_name]));
  const distances = new Map<string, number | null>();
  const companyIds = [...new Set((results.data ?? []).map((row) => row.company.id))];
  if (companyIds.length) {
    const overview = await supabase.from("company_overview").select("id, distance_km").in("id", companyIds);
    if (overview.error) throw new ResearchLoadError("distâncias", overview.error);
    for (const row of overview.data) distances.set(row.id!, row.distance_km === null ? null : Number(row.distance_km));
  }

  // Agrupa por empresa: cada empresa aparece uma vez, com as oportunidades (produtos) ligadas a ela.
  const grouped = new Map<
    string,
    {
      rank: number;
      company: { id: string; name: string; segment: string | null; place: string | null };
      distanceKm: number | null;
      reason: string;
      source: string;
      isNewCompany: boolean;
      possibleDuplicateUrl: string | null;
      opportunities: { id: string; productName: string | null; score: number | null; isComplete: boolean }[];
    }
  >();
  for (const row of results.data ?? []) {
    const entry = grouped.get(row.company.id) ?? {
      rank: row.rank,
      company: {
        id: row.company.id,
        name: row.company.name,
        segment: row.company.segment,
        place: [row.company.neighborhood, row.company.city].filter(Boolean).join(", ") || null,
      },
      distanceKm: distances.get(row.company.id) ?? null,
      reason: row.match_reason,
      source: row.source_name,
      isNewCompany: row.is_new_company,
      possibleDuplicateUrl: row.possible_duplicate_url,
      opportunities: [],
    };
    entry.opportunities.push({
      id: row.opportunity_id,
      productName: row.idea?.name ?? null,
      score: row.opportunity.score === null ? null : Number(row.opportunity.score),
      isComplete: row.opportunity.score_is_complete ?? false,
    });
    grouped.set(row.company.id, entry);
  }

  return {
    session: session.data,
    snapshot: parseSnapshot(session.data.configuration_snapshot),
    createdByName: names.get(session.data.created_by) ?? null,
    ideas: ((ideas.data ?? []) as unknown as IdeaRow[]).map((row) => toIdeaView(row, names, existing)),
    runs: runs.data ?? [],
    results: [...grouped.values()].sort((a, b) => a.rank - b.rank),
    ai,
    reruns: (reruns.data ?? []).filter((row) => row.id !== id),
  };
}

export type ResearchDetails = NonNullable<Awaited<ReturnType<typeof getResearch>>>;

// -----------------------------------------------------------------------------
// Produtos e ideias
// -----------------------------------------------------------------------------

export async function listIdeas(filter: { status?: Enums<"approval_status"> }) {
  await requireActiveMember();
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("product_ideas").select(IDEA_SELECT).order("created_at", { ascending: false }).limit(300);
  if (filter.status) query = query.eq("approval_status", filter.status);
  const [ideas, profiles, existing, opportunities] = await Promise.all([
    query,
    supabase.from("profiles").select("id, display_name"),
    allIdeaNames(supabase),
    supabase.from("opportunities").select("product_idea_id").not("product_idea_id", "is", null).limit(5000),
  ]);
  for (const result of [ideas, profiles, opportunities]) if (result.error) throw new ResearchLoadError("ideias", result.error);
  const names = new Map((profiles.data ?? []).map((row) => [row.id, row.display_name]));
  const counts = new Map<string, number>();
  for (const row of opportunities.data ?? []) counts.set(row.product_idea_id!, (counts.get(row.product_idea_id!) ?? 0) + 1);
  return ((ideas.data ?? []) as unknown as IdeaRow[]).map((row) => ({
    ...toIdeaView(row, names, existing),
    opportunityCount: counts.get(row.id) ?? 0,
  }));
}

export async function getIdea(id: string) {
  await requireActiveMember();
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();
  const idea = await supabase.from("product_ideas").select(IDEA_SELECT).eq("id", id).maybeSingle();
  if (idea.error) throw new ResearchLoadError("ideia", idea.error);
  if (!idea.data) return null;
  const [decisions, profiles, existing, opportunities] = await Promise.all([
    supabase.from("product_idea_decisions").select("id, previous_status, new_status, decided_by, note, created_at").eq("product_idea_id", id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, display_name"),
    allIdeaNames(supabase),
    supabase
      .from("opportunities")
      .select("id, commercial_status, company:companies!inner(id, name)")
      .eq("product_idea_id", id)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);
  for (const result of [decisions, profiles, opportunities]) if (result.error) throw new ResearchLoadError("ideia", result.error);
  const names = new Map((profiles.data ?? []).map((row) => [row.id, row.display_name]));
  return {
    idea: toIdeaView(idea.data as unknown as IdeaRow, names, existing),
    researchSessionId: (idea.data as unknown as { research_session_id: string | null }).research_session_id,
    decisions: (decisions.data ?? []).map((row) => ({
      id: row.id,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      decidedBy: names.get(row.decided_by) ?? null,
      note: row.note,
      createdAt: row.created_at,
    })),
    opportunities: (opportunities.data ?? []).map((row) => ({ id: row.id, status: row.commercial_status, companyName: row.company.name })),
  };
}
