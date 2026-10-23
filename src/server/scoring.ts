import "server-only";

import type { ProvenanceMap } from "@/domain/companies/company";
import {
  computeScore,
  evaluateProximity,
  parseScoringConfig,
  recalculationCriteria,
  type ScoreResult,
  type ScoringConfig,
  type ScoringInput,
} from "@/domain/scoring";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { currentSnapshot } from "@/server/repositories/research";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function activeScoringConfig(supabase: Client): Promise<{ version: number; config: ScoringConfig } | null> {
  const { data, error } = await supabase.from("scoring_configs").select("version, config").eq("is_active", true).maybeSingle();
  if (error) throw error;
  return data ? { version: data.version, config: parseScoringConfig(data.config) } : null;
}

/**
 * Calcula e grava uma pontuação (RN-08, RN-11): nova linha em
 * `opportunity_scores` + `score_breakdowns`; a anterior continua no histórico.
 * Sem nenhum critério avaliado não há nota a gravar (`null`).
 */
export async function scoreOpportunity(
  supabase: Client,
  opportunityId: string,
  input: ScoringInput,
  scoring: { version: number; config: ScoringConfig },
): Promise<ScoreResult | null> {
  const result = computeScore(input, scoring.config, scoring.version);
  if (result.score === null || result.scoreMin === null || result.scoreMax === null || result.stars === null) return null;

  const saved = await supabase
    .from("opportunity_scores")
    .insert({
      opportunity_id: opportunityId,
      score_version: scoring.version,
      score: result.score,
      score_min: result.scoreMin,
      score_max: result.scoreMax,
      stars: result.stars,
      confidence: result.confidence,
      is_complete: result.isComplete,
      explanation: {
        flags: result.flags,
        coverage: result.coverage,
        qualification: result.qualification,
        confidenceLevel: result.confidenceLevel,
        notes: Object.fromEntries(result.criteria.map((item) => [item.criterion, item.notes])),
      } as unknown as NonNullable<Json>,
      input_snapshot: input as unknown as NonNullable<Json>,
    })
    .select("id")
    .single();
  if (saved.error) throw saved.error;

  const breakdowns = await supabase.from("score_breakdowns").insert(
    result.criteria.map((item) => ({
      opportunity_score_id: saved.data.id,
      criterion: item.criterion,
      weight: item.weight,
      raw_score: item.rawScore,
      weighted_score: item.weightedScore,
      information_status: item.informationStatus,
      evidence: item.evidence as unknown as NonNullable<Json>,
      missing_data: item.missingData as unknown as NonNullable<Json>,
    })),
  );
  if (breakdowns.error) throw breakdowns.error;

  const updated = await supabase
    .from("opportunities")
    .update({
      current_score_id: saved.data.id,
      score: result.score,
      confidence: result.confidence,
      score_version: scoring.version,
      score_is_complete: result.isComplete,
    })
    .eq("id", opportunityId);
  if (updated.error) throw updated.error;
  return result;
}

export type RecalculationResult =
  | { ok: true; before: number | null; after: ScoreResult | null; version: number }
  | { ok: false; message: string };

/** Recalcula com a localização e a região atuais, mantendo a avaliação anterior dos demais critérios. */
export async function recalculateOpportunityScore(supabase: Client, opportunityId: string): Promise<RecalculationResult> {
  const opportunity = await supabase
    .from("opportunities")
    .select("id, score, current_score_id, company:companies!inner(latitude, longitude, location_status, field_provenance)")
    .eq("id", opportunityId)
    .maybeSingle();
  if (opportunity.error || !opportunity.data) return { ok: false, message: "Oportunidade não encontrada." };
  const scoring = await activeScoringConfig(supabase);
  if (!scoring) return { ok: false, message: "Não há configuração de pontuação ativa." };

  const previous = opportunity.data.current_score_id
    ? await supabase.from("opportunity_scores").select("input_snapshot").eq("id", opportunity.data.current_score_id).maybeSingle()
    : { data: null, error: null };
  if (previous.error) return { ok: false, message: "Não foi possível ler a pontuação anterior." };

  const region = await currentSnapshot(supabase);
  const { company } = opportunity.data;
  const provenance = (company.field_provenance ?? {}) as ProvenanceMap;
  const proximity = evaluateProximity(
    {
      reference: region.geoReference,
      radiusKm: region.radiusKm,
      company: {
        location: company.latitude === null ? null : { latitude: company.latitude, longitude: company.longitude! },
        locationStatus: company.location_status,
        locationSource: provenance.location?.source,
        locationObservedAt: provenance.location?.observedAt,
      },
    },
    scoring.config,
  );
  const input = { criteria: recalculationCriteria(previous.data?.input_snapshot ?? null, proximity), evaluatedAt: new Date().toISOString() };
  const after = await scoreOpportunity(supabase, opportunityId, input, scoring);
  return { ok: true, before: opportunity.data.score === null ? null : Number(opportunity.data.score), after, version: scoring.version };
}
