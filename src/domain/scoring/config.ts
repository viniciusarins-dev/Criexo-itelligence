import { z } from "zod";

import { INFORMATION_STATUSES } from "@/domain/types/information";

export const SCORING_CRITERIA = [
  "product_fit",
  "feasibility",
  "proximity",
  "commercial_potential",
] as const;

export type ScoringCriterion = (typeof SCORING_CRITERIA)[number];

export const SCORING_CRITERION_LABELS: Record<ScoringCriterion, string> = {
  product_fit: "Compatibilidade com o produto aprovado",
  feasibility: "Viabilidade de atendimento",
  proximity: "Proximidade geográfica",
  commercial_potential: "Potencial comercial",
};

const WEIGHT_SUM_TOLERANCE = 1e-6;

const scoreValue = z.number().min(0).max(100);
const factor = z.number().min(0).max(1);

const starBandSchema = z.object({
  minScore: scoreValue,
  stars: z.number().int().min(1).max(5),
});

/**
 * Configuração de pontuação, armazenada em `scoring_configs.config`.
 * Cada versão é imutável: alterar um peso exige criar uma nova versão.
 */
export const scoringConfigSchema = z
  .object({
    weights: z.object({
      product_fit: factor,
      feasibility: factor,
      proximity: factor,
      commercial_potential: factor,
    }),
    starBands: z.array(starBandSchema).min(1),
    /** Nota mínima de qualificação; `null` = ainda não definida pelo negócio. */
    qualificationMinScore: scoreValue.nullable(),
    /**
     * Estratégia para critérios sem dados (seção 6.5):
     * a nota é normalizada sobre os critérios avaliados e acompanhada de uma
     * faixa [mínimo, máximo] que mostra o efeito dos critérios desconhecidos.
     * Ausência de dado não vira nota zero nem é escondida.
     */
    missingDataStrategy: z.literal("normalize_known_with_range"),
    proximity: z.object({
      curve: z.literal("linear_within_radius"),
      /** Teto da nota de proximidade quando a localização não foi confirmada. */
      unverifiedMaxScore: scoreValue,
    }),
    /** RN-09: proximidade não compensa falta de compatibilidade. */
    proximityRequiresFit: z.object({ minProductFitScore: scoreValue }),
    /** Teto da nota final quando algum critério é bloqueante (ex.: inviável). */
    infeasibleScoreCap: scoreValue,
    confidence: z.object({
      statusFactors: z.object(
        Object.fromEntries(INFORMATION_STATUSES.map((status) => [status, factor])) as Record<
          (typeof INFORMATION_STATUSES)[number],
          typeof factor
        >,
      ),
      staleAfterDays: z.number().int().positive(),
      staleFactor: factor,
      levels: z.object({ lowBelow: scoreValue, highFrom: scoreValue }),
    }),
  })
  .superRefine((config, ctx) => {
    const sum = Object.values(config.weights).reduce((total, weight) => total + weight, 0);
    if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
      ctx.addIssue({
        code: "custom",
        path: ["weights"],
        message: `A soma dos pesos deve ser 1 (atual: ${sum.toFixed(4)}).`,
      });
    }

    const bands = config.starBands;
    if (bands[0]?.minScore !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["starBands"],
        message: "O primeiro intervalo de estrelas deve começar em 0.",
      });
    }
    for (let i = 1; i < bands.length; i++) {
      if (bands[i].minScore <= bands[i - 1].minScore || bands[i].stars <= bands[i - 1].stars) {
        ctx.addIssue({
          code: "custom",
          path: ["starBands", i],
          message: "Os intervalos de estrelas devem ser crescentes.",
        });
      }
    }

    if (config.confidence.levels.lowBelow > config.confidence.levels.highFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["confidence", "levels"],
        message: "O limite de confiança baixa não pode superar o de confiança alta.",
      });
    }
  });

export type ScoringConfig = z.infer<typeof scoringConfigSchema>;

export type VersionedScoringConfig = {
  version: number;
  approvalState: "proposal" | "approved";
  config: ScoringConfig;
};

/**
 * Versão 1, PROPOSTA (não aprovada). Espelha o registro inserido pela
 * migration inicial em `scoring_configs`; o banco é a fonte de verdade.
 */
export const PROPOSED_SCORING_CONFIG_V1: ScoringConfig = {
  weights: { product_fit: 0.3, feasibility: 0.3, proximity: 0.2, commercial_potential: 0.2 },
  starBands: [
    { minScore: 0, stars: 1 },
    { minScore: 20, stars: 2 },
    { minScore: 40, stars: 3 },
    { minScore: 60, stars: 4 },
    { minScore: 80, stars: 5 },
  ],
  qualificationMinScore: null,
  missingDataStrategy: "normalize_known_with_range",
  proximity: { curve: "linear_within_radius", unverifiedMaxScore: 75 },
  proximityRequiresFit: { minProductFitScore: 40 },
  infeasibleScoreCap: 39,
  confidence: {
    statusFactors: {
      confirmed: 1,
      source_declared: 0.7,
      ai_inference: 0.4,
      outdated: 0.3,
      unknown: 0,
    },
    staleAfterDays: 180,
    staleFactor: 0.5,
    levels: { lowBelow: 40, highFrom: 70 },
  },
};

export function parseScoringConfig(value: unknown): ScoringConfig {
  return scoringConfigSchema.parse(value);
}
