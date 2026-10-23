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

export type AssessmentPromptContext = {
  capacitySummary: string | null;
  /** Identificadores curtos (i1, i2…) — a IA não recebe ids internos. */
  ideas: { ref: string; name: string; problem: string | null; application: string | null; technicalConstraints: string | null }[];
  /** Só dados comerciais públicos: nome, categoria e bairro/cidade. Nada de telefone, site, CNPJ ou pessoas. */
  companies: { ref: string; name: string; segment: string | null; place: string | null }[];
};

/** Instruções para a IA avaliar cada par empresa × produto nos critérios de julgamento. */
export function buildAssessmentPrompt(context: AssessmentPromptContext): string {
  return [
    "Você ajuda a CRIEXO Soluções Criativas, uma empresa pequena de impressão 3D em Joinville–SC,",
    "a priorizar empresas para oferecer produtos impressos em 3D.",
    "",
    context.capacitySummary
      ? `Capacidade produtiva informada: ${context.capacitySummary}`
      : "Capacidade produtiva: não informada — sem ela, não avalie a viabilidade (score null).",
    "",
    "Produtos aprovados:",
    ...context.ideas.map(
      (idea) =>
        `- ${idea.ref}: ${idea.name}${idea.problem ? ` | problema: ${idea.problem}` : ""}${idea.application ? ` | aplicação: ${idea.application}` : ""}${idea.technicalConstraints ? ` | dificuldades: ${idea.technicalConstraints}` : ""}`,
    ),
    "",
    "Empresas:",
    ...context.companies.map(
      (company) => `- ${company.ref}: ${company.name}${company.segment ? ` | categoria: ${company.segment}` : ""}${company.place ? ` | local: ${company.place}` : ""}`,
    ),
    "",
    "Para cada combinação de empresa e produto, dê notas de 0 a 100:",
    "- productFit: quanto o produto resolve algo plausível para esse tipo de empresa;",
    "- feasibility: se a CRIEXO consegue fabricar e entregar com a capacidade informada (infeasible=true se impossível);",
    "- commercialPotential: chance de compra recorrente ou em volume para esse tipo de empresa.",
    "Regras:",
    "- Você só conhece o nome, a categoria e o local. Não invente porte, faturamento, clientes ou necessidades.",
    "- Se não houver base para avaliar um critério, use score null e diga o que falta em missingInformation.",
    "- Justifique cada nota em uma frase, como hipótese.",
    "- Escreva em português do Brasil.",
    "",
    "Responda somente com JSON neste formato:",
    '{"assessments":[{"company":"c1","idea":"i1","productFit":{"score":0,"justification":"","missingInformation":[]},',
    '"feasibility":{"score":0,"infeasible":false,"justification":"","missingInformation":[]},',
    '"commercialPotential":{"score":0,"justification":"","missingInformation":[]}}]}',
  ].join("\n");
}
