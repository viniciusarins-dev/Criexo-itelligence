import { describe, expect, it, vi } from "vitest";

import { findSimilarIdeas, manualIdeaSchema, nameSimilarity, normalizeIdeaName } from "@/domain/ideas/idea";
import { buildProductIdeasPrompt } from "@/domain/research/prompt";
import {
  canSearch,
  preSearchStatus,
  rankInternalMatches,
  researchInputSchema,
  searchOutcome,
  searchTerms,
} from "@/domain/research/research";
import { capacitySummary, type ProductionSettings } from "@/domain/settings/production";
import { extractJson, generateIdeasWithGemini } from "@/server/ai/gemini";

describe("pesquisa", () => {
  it("valida o tipo e o termo", () => {
    expect(researchInputSchema.safeParse({ researchType: "segment", query: "Oficinas", objective: "" }).success).toBe(true);
    expect(researchInputSchema.safeParse({ researchType: "outro", query: "Oficinas", objective: "" }).success).toBe(false);
    expect(researchInputSchema.safeParse({ researchType: "product", query: "x", objective: "" }).success).toBe(false);
  });

  it("só permite buscar com ideia aprovada e nenhuma pendente (RN-03)", () => {
    expect(canSearch([])).toBe(false);
    expect(canSearch(["approved", "pending"])).toBe(false);
    expect(canSearch(["rejected"])).toBe(false);
    expect(canSearch(["approved", "rejected"])).toBe(true);
  });

  it("deriva a situação antes da busca e não mexe depois dela", () => {
    expect(preSearchStatus("draft", [])).toBe("draft");
    expect(preSearchStatus("draft", ["pending"])).toBe("awaiting_approval");
    expect(preSearchStatus("awaiting_approval", ["approved"])).toBe("ready");
    expect(preSearchStatus("awaiting_approval", ["rejected"])).toBe("awaiting_approval");
    expect(preSearchStatus("completed", ["pending"])).toBe("completed");
  });

  it("resultado parcial com menos de 5 empresas ou fonte com falha (RN-07)", () => {
    expect(searchOutcome(7, 0, 1)).toBe("completed");
    expect(searchOutcome(3, 0, 1)).toBe("partial");
    expect(searchOutcome(8, 1, 2)).toBe("partial");
    expect(searchOutcome(0, 1, 1)).toBe("failed");
  });

  it("monta termos sem repetição", () => {
    expect(searchTerms("Oficinas mecânicas", ["Oficina mecânica", null, "oficinas mecanicas", "TI"])).toEqual([
      "oficinas mecanicas",
      "oficina mecanica",
    ]);
  });
});

describe("rankInternalMatches", () => {
  const companies = [
    { id: "1", name: "Auto Center Sul", segment: "Oficina mecânica", distanceKm: 6 },
    { id: "2", name: "Oficina do Zé", segment: null, distanceKm: 1 },
    { id: "3", name: "Mecânica Rápida", segment: "Oficina mecânica", distanceKm: 2 },
    { id: "4", name: "Padaria", segment: "Alimentação", distanceKm: 0.5 },
    { id: "5", name: "Oficina Sem Local", segment: "Oficina mecânica", distanceKm: null },
  ];

  it("prioriza segmento, depois distância conhecida; não completa com irrelevantes", () => {
    const result = rankInternalMatches(companies, ["oficina mecanica", "oficina"]);
    expect(result.map((company) => company.id)).toEqual(["3", "1", "5", "2"]);
    expect(result[0].reason).toContain("Segmento");
    expect(result[3].reason).toContain("Nome da empresa");
  });

  it("respeita o limite de 10 e não encontra nada sem termos", () => {
    const many = Array.from({ length: 15 }, (_, index) => ({ id: String(index), name: `Oficina ${index}`, segment: "Oficina", distanceKm: index }));
    expect(rankInternalMatches(many, ["oficina"])).toHaveLength(10);
    expect(rankInternalMatches(companies, [])).toEqual([]);
  });
});

describe("ideias", () => {
  it("normaliza e mede semelhança entre nomes", () => {
    expect(normalizeIdeaName("Suporte p/ Ferramentas!")).toBe("suporte p ferramentas");
    expect(nameSimilarity("Suporte de ferramentas", "Suporte para ferramentas")).toBe(1);
    expect(nameSimilarity("Suporte de ferramentas", "Gabarito de furação")).toBe(0);
  });

  it("aponta ideias parecidas já registradas", () => {
    const existing = [
      { id: "a", name: "Suporte de ferramentas de parede", approvalStatus: "approved" as const },
      { id: "b", name: "Expositor de balcão", approvalStatus: "rejected" as const },
    ];
    expect(findSimilarIdeas("Suporte para ferramentas na parede", existing).map((idea) => idea.id)).toEqual(["a"]);
    expect(findSimilarIdeas("Suporte para ferramentas na parede", existing, "a")).toEqual([]);
  });

  it("valida a ideia manual e separa premissas por linha", () => {
    const parsed = manualIdeaSchema.parse({
      name: "Suporte",
      problemStatement: "",
      targetSegment: "Oficinas",
      proposedApplication: "",
      expectedBenefit: "",
      description: "",
      technicalConstraints: "",
      missingInformation: "",
      evidenceLines: "Oficinas usam muitas ferramentas\n\n  Falta espaço na bancada  ",
    });
    expect(parsed.evidenceLines).toEqual(["Oficinas usam muitas ferramentas", "Falta espaço na bancada"]);
    expect(parsed.problemStatement).toBeNull();
  });
});

describe("instruções para a IA", () => {
  const settings: ProductionSettings = {
    schemaVersion: 1,
    printer: { model: "Bambu A1 Mini", buildVolumeCm: { x: 18, y: 18, z: 18 } },
    materials: ["PLA"],
    modularAssembly: true,
    modeling: "simple_only",
    weeklyWorkHours: 30,
    printerSchedule: "work_hours",
    printerHoursPerDay: 9.5,
    standardLeadTimeDays: 3,
    customProjectsRequireEvaluation: true,
    throughput: {
      smallPartLimit: { value: 8, unit: "cm_per_side" },
      printTimeBasis: "per_part",
      smallPartsPerDay: { under_1h: 32, "1_to_5h": 16, "5h_or_more": 12 },
      largePartsOnePerPrint: true,
      multiplePartsPerPlate: true,
    },
    notes: "",
  };

  it("resume só o que foi informado", () => {
    const summary = capacitySummary(settings);
    expect(summary).toContain("Bambu A1 Mini");
    expect(summary).toContain("18 × 18 × 18 cm");
    expect(summary).toContain("32 por dia");
  });

  it("inclui o foco da pesquisa e as regras contra inventar dados", () => {
    const prompt = buildProductIdeasPrompt({
      researchType: "segment",
      query: "Oficinas mecânicas",
      objective: null,
      capacitySummary: null,
      existingIdeas: ["Suporte de ferramentas"],
    });
    expect(prompt).toContain("Segmento a investigar: Oficinas mecânicas");
    expect(prompt).toContain("não presuma capacidade ilimitada");
    expect(prompt).toContain("Não invente números");
    expect(prompt).toContain("Suporte de ferramentas");
  });
});

describe("adaptador do Gemini", () => {
  const validIdeas = {
    ideas: [
      {
        name: "Suporte de ferramentas",
        problem: "Ferramentas espalhadas na bancada",
        targetSegment: "Oficinas mecânicas",
        application: "Suporte de parede",
        expectedBenefit: "Organização",
        assumptions: ["Oficinas usam muitas ferramentas manuais"],
        technicalDifficulties: [],
        missingInformation: ["Medidas das ferramentas"],
      },
    ],
  };
  const reply = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  const options = (fetchImpl: typeof fetch) => ({ apiKey: "chave-de-teste-123", model: "modelo-teste", fetchImpl });

  it("aceita resposta válida e envia a chave só no cabeçalho", async () => {
    const fetchImpl = reply(200, { candidates: [{ content: { parts: [{ text: "```json\n" + JSON.stringify(validIdeas) + "\n```" }] } }] });
    const result = await generateIdeasWithGemini("prompt", options(fetchImpl as unknown as typeof fetch));
    expect(result).toEqual({ ok: true, ideas: validIdeas.ideas });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/modelo-teste:generateContent");
    expect(url).not.toContain("chave-de-teste");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("chave-de-teste-123");
  });

  it("recusa resposta fora do formato", async () => {
    const fetchImpl = reply(200, { candidates: [{ content: { parts: [{ text: '{"ideas":[{"name":"só nome"}]}' }] } }] });
    const result = await generateIdeasWithGemini("prompt", options(fetchImpl as unknown as typeof fetch));
    expect(result).toMatchObject({ ok: false, code: "invalid_output" });
  });

  it("traduz erros de chave, limite e indisponibilidade", async () => {
    for (const [status, code] of [
      [403, "unauthorized"],
      [429, "rate_limited"],
      [500, "unavailable"],
    ] as const) {
      const result = await generateIdeasWithGemini("prompt", options(reply(status, {}) as unknown as typeof fetch));
      expect(result).toMatchObject({ ok: false, code });
    }
  });

  it("trata bloqueio e tempo esgotado", async () => {
    const blocked = await generateIdeasWithGemini("prompt", options(reply(200, { promptFeedback: { blockReason: "SAFETY" } }) as unknown as typeof fetch));
    expect(blocked).toMatchObject({ ok: false, code: "blocked" });
    const slow = vi.fn(async () => {
      throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    });
    const timeout = await generateIdeasWithGemini("prompt", options(slow as unknown as typeof fetch));
    expect(timeout).toMatchObject({ ok: false, code: "timeout" });
  });

  it("extrai JSON cercado por texto", () => {
    expect(extractJson('Aqui está: {"a":1} pronto')).toEqual({ a: 1 });
    expect(extractJson("sem json")).toBeUndefined();
  });
});
