import { z } from "zod";

import type { Evidence } from "@/domain/types/information";

/** Nome comparável de uma ideia: sem acentos, pontuação e maiúsculas. */
export function normalizeIdeaName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "para", "e", "com", "em", "a", "o", "as", "os", "um", "uma"]);

function tokens(name: string): Set<string> {
  return new Set(normalizeIdeaName(name).split(" ").filter((token) => token.length > 1 && !STOPWORDS.has(token)));
}

/** Semelhança entre nomes (Jaccard das palavras relevantes), de 0 a 1. */
export function nameSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  return shared / (left.size + right.size - shared);
}

export const SIMILARITY_THRESHOLD = 0.6;

export type ExistingIdea = { id: string; name: string; approvalStatus: "pending" | "approved" | "rejected" };

/** Ideias parecidas já registradas (seção 4.7: sinalizar duplicidades). */
export function findSimilarIdeas(name: string, existing: ExistingIdea[], excludeId?: string): (ExistingIdea & { similarity: number })[] {
  return existing
    .filter((idea) => idea.id !== excludeId)
    .map((idea) => ({ ...idea, similarity: nameSimilarity(name, idea.name) }))
    .filter((idea) => idea.similarity >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity);
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Use no máximo ${max} caracteres.` })
    .transform((value) => (value ? value : null));

/** Ideia cadastrada manualmente. */
export const manualIdeaSchema = z.object({
  name: z.string().trim().min(2, { error: "Informe o nome da ideia." }).max(160, { error: "Use no máximo 160 caracteres." }),
  problemStatement: text(2000),
  targetSegment: text(160),
  proposedApplication: text(2000),
  expectedBenefit: text(2000),
  description: text(4000),
  technicalConstraints: text(2000),
  missingInformation: text(2000),
  /** Uma premissa ou evidência por linha. */
  evidenceLines: z.string().max(4000).transform((value) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 20),
  ),
});
export type ManualIdeaInput = z.input<typeof manualIdeaSchema>;
export type ManualIdea = z.output<typeof manualIdeaSchema>;

/** Premissas informadas por uma pessoa: declaradas, não confirmadas. */
export function manualEvidence(lines: string[], author: string, observedAt: string): Evidence[] {
  return lines.map((statement) => ({ statement, status: "source_declared", source: `Informado por ${author}`, observedAt }));
}

// -----------------------------------------------------------------------------
// Resposta da IA (validada antes de gravar; nada é aceito sem passar aqui)
// -----------------------------------------------------------------------------

const aiText = (max: number) => z.string().trim().min(1).max(max);

export const aiIdeaSchema = z.object({
  name: aiText(160),
  problem: aiText(2000),
  targetSegment: aiText(160),
  application: aiText(2000),
  expectedBenefit: aiText(2000),
  assumptions: z.array(aiText(500)).min(1).max(10),
  technicalDifficulties: z.array(aiText(500)).max(10),
  missingInformation: z.array(aiText(500)).max(10),
});

export const aiIdeasResponseSchema = z.object({ ideas: z.array(aiIdeaSchema).min(1).max(8) });
export type AiIdea = z.infer<typeof aiIdeaSchema>;

/** Premissas vindas da IA são sempre "inferência da IA" (RN-12). */
export function aiEvidence(idea: AiIdea, provider: string, observedAt: string): Evidence[] {
  return idea.assumptions.map((statement) => ({ statement, status: "ai_inference", source: `IA (${provider})`, observedAt }));
}
