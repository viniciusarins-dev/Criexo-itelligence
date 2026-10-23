import type { ResearchType } from "./research";

export type IdeasPromptContext = {
  researchType: ResearchType;
  query: string;
  objective: string | null;
  /** Resumo da capacidade produtiva em linguagem simples; `null` se não informada. */
  capacitySummary: string | null;
  /** Nomes de ideias já registradas, para evitar repetição. */
  existingIdeas: string[];
};

/**
 * Instruções para a IA sugerir aplicações de impressão 3D. Só leva
 * informações comerciais da CRIEXO — nunca dados pessoais ou de empresas.
 */
export function buildProductIdeasPrompt(context: IdeasPromptContext): string {
  const focus =
    context.researchType === "segment"
      ? `Segmento a investigar: ${context.query}`
      : `Produto ou aplicação a investigar: ${context.query}`;
  const lines = [
    "Você ajuda a CRIEXO Soluções Criativas, uma empresa pequena de impressão 3D em Joinville–SC,",
    "a encontrar produtos que empresas da região poderiam comprar.",
    "",
    focus,
    context.objective ? `Objetivo informado: ${context.objective}` : "Objetivo: não informado.",
    context.capacitySummary
      ? `Capacidade produtiva informada: ${context.capacitySummary}`
      : "Capacidade produtiva: ainda não informada — não presuma capacidade ilimitada.",
    context.existingIdeas.length
      ? `Ideias já registradas (não repita): ${context.existingIdeas.join("; ")}`
      : "Nenhuma ideia registrada ainda.",
    "",
    "Sugira de 3 a 6 aplicações concretas de peças impressas em 3D (suportes, organizadores, adaptadores,",
    "gabaritos, peças de reposição não críticas, expositores, acessórios ou outras).",
    "Regras:",
    "- Não afirme que o segmento precisa do produto: descreva como hipótese e liste as premissas.",
    "- Não invente números de mercado, preços, faturamento ou volumes.",
    "- Aponte dificuldades técnicas conhecidas e o que falta saber para avaliar a fabricação.",
    "- Escreva em português do Brasil.",
    "",
    "Responda somente com JSON neste formato:",
    '{"ideas":[{"name":"","problem":"","targetSegment":"","application":"","expectedBenefit":"",',
    '"assumptions":[""],"technicalDifficulties":[""],"missingInformation":[""]}]}',
  ];
  return lines.join("\n");
}
