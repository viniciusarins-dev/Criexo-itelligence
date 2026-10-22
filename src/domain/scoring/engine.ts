import type { Evidence, InformationStatus } from "@/domain/types/information";

import { SCORING_CRITERIA, type ScoringConfig, type ScoringCriterion } from "./config";
import { scoreToStars } from "./stars";

/** Resultado de um avaliador para um critério. */
export type CriterionInput =
  | {
      kind: "evaluated";
      /** Nota bruta de 0 a 100. */
      rawScore: number;
      evidence: Evidence[];
      missingData?: string[];
      /**
       * Indica que este critério, sozinho, impede a oportunidade
       * (ex.: fabricação inviável com a capacidade cadastrada).
       */
      blocking?: boolean;
      notes?: string[];
    }
  | {
      kind: "unknown";
      missingData: string[];
      evidence?: Evidence[];
      notes?: string[];
    };

export type ScoringInput = {
  criteria: Record<ScoringCriterion, CriterionInput>;
  /** Momento de referência (ISO 8601). Passado explicitamente para manter o cálculo determinístico. */
  evaluatedAt: string;
};

export type CriterionResult = {
  criterion: ScoringCriterion;
  weight: number;
  evaluated: boolean;
  rawScore: number | null;
  /** Nota usada no cálculo após regras de proteção (ex.: proximidade neutralizada). */
  effectiveScore: number | null;
  /** Contribuição em pontos para a nota máxima de 100 (peso × nota efetiva). */
  weightedScore: number | null;
  informationStatus: InformationStatus;
  /** Qualidade das evidências deste critério, de 0 a 1. */
  evidenceQuality: number;
  evidence: Evidence[];
  missingData: string[];
  notes: string[];
};

export type ScoreFlag =
  | "insufficient_data"
  | "incomplete"
  | "blocking_cap_applied"
  | "proximity_neutralized_low_fit";

export type Qualification = "not_configured" | "qualified" | "not_qualified" | "inconclusive";

export type ConfidenceLevel = "low" | "medium" | "high";

export type ScoreResult = {
  scoreVersion: number;
  /** Nota final (0–100) normalizada sobre os critérios avaliados; `null` sem dados. */
  score: number | null;
  /** Faixa possível considerando os critérios desconhecidos como 0 e 100. */
  scoreMin: number | null;
  scoreMax: number | null;
  stars: number | null;
  isComplete: boolean;
  /** Fração do peso total efetivamente avaliada (0–1). */
  coverage: number;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  qualification: Qualification;
  flags: ScoreFlag[];
  criteria: CriterionResult[];
};

const STATUS_STRENGTH: InformationStatus[] = [
  "unknown",
  "outdated",
  "ai_inference",
  "source_declared",
  "confirmed",
];

const DAY_MS = 24 * 60 * 60 * 1000;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function assertScore(criterion: ScoringCriterion, value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(`Nota inválida para ${criterion}: ${value}. Use um valor entre 0 e 100.`);
  }
}

/** Status mais fraco entre as evidências — a interface não deve parecer mais certa do que é. */
function weakestStatus(evidence: Evidence[]): InformationStatus {
  if (evidence.length === 0) return "unknown";
  return evidence.reduce<InformationStatus>((weakest, item) =>
    STATUS_STRENGTH.indexOf(item.status) < STATUS_STRENGTH.indexOf(weakest) ? item.status : weakest,
  evidence[0].status);
}

function evidenceQuality(evidence: Evidence[], config: ScoringConfig, evaluatedAtMs: number) {
  if (evidence.length === 0) return 0;
  const { statusFactors, staleAfterDays, staleFactor } = config.confidence;
  const total = evidence.reduce((sum, item) => {
    let quality = statusFactors[item.status];
    const observedMs = item.observedAt ? Date.parse(item.observedAt) : Number.NaN;
    // Sem data conhecida, a atualidade não pode ser comprovada: trata como antiga.
    const isStale =
      Number.isNaN(observedMs) || evaluatedAtMs - observedMs > staleAfterDays * DAY_MS;
    if (isStale && item.status !== "outdated") quality *= staleFactor;
    return sum + quality;
  }, 0);
  return total / evidence.length;
}

function confidenceLevel(confidence: number, config: ScoringConfig): ConfidenceLevel {
  const { lowBelow, highFrom } = config.confidence.levels;
  if (confidence < lowBelow) return "low";
  if (confidence >= highFrom) return "high";
  return "medium";
}

function qualify(
  scoreMin: number | null,
  scoreMax: number | null,
  config: ScoringConfig,
): Qualification {
  const threshold = config.qualificationMinScore;
  if (threshold === null) return "not_configured";
  if (scoreMin === null || scoreMax === null) return "inconclusive";
  if (scoreMin >= threshold) return "qualified";
  if (scoreMax < threshold) return "not_qualified";
  return "inconclusive";
}

/**
 * Calcula a pontuação explicável de uma oportunidade.
 *
 * Função pura e determinística: a mesma entrada com a mesma versão de
 * configuração sempre produz o mesmo resultado.
 */
export function computeScore(
  input: ScoringInput,
  config: ScoringConfig,
  scoreVersion: number,
): ScoreResult {
  const evaluatedAtMs = Date.parse(input.evaluatedAt);
  if (Number.isNaN(evaluatedAtMs)) {
    throw new RangeError(`Data de avaliação inválida: ${input.evaluatedAt}`);
  }

  const flags = new Set<ScoreFlag>();
  const fitInput = input.criteria.product_fit;
  const fitBlocksProximity =
    fitInput.kind === "evaluated" &&
    fitInput.rawScore < config.proximityRequiresFit.minProductFitScore;

  let knownWeight = 0;
  let unknownMaxContribution = 0;
  let weightedSum = 0;
  let proximityContribution = 0;
  let blocking = false;
  let confidenceSum = 0;

  const criteria = SCORING_CRITERIA.map((criterion): CriterionResult => {
    const item = input.criteria[criterion];
    const weight = config.weights[criterion];
    const evidence = item.evidence ?? [];
    const notes = [...(item.notes ?? [])];
    const quality = item.kind === "evaluated" ? evidenceQuality(evidence, config, evaluatedAtMs) : 0;
    confidenceSum += weight * quality;

    if (item.kind === "unknown") {
      const neutralized = criterion === "proximity" && fitBlocksProximity;
      unknownMaxContribution += neutralized ? 0 : weight * 100;
      return {
        criterion,
        weight,
        evaluated: false,
        rawScore: null,
        effectiveScore: null,
        weightedScore: null,
        informationStatus: "unknown",
        evidenceQuality: 0,
        evidence,
        missingData: item.missingData,
        notes,
      };
    }

    assertScore(criterion, item.rawScore);
    let effective = item.rawScore;
    if (criterion === "proximity" && fitBlocksProximity && effective > 0) {
      effective = 0;
      flags.add("proximity_neutralized_low_fit");
      notes.push(
        "Proximidade desconsiderada porque a compatibilidade com o produto está abaixo do mínimo configurado.",
      );
    }
    if (item.blocking) blocking = true;

    knownWeight += weight;
    weightedSum += weight * effective;
    if (criterion === "proximity") proximityContribution = weight * effective;

    return {
      criterion,
      weight,
      evaluated: true,
      rawScore: item.rawScore,
      effectiveScore: effective,
      weightedScore: round2(weight * effective),
      informationStatus: weakestStatus(evidence),
      evidenceQuality: round2(quality),
      evidence,
      missingData: item.missingData ?? [],
      notes,
    };
  });

  const totalWeight = SCORING_CRITERIA.reduce((sum, criterion) => sum + config.weights[criterion], 0);
  const coverage = totalWeight === 0 ? 0 : knownWeight / totalWeight;
  const isComplete = criteria.every((criterion) => criterion.evaluated);
  if (!isComplete) flags.add("incomplete");

  const confidence = round2(Math.min(100, Math.max(0, (confidenceSum / totalWeight) * 100)));

  if (knownWeight === 0) {
    flags.add("insufficient_data");
    return {
      scoreVersion,
      score: null,
      scoreMin: null,
      scoreMax: null,
      stars: null,
      isComplete: false,
      coverage: 0,
      confidence,
      confidenceLevel: confidenceLevel(confidence, config),
      qualification: config.qualificationMinScore === null ? "not_configured" : "inconclusive",
      flags: [...flags],
      criteria,
    };
  }

  let score = weightedSum / knownWeight;
  // Com a compatibilidade desconhecida, a proximidade pode vir a ser
  // neutralizada; o mínimo possível não conta com ela.
  const guaranteedSum =
    fitInput.kind === "unknown" ? weightedSum - proximityContribution : weightedSum;
  let scoreMin = guaranteedSum / totalWeight;
  let scoreMax = (weightedSum + unknownMaxContribution) / totalWeight;

  if (blocking) {
    const cap = config.infeasibleScoreCap;
    if (score > cap || scoreMax > cap) flags.add("blocking_cap_applied");
    score = Math.min(score, cap);
    scoreMin = Math.min(scoreMin, cap);
    scoreMax = Math.min(scoreMax, cap);
  }

  score = round2(score);
  scoreMin = round2(Math.min(scoreMin, score));
  scoreMax = round2(Math.max(scoreMax, score));

  return {
    scoreVersion,
    score,
    scoreMin,
    scoreMax,
    stars: scoreToStars(score, config.starBands),
    isComplete,
    coverage: round2(coverage),
    confidence,
    confidenceLevel: confidenceLevel(confidence, config),
    qualification: qualify(scoreMin, scoreMax, config),
    flags: [...flags],
    criteria,
  };
}
