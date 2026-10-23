import { z } from "zod";

import type { Evidence } from "@/domain/types/information";

import type { ScoringCriterion } from "./config";
import type { CriterionInput } from "./engine";

/**
 * Avaliação dos critérios que dependem de julgamento (compatibilidade,
 * viabilidade, potencial comercial). Só a IA os avalia nesta etapa, e sempre
 * como inferência (RN-12): confiança baixa e aviso visível. Sem avaliação, o
 * critério fica desconhecido — nunca vira zero nem nota inventada.
 */
const aiText = (max: number) => z.string().trim().min(1).max(max);

const criterionAssessmentSchema = z.object({
  score: z.number().min(0).max(100).nullable(),
  justification: aiText(600),
  missingInformation: z.array(aiText(300)).max(6).default([]),
});

export const opportunityAssessmentSchema = z.object({
  company: aiText(20),
  idea: aiText(20),
  productFit: criterionAssessmentSchema,
  feasibility: criterionAssessmentSchema.extend({ infeasible: z.boolean().default(false) }),
  commercialPotential: criterionAssessmentSchema,
});
export type OpportunityAssessment = z.output<typeof opportunityAssessmentSchema>;

export const assessmentResponseSchema = z.object({ assessments: z.array(opportunityAssessmentSchema).max(100) });

/** Máximo de pares empresa × produto avaliados numa chamada. */
export const MAX_ASSESSMENT_PAIRS = 40;

export type AssessmentAvailability =
  | { kind: "assessed"; source: string; observedAt: string; assessment: OpportunityAssessment }
  | { kind: "unavailable"; reason: string };

const JUDGED: { criterion: Exclude<ScoringCriterion, "proximity">; key: "productFit" | "feasibility" | "commercialPotential"; label: string }[] = [
  { criterion: "product_fit", key: "productFit", label: "compatibilidade com o produto" },
  { criterion: "feasibility", key: "feasibility", label: "viabilidade de fabricação e atendimento" },
  { criterion: "commercial_potential", key: "commercialPotential", label: "potencial comercial" },
];

export function opportunityCriteria(proximity: CriterionInput, availability: AssessmentAvailability): Record<ScoringCriterion, CriterionInput> {
  const criteria = { proximity } as Record<ScoringCriterion, CriterionInput>;
  for (const { criterion, key, label } of JUDGED) {
    if (availability.kind === "unavailable") {
      criteria[criterion] = { kind: "unknown", missingData: [`Avaliação de ${label} não feita: ${availability.reason}`] };
      continue;
    }
    const item = availability.assessment[key];
    const evidence: Evidence[] = [
      { statement: item.justification, status: "ai_inference", source: availability.source, observedAt: availability.observedAt },
    ];
    if (item.score === null) {
      criteria[criterion] = {
        kind: "unknown",
        missingData: item.missingInformation.length ? item.missingInformation : [`A IA não conseguiu avaliar ${label}.`],
        evidence,
      };
      continue;
    }
    criteria[criterion] = {
      kind: "evaluated",
      rawScore: Math.round(item.score * 100) / 100,
      evidence,
      missingData: item.missingInformation,
      blocking: key === "feasibility" && availability.assessment.feasibility.infeasible,
      notes: ["Avaliação inferida pela IA; confirme antes de usar."],
    };
  }
  return criteria;
}
