import "server-only";

import {
  funnel,
  outcomes,
  periodStart,
  sourceHealth,
  starDistribution,
  topGroups,
  type OpportunityRow,
  type ReportPeriod,
  type StatusInfo,
} from "@/domain/reports/reports";
import { scoreToStars } from "@/domain/scoring";
import { requireActiveMember } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { activeScoringConfig } from "@/server/scoring";

export class ReportLoadError extends Error {
  constructor(section: string, cause: unknown) {
    super(`Falha ao carregar ${section}`, { cause });
    this.name = "ReportLoadError";
  }
}

/** Limite de linhas lidas por relatório; acima disso o relatório avisa. */
export const REPORT_ROW_LIMIT = 5000;

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function opportunityRows(supabase: Client, since: string | null) {
  let query = supabase
    .from("opportunities")
    .select(
      "id, commercial_status, score, confidence, score_is_complete, is_saved, created_at, updated_at, company:companies!inner(id, name, cnpj, segment, neighborhood, city, state, phone_normalized, website, location_status), product:product_ideas(name)",
    )
    .order("created_at", { ascending: false })
    .limit(REPORT_ROW_LIMIT);
  if (since) query = query.gte("created_at", since);
  const [rows, scoring, statuses] = await Promise.all([
    query,
    activeScoringConfig(supabase),
    supabase.from("commercial_statuses").select("key, label, category").eq("is_active", true).order("position"),
  ]);
  if (rows.error) throw new ReportLoadError("oportunidades", rows.error);
  if (statuses.error) throw new ReportLoadError("status", statuses.error);
  const statusList = statuses.data as StatusInfo[];
  const labels = new Map(statusList.map((status) => [status.key, status.label]));
  return {
    statuses: statusList,
    truncated: rows.data.length >= REPORT_ROW_LIMIT,
    rows: rows.data.map((row) => {
      const score = row.score === null ? null : Number(row.score);
      return {
        id: row.id,
        status: row.commercial_status,
        statusLabel: labels.get(row.commercial_status) ?? row.commercial_status,
        score,
        stars: score === null || !scoring ? null : scoreToStars(score, scoring.config.starBands),
        confidence: row.confidence === null ? null : Number(row.confidence),
        isComplete: row.score_is_complete,
        isSaved: row.is_saved,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        company: row.company,
        segment: row.company.segment,
        productName: row.product?.name ?? null,
      };
    }),
  };
}

export async function loadReport(period: ReportPeriod) {
  await requireActiveMember();
  const supabase = await createSupabaseServerClient();
  const since = periodStart(period, new Date());
  let research = supabase.from("research_sessions").select("status").limit(REPORT_ROW_LIMIT);
  let runs = supabase.from("research_source_runs").select("source_name, status").limit(REPORT_ROW_LIMIT);
  let companies = supabase.from("companies").select("id", { count: "exact", head: true });
  if (since) {
    research = research.gte("created_at", since);
    runs = runs.gte("created_at", since);
    companies = companies.gte("created_at", since);
  }
  const [opportunities, sessions, sourceRuns, companyCount] = await Promise.all([opportunityRows(supabase, since), research, runs, companies]);
  if (sessions.error) throw new ReportLoadError("pesquisas", sessions.error);
  if (sourceRuns.error) throw new ReportLoadError("fontes", sourceRuns.error);
  if (companyCount.error) throw new ReportLoadError("empresas", companyCount.error);

  const rows: OpportunityRow[] = opportunities.rows;
  return {
    truncated: opportunities.truncated,
    companiesAdded: companyCount.count ?? 0,
    funnel: funnel(rows, opportunities.statuses),
    outcomes: outcomes(rows, opportunities.statuses),
    stars: starDistribution(rows),
    segments: topGroups(rows.map((row) => row.segment)),
    products: topGroups(rows.map((row) => row.productName ?? "Sem produto definido")),
    research: { total: sessions.data.length, byStatus: topGroups(sessions.data.map((row) => row.status), 10) },
    sources: sourceHealth(sourceRuns.data.map((run) => ({ source: run.source_name, status: run.status }))),
  };
}

export async function opportunitiesForExport(period: ReportPeriod) {
  await requireActiveMember();
  const supabase = await createSupabaseServerClient();
  return opportunityRows(supabase, periodStart(period, new Date()));
}

export async function companiesForExport(period: ReportPeriod) {
  await requireActiveMember();
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("company_overview")
    .select("id, name, cnpj, segment, website, phone, neighborhood, city, state, location_status, distance_km, score, commercial_status, product_name, opportunity_count, created_at")
    .order("name")
    .limit(REPORT_ROW_LIMIT);
  const since = periodStart(period, new Date());
  if (since) query = query.gte("created_at", since);
  const { data, error } = await query;
  if (error) throw new ReportLoadError("empresas", error);
  return { rows: data, truncated: data.length >= REPORT_ROW_LIMIT };
}
