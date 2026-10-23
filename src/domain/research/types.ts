/** Tipos de pesquisa (sem dependências: usado também no navegador). */
export const RESEARCH_TYPES = ["segment", "product"] as const;
export type ResearchType = (typeof RESEARCH_TYPES)[number];
