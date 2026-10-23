import { z } from "zod";

import { normalizeIdeaName } from "@/domain/ideas/idea";

export const RESEARCH_TYPES = ["segment", "product"] as const;
export type ResearchType = (typeof RESEARCH_TYPES)[number];

export const researchInputSchema = z.object({
  researchType: z.enum(RESEARCH_TYPES, { error: "Escolha o tipo de pesquisa." }),
  query: z
    .string()
    .trim()
    .min(2, { error: "Informe o segmento ou o produto." })
    .max(200, { error: "Use no máximo 200 caracteres." }),
  objective: z
    .string()
    .trim()
    .max(2000, { error: "Use no máximo 2000 caracteres." })
    .transform((value) => (value ? value : null)),
});
export type ResearchInput = z.output<typeof researchInputSchema>;

export type IdeaDecision = "pending" | "approved" | "rejected";
export type ResearchStatus =
  | "draft"
  | "awaiting_approval"
  | "ready"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

/** RN-03: a busca definitiva só começa sem ideias pendentes e com ao menos uma aprovada. */
export function canSearch(ideas: IdeaDecision[]): boolean {
  return ideas.includes("approved") && !ideas.includes("pending");
}

/**
 * Situação da pesquisa antes da busca, derivada das decisões sobre as ideias.
 * Depois da busca (running/completed/partial/failed/cancelled), não muda aqui.
 */
export function preSearchStatus(current: ResearchStatus, ideas: IdeaDecision[]): ResearchStatus {
  if (!["draft", "awaiting_approval", "ready"].includes(current)) return current;
  if (ideas.length === 0) return "draft";
  if (ideas.includes("pending")) return "awaiting_approval";
  return ideas.includes("approved") ? "ready" : "awaiting_approval";
}

/** RN-07: entre 5 e 10 empresas por pesquisa, sem completar com irrelevantes. */
export const RESULT_TARGET = { min: 5, max: 10 } as const;

export function searchOutcome(found: number, failedSources: number, totalSources: number): ResearchStatus {
  if (totalSources > 0 && failedSources === totalSources) return "failed";
  if (found < RESULT_TARGET.min || failedSources > 0) return "partial";
  return "completed";
}

/** Termos de busca: o texto da pesquisa e os segmentos das ideias aprovadas. */
export function searchTerms(query: string, approvedSegments: (string | null)[]): string[] {
  const terms = [query, ...approvedSegments.filter((segment): segment is string => Boolean(segment))]
    .map((term) => normalizeIdeaName(term))
    .filter((term) => term.length >= 3);
  return [...new Set(terms)];
}

export type CandidateCompany = {
  id: string;
  name: string;
  segment: string | null;
  distanceKm: number | null;
};

export type RankedMatch = CandidateCompany & { reason: string; strength: number };

/**
 * Seleciona empresas da base interna cujo segmento ou nome contém algum termo.
 * Segmento vale mais que nome; empate desfeito pela distância conhecida
 * (desconhecida fica por último, sem ser tratada como longe ou perto).
 */
export function rankInternalMatches(companies: CandidateCompany[], terms: string[], limit: number = RESULT_TARGET.max): RankedMatch[] {
  if (terms.length === 0) return [];
  const ranked: RankedMatch[] = [];
  for (const company of companies) {
    const segment = company.segment ? normalizeIdeaName(company.segment) : "";
    const name = normalizeIdeaName(company.name);
    const segmentTerm = terms.find((term) => segment.includes(term) || (segment.length >= 3 && term.includes(segment)));
    const nameTerm = segmentTerm ? undefined : terms.find((term) => name.includes(term));
    if (!segmentTerm && !nameTerm) continue;
    ranked.push({
      ...company,
      strength: segmentTerm ? 2 : 1,
      reason: segmentTerm ? `Segmento “${company.segment}” corresponde à pesquisa` : `Nome da empresa contém “${nameTerm}”`,
    });
  }
  return ranked
    .sort(
      (a, b) =>
        b.strength - a.strength ||
        (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) ||
        a.name.localeCompare(b.name, "pt-BR"),
    )
    .slice(0, limit);
}
