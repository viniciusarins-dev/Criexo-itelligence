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

/** Termos de busca: o texto da pesquisa (dividido em vírgulas, ";", "/" e " ou ") e os segmentos das ideias aprovadas. */
export function searchTerms(query: string, approvedSegments: (string | null)[]): string[] {
  const parts = [query, ...approvedSegments.filter((segment): segment is string => Boolean(segment))].flatMap((text) =>
    text.split(/[,;/]|\s+ou\s+/i),
  );
  const terms = parts.map((term) => normalizeIdeaName(term)).filter((term) => term.length >= 3);
  return [...new Set(terms)];
}

const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "para", "e", "com", "em", "a", "o", "as", "os", "um", "uma", "no", "na", "nos", "nas"]);

/** Radical simples em português: singular e sem a vogal final de gênero (clínicas → clinic). */
export function stem(token: string): string {
  let word = token;
  if (word.length > 4) {
    if (/(oes|aes)$/.test(word)) word = `${word.slice(0, -3)}ao`;
    else if (word.endsWith("ais")) word = `${word.slice(0, -3)}al`;
    else if (word.endsWith("eis")) word = `${word.slice(0, -3)}el`;
    else if (/(res|zes)$/.test(word)) word = word.slice(0, -2);
    else if (word.endsWith("ns")) word = `${word.slice(0, -2)}m`;
    else if (word.endsWith("s")) word = word.slice(0, -1);
  } else if (word.length > 3 && word.endsWith("s")) word = word.slice(0, -1);
  if (word.length > 4 && /[ao]$/.test(word)) word = word.slice(0, -1);
  return word;
}

function stems(text: string): string[] {
  return normalizeIdeaName(text)
    .split(" ")
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    .map(stem);
}

function sameStem(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  // Só variações curtas da mesma palavra (ex.: "odontologic" × "odontologi"), nunca uma palavra dentro de outra maior.
  return short.length >= 5 && long.length - short.length <= 2 && long.startsWith(short);
}

/**
 * Um termo corresponde a um texto quando todas as palavras relevantes do termo
 * aparecem no texto, sem diferenciar plural, gênero, acentos ou maiúsculas.
 */
export function termMatches(term: string, text: string | null | undefined): boolean {
  if (!text) return false;
  const wanted = stems(term);
  if (wanted.length === 0) return false;
  const available = stems(text);
  return wanted.every((word) => available.some((candidate) => sameStem(word, candidate)));
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
    const segmentTerm = terms.find(
      (term) => termMatches(term, company.segment) || (company.segment ? termMatches(company.segment, term) : false),
    );
    const nameTerm = segmentTerm ? undefined : terms.find((term) => termMatches(term, company.name));
    if (!segmentTerm && !nameTerm) continue;
    ranked.push({
      ...company,
      strength: segmentTerm ? 2 : 1,
      reason: segmentTerm ? `Segmento “${company.segment}” corresponde à pesquisa` : `Nome da empresa contém “${nameTerm}”`,
    });
  }
  return rankCandidates(ranked, limit);
}

type Rankable = { strength: number; distanceKm: number | null; name: string };

/** Ordena por força da correspondência, depois distância conhecida, depois nome; corta no limite. */
export function rankCandidates<T extends Rankable>(items: T[], limit: number = RESULT_TARGET.max): T[] {
  return [...items]
    .sort(
      (a, b) =>
        b.strength - a.strength ||
        (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) ||
        a.name.localeCompare(b.name, "pt-BR"),
    )
    .slice(0, limit);
}

/**
 * Junta candidatos de várias fontes: a mesma empresa (mesma chave) aparece
 * uma vez, com a correspondência mais forte; as fontes ficam registradas.
 */
export function mergeCandidates<T extends Rankable & { key: string; source: string }>(
  items: T[],
  limit: number = RESULT_TARGET.max,
): (T & { sources: string[] })[] {
  const byKey = new Map<string, T & { sources: string[] }>();
  for (const item of items) {
    const current = byKey.get(item.key);
    if (!current) {
      byKey.set(item.key, { ...item, sources: [item.source] });
      continue;
    }
    const sources = current.sources.includes(item.source) ? current.sources : [...current.sources, item.source];
    byKey.set(item.key, item.strength > current.strength ? { ...item, sources } : { ...current, sources });
  }
  return rankCandidates([...byKey.values()], limit);
}
