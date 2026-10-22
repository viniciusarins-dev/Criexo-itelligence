import { describe, expect, it } from "vitest";

import {
  computeScore,
  parseScoringConfig,
  PROPOSED_SCORING_CONFIG_V1 as config,
  type CriterionInput,
  type ScoringInput,
} from "@/domain/scoring";

const NOW = "2026-10-01T12:00:00.000Z";
const RECENT = "2026-09-20T12:00:00.000Z";

function evaluated(rawScore: number, overrides: Partial<Extract<CriterionInput, { kind: "evaluated" }>> = {}): CriterionInput {
  return {
    kind: "evaluated",
    rawScore,
    evidence: [{ statement: "evidência", status: "confirmed", observedAt: RECENT }],
    ...overrides,
  };
}

const unknown = (reason = "sem dados"): CriterionInput => ({ kind: "unknown", missingData: [reason] });

function input(criteria: Partial<ScoringInput["criteria"]>): ScoringInput {
  return {
    evaluatedAt: NOW,
    criteria: {
      product_fit: unknown(),
      feasibility: unknown(),
      proximity: unknown(),
      commercial_potential: unknown(),
      ...criteria,
    },
  };
}

describe("computeScore", () => {
  it("calcula a média ponderada quando todos os critérios foram avaliados", () => {
    const result = computeScore(
      input({
        product_fit: evaluated(80),
        feasibility: evaluated(60),
        proximity: evaluated(100),
        commercial_potential: evaluated(50),
      }),
      config,
      1,
    );
    // 0,3·80 + 0,3·60 + 0,2·100 + 0,2·50 = 24 + 18 + 20 + 10
    expect(result.score).toBe(72);
    expect(result.scoreMin).toBe(72);
    expect(result.scoreMax).toBe(72);
    expect(result.stars).toBe(4);
    expect(result.isComplete).toBe(true);
    expect(result.coverage).toBe(1);
    expect(result.flags).toEqual([]);
    expect(result.scoreVersion).toBe(1);
  });

  it("é determinístico para a mesma entrada e versão", () => {
    const data = input({ product_fit: evaluated(70), proximity: evaluated(40) });
    expect(computeScore(data, config, 1)).toEqual(computeScore(structuredClone(data), config, 1));
  });

  it("não trata dado ausente como nota zero e mostra a faixa possível", () => {
    const result = computeScore(
      input({ product_fit: evaluated(80), feasibility: evaluated(60) }),
      config,
      1,
    );
    // Normalizado sobre 60% de peso conhecido: (24 + 18) / 0,6 = 70
    expect(result.score).toBe(70);
    expect(result.isComplete).toBe(false);
    expect(result.coverage).toBe(0.6);
    expect(result.flags).toContain("incomplete");
    // Mínimo: desconhecidos = 0 → 42; máximo: desconhecidos = 100 → 82
    expect(result.scoreMin).toBe(42);
    expect(result.scoreMax).toBe(82);
    const proximity = result.criteria.find((criterion) => criterion.criterion === "proximity");
    expect(proximity?.evaluated).toBe(false);
    expect(proximity?.informationStatus).toBe("unknown");
    expect(proximity?.missingData).toEqual(["sem dados"]);
  });

  it("retorna nota nula quando nenhum critério tem dados", () => {
    const result = computeScore(input({}), config, 1);
    expect(result.score).toBeNull();
    expect(result.stars).toBeNull();
    expect(result.flags).toContain("insufficient_data");
    expect(result.confidence).toBe(0);
    expect(result.confidenceLevel).toBe("low");
  });

  it("não deixa a proximidade compensar baixa compatibilidade (RN-09)", () => {
    const result = computeScore(
      input({
        product_fit: evaluated(20),
        feasibility: evaluated(50),
        proximity: evaluated(100),
        commercial_potential: evaluated(50),
      }),
      config,
      1,
    );
    const proximity = result.criteria.find((criterion) => criterion.criterion === "proximity");
    expect(proximity?.rawScore).toBe(100);
    expect(proximity?.effectiveScore).toBe(0);
    expect(result.flags).toContain("proximity_neutralized_low_fit");
    // 6 + 15 + 0 + 10
    expect(result.score).toBe(31);
  });

  it("com compatibilidade desconhecida, o mínimo possível não conta com a proximidade", () => {
    const result = computeScore(input({ proximity: evaluated(100) }), config, 1);
    expect(result.score).toBe(100);
    expect(result.scoreMin).toBe(0);
    expect(result.scoreMax).toBe(100);
  });

  it("aplica o teto quando um critério é bloqueante", () => {
    const result = computeScore(
      input({
        product_fit: evaluated(100),
        feasibility: evaluated(0, { blocking: true }),
        proximity: evaluated(100),
        commercial_potential: evaluated(100),
      }),
      config,
      1,
    );
    expect(result.score).toBe(config.infeasibleScoreCap);
    expect(result.scoreMax).toBe(config.infeasibleScoreCap);
    expect(result.stars).toBe(2);
    expect(result.flags).toContain("blocking_cap_applied");
  });

  it("rejeita notas fora de 0–100 e datas inválidas", () => {
    expect(() => computeScore(input({ product_fit: evaluated(101) }), config, 1)).toThrow(RangeError);
    expect(() => computeScore(input({ product_fit: evaluated(Number.NaN) }), config, 1)).toThrow(RangeError);
    expect(() => computeScore({ ...input({}), evaluatedAt: "ontem" }, config, 1)).toThrow(RangeError);
  });
});

describe("qualificação", () => {
  it("fica 'não configurada' enquanto não houver nota mínima definida", () => {
    const result = computeScore(input({ product_fit: evaluated(90) }), config, 1);
    expect(result.qualification).toBe("not_configured");
  });

  it("só qualifica quando até o mínimo possível supera a nota de corte", () => {
    const withThreshold = { ...config, qualificationMinScore: 60 };
    const complete = computeScore(
      input({
        product_fit: evaluated(80),
        feasibility: evaluated(80),
        proximity: evaluated(80),
        commercial_potential: evaluated(80),
      }),
      withThreshold,
      2,
    );
    expect(complete.qualification).toBe("qualified");

    const partial = computeScore(input({ product_fit: evaluated(90), feasibility: evaluated(90) }), withThreshold, 2);
    expect(partial.score).toBe(90);
    expect(partial.qualification).toBe("inconclusive");

    const low = computeScore(
      input({
        product_fit: evaluated(10),
        feasibility: evaluated(10),
        proximity: evaluated(10),
        commercial_potential: evaluated(10),
      }),
      withThreshold,
      2,
    );
    expect(low.qualification).toBe("not_qualified");
  });
});

describe("confiança", () => {
  it("é separada da nota e reflete a natureza das evidências", () => {
    const confirmed = computeScore(
      input({
        product_fit: evaluated(50),
        feasibility: evaluated(50),
        proximity: evaluated(50),
        commercial_potential: evaluated(50),
      }),
      config,
      1,
    );
    expect(confirmed.score).toBe(50);
    expect(confirmed.confidence).toBe(100);
    expect(confirmed.confidenceLevel).toBe("high");

    const inferred = computeScore(
      input({
        product_fit: evaluated(50, { evidence: [{ statement: "IA", status: "ai_inference", observedAt: RECENT }] }),
        feasibility: evaluated(50, { evidence: [{ statement: "IA", status: "ai_inference", observedAt: RECENT }] }),
        proximity: evaluated(50, { evidence: [{ statement: "IA", status: "ai_inference", observedAt: RECENT }] }),
        commercial_potential: evaluated(50, { evidence: [{ statement: "IA", status: "ai_inference", observedAt: RECENT }] }),
      }),
      config,
      1,
    );
    expect(inferred.score).toBe(50);
    expect(inferred.confidence).toBe(40);
    expect(inferred.confidenceLevel).toBe("medium");
  });

  it("penaliza evidências antigas ou sem data", () => {
    const old = computeScore(
      input({
        product_fit: evaluated(50, { evidence: [{ statement: "antiga", status: "confirmed", observedAt: "2025-01-01T00:00:00Z" }] }),
      }),
      config,
      1,
    );
    const undated = computeScore(
      input({ product_fit: evaluated(50, { evidence: [{ statement: "sem data", status: "confirmed" }] }) }),
      config,
      1,
    );
    // Peso 0,3 × qualidade 0,5 = 15
    expect(old.confidence).toBe(15);
    expect(undated.confidence).toBe(15);
    expect(old.criteria[0].informationStatus).toBe("confirmed");
  });

  it("critério avaliado sem evidência não gera confiança", () => {
    const result = computeScore(input({ product_fit: evaluated(90, { evidence: [] }) }), config, 1);
    expect(result.confidence).toBe(0);
    expect(result.criteria[0].informationStatus).toBe("unknown");
  });

  it("usa o status mais fraco das evidências do critério", () => {
    const result = computeScore(
      input({
        product_fit: evaluated(50, {
          evidence: [
            { statement: "a", status: "confirmed", observedAt: RECENT },
            { statement: "b", status: "ai_inference", observedAt: RECENT },
          ],
        }),
      }),
      config,
      1,
    );
    expect(result.criteria[0].informationStatus).toBe("ai_inference");
    expect(result.criteria[0].evidenceQuality).toBe(0.7);
  });
});

describe("parseScoringConfig", () => {
  it("aceita a configuração proposta v1", () => {
    expect(parseScoringConfig(config)).toEqual(config);
  });

  it("rejeita pesos que não somam 1", () => {
    expect(() =>
      parseScoringConfig({ ...config, weights: { ...config.weights, proximity: 0.5 } }),
    ).toThrow(/soma dos pesos/);
  });

  it("rejeita intervalos de estrelas fora de ordem ou que não começam em 0", () => {
    expect(() =>
      parseScoringConfig({ ...config, starBands: [{ minScore: 10, stars: 1 }] }),
    ).toThrow(/começar em 0/);
    expect(() =>
      parseScoringConfig({
        ...config,
        starBands: [
          { minScore: 0, stars: 1 },
          { minScore: 50, stars: 3 },
          { minScore: 40, stars: 4 },
        ],
      }),
    ).toThrow(/crescentes/);
  });
});
