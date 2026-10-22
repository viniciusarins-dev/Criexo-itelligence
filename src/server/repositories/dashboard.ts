import "server-only";

import { requireActiveMember } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

export type StatusCount = {
  key: string;
  label: string;
  category: "open" | "won" | "lost";
  total: number;
};

export type RecentResearch = {
  id: string;
  query: string;
  researchType: Enums<"research_type">;
  status: Enums<"research_status">;
  createdAt: string;
};

export type RecentActivity = {
  id: string;
  type: Enums<"activity_type">;
  note: string | null;
  companyName: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  createdAt: string;
};

export type PriorityOpportunity = {
  id: string;
  companyName: string;
  segment: string | null;
  status: string;
  score: number;
  confidence: number | null;
  isComplete: boolean;
};

export type DashboardData = {
  companiesTotal: number;
  researchLast30Days: number;
  statusCounts: StatusCount[];
  /** `null` enquanto a nota mínima de qualificação não estiver configurada. */
  qualificationMinScore: number | null;
  qualifiedTotal: number | null;
  scoringConfigVersion: number | null;
  scoringConfigIsProposal: boolean;
  /** Configurações sem as quais a avaliação fica incompleta. */
  missingSettings: string[];
  recentResearch: RecentResearch[];
  recentActivity: RecentActivity[];
  priorityOpportunities: PriorityOpportunity[];
};

export class DashboardLoadError extends Error {
  constructor(public readonly section: string, cause: unknown) {
    super(`Falha ao carregar ${section}`, { cause });
    this.name = "DashboardLoadError";
  }
}

function must<T>(section: string, result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error || result.data === null || result.data === undefined) {
    throw new DashboardLoadError(section, result.error);
  }
  return result.data as NonNullable<T>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Todos os números vêm do banco, filtrados por RLS. Nenhum valor é estimado. */
export async function loadDashboard(now: Date): Promise<DashboardData> {
  await requireActiveMember();
  const supabase = await createSupabaseServerClient();
  const since = new Date(now.getTime() - 30 * DAY_MS).toISOString();

  const [companies, research30, statuses, config, research, activity, priority, settings, production] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("research_sessions").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("opportunity_status_counts").select("commercial_status, label, category, total, position").order("position"),
    supabase.from("scoring_configs").select("version, config, approval_state").eq("is_active", true).maybeSingle(),
    supabase
      .from("research_sessions")
      .select("id, query, research_type, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("commercial_activities")
      .select("id, activity_type, note, previous_status, new_status, created_at, opportunity:opportunities(company:companies(name))")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("opportunities")
      .select("id, commercial_status, score, confidence, score_is_complete, company:companies(name, segment), status:commercial_statuses(category)")
      .not("score", "is", null)
      .order("score", { ascending: false })
      .limit(20),
    supabase.from("system_settings").select("key").in("key", ["geo.reference", "geo.radius_km"]),
    supabase.from("production_settings").select("id", { count: "exact", head: true }),
  ]);

  if (companies.error) throw new DashboardLoadError("empresas", companies.error);
  if (research30.error) throw new DashboardLoadError("pesquisas", research30.error);
  if (config.error) throw new DashboardLoadError("configuração de pontuação", config.error);
  if (settings.error) throw new DashboardLoadError("configurações", settings.error);
  if (production.error) throw new DashboardLoadError("capacidade produtiva", production.error);

  const configuredKeys = new Set(settings.data.map((row) => row.key));
  const missingSettings: string[] = [];
  if (!configuredKeys.has("geo.reference") || !configuredKeys.has("geo.radius_km")) missingSettings.push("região de atuação");
  if (!production.count) missingSettings.push("capacidade produtiva");

  const activeConfig = config.data;
  const rawThreshold = (activeConfig?.config as { qualificationMinScore?: unknown } | undefined)
    ?.qualificationMinScore;
  const qualificationMinScore = typeof rawThreshold === "number" ? rawThreshold : null;

  let qualifiedTotal: number | null = null;
  if (qualificationMinScore !== null && activeConfig) {
    const qualified = await supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("score_version", activeConfig.version)
      .gte("score", qualificationMinScore);
    if (qualified.error) throw new DashboardLoadError("oportunidades qualificadas", qualified.error);
    qualifiedTotal = qualified.count ?? 0;
  }

  return {
    companiesTotal: companies.count ?? 0,
    researchLast30Days: research30.count ?? 0,
    statusCounts: must("distribuição por status", statuses).map((row) => ({
      key: row.commercial_status ?? "",
      label: row.label ?? "",
      category: (row.category ?? "open") as StatusCount["category"],
      total: row.total ?? 0,
    })),
    qualificationMinScore,
    qualifiedTotal,
    scoringConfigVersion: activeConfig?.version ?? null,
    scoringConfigIsProposal: activeConfig?.approval_state !== "approved",
    missingSettings,
    recentResearch: must("pesquisas recentes", research).map((row) => ({
      id: row.id,
      query: row.query,
      researchType: row.research_type,
      status: row.status,
      createdAt: row.created_at,
    })),
    recentActivity: must("atividade recente", activity).map((row) => ({
      id: row.id,
      type: row.activity_type,
      note: row.note,
      companyName: row.opportunity?.company?.name ?? null,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      createdAt: row.created_at,
    })),
    priorityOpportunities: must("oportunidades prioritárias", priority)
      .filter((row) => row.status?.category === "open" && row.company)
      .slice(0, 5)
      .map((row) => ({
        id: row.id,
        companyName: row.company?.name ?? "",
        segment: row.company?.segment ?? null,
        status: row.commercial_status,
        score: Number(row.score),
        confidence: row.confidence === null ? null : Number(row.confidence),
        isComplete: row.score_is_complete === true,
      })),
  };
}
