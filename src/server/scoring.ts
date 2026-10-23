import "server-only";

import { computeScore, parseScoringConfig, type ScoreResult, type ScoringConfig, type ScoringInput } from "@/domain/scoring";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

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
