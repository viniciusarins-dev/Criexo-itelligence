import { describe, expect, it, vi } from "vitest";

import type { CompanyDraft } from "@/domain/companies/company";
import { buildAssessmentPrompt } from "@/domain/research/prompt";
import { mergeCandidates, searchTerms, stem, termMatches } from "@/domain/research/research";
import { APPROVED_SCORING_CONFIG_V2, assessmentResponseSchema, computeScore, opportunityCriteria, type CriterionInput } from "@/domain/scoring";
import { enrichFromCnpj, brasilApiCnpjSchema, titleCase } from "@/domain/sources/brasilapi";
import { geocodingQuery, pickGeocodingResult } from "@/domain/sources/geocoding";
import { buildOverpassQuery, matchOsmCandidates, osmElementToCandidate, type OsmCandidate } from "@/domain/sources/osm";

vi.mock("server-only", () => ({}));

const emptyCompany: CompanyDraft = {
  name: "Clínica Sorriso",
  normalizedName: "clinica sorriso",
  cnpj: "11222333000181",
  segment: null,
  website: null,
  websiteDomain: null,
  phone: null,
  phoneNormalized: null,
  address: null,
  neighborhood: null,
  city: "Joinville",
  state: null,
  postalCode: null,
  latitude: null,
  longitude: null,
  locationStatus: "unknown",
};

describe("correspondência de termos", () => {
  it("ignora plural, gênero, acentos e maiúsculas", () => {
    expect(stem("clinicas")).toBe(stem("clinica"));
    expect(stem("odontologicas")).toBe(stem("odontologico"));
    expect(stem("botoes")).toBe(stem("botao"));
    expect(termMatches("clínicas odontológicas", "Clínica odontológica")).toBe(true);
    expect(termMatches("oficinas mecânicas", "Oficina mecânica Silva")).toBe(true);
    expect(termMatches("oficinas mecânicas", "Oficina de costura")).toBe(false);
    expect(termMatches("pet", null)).toBe(false);
    // Uma palavra não casa com outra só por começar igual.
    expect(termMatches("segmentoe2e123", "Segmento manual")).toBe(false);
    expect(termMatches("segmento manual", "Segmentoe2e123")).toBe(false);
  });

  it("divide a pesquisa em vírgulas, ponto e vírgula, barra e “ou”", () => {
    expect(searchTerms("Dentistas, clínicas ou laboratórios", [])).toEqual(["dentistas", "clinicas", "laboratorios"]);
  });

  it("junta a mesma empresa vinda de duas fontes e mantém a correspondência mais forte", () => {
    const merged = mergeCandidates([
      { key: "a", source: "Base interna", strength: 1, distanceKm: 2, name: "A" },
      { key: "a", source: "OpenStreetMap", strength: 2, distanceKm: 2, name: "A" },
      { key: "b", source: "OpenStreetMap", strength: 2, distanceKm: 1, name: "B" },
    ]);
    expect(merged.map((item) => [item.key, item.strength, item.sources])).toEqual([
      ["b", 2, ["OpenStreetMap"]],
      ["a", 2, ["Base interna", "OpenStreetMap"]],
    ]);
  });
});

describe("OpenStreetMap", () => {
  it("monta a consulta pelo raio e recusa raio inválido", () => {
    const query = buildOverpassQuery({ latitude: -26.283, longitude: -48.877018 }, 10);
    expect(query).toContain("around:10000,-26.283000,-48.877018");
    expect(query).toContain('["name"]["shop"]');
    expect(query).toMatch(/^\[out:json\]\[timeout:25\];/);
    expect(() => buildOverpassQuery({ latitude: 0, longitude: 0 }, 0)).toThrow(RangeError);
    expect(() => buildOverpassQuery({ latitude: 0, longitude: 0 }, 80)).toThrow(RangeError);
  });

  it("converte o estabelecimento sem inventar campos", () => {
    const candidate = osmElementToCandidate({
      type: "way",
      id: 42,
      center: { lat: -26.29, lon: -48.88 },
      tags: {
        name: "Sorriso Odontologia",
        amenity: "dentist",
        "addr:street": "Rua Landmann",
        "addr:housenumber": "10",
        "addr:city": "Joinville",
        "addr:postcode": "89216-000",
        "addr:state": "sc",
        phone: "+55 47 3433-0000",
        website: "sorriso.com.br",
      },
    });
    expect(candidate).toMatchObject({
      sourceRecordId: "way/42",
      sourceUrl: "https://www.openstreetmap.org/way/42",
      name: "Sorriso Odontologia",
      segment: "Clínica odontológica",
      address: "Rua Landmann, 10",
      city: "Joinville",
      state: "SC",
      postalCode: "89216000",
      phoneNormalized: "4734330000",
      websiteDomain: "sorriso.com.br",
      neighborhood: null,
      latitude: -26.29,
      longitude: -48.88,
      locationStatus: "source_declared",
      cnpj: null,
    });
  });

  it("descarta telefone sem DDD e elementos sem nome ou posição", () => {
    expect(osmElementToCandidate({ type: "node", id: 1, lat: 1, lon: 1, tags: { name: "X", shop: "gift", phone: "3433-0000" } })).toMatchObject({ phone: null, phoneNormalized: null });
    expect(osmElementToCandidate({ type: "node", id: 2, lat: 1, lon: 1, tags: { shop: "gift" } })).toBeNull();
    expect(osmElementToCandidate({ type: "way", id: 3, tags: { name: "Sem posição", shop: "gift" } })).toBeNull();
    expect(osmElementToCandidate({ type: "x", id: 4 })).toBeNull();
  });

  it("encontra pela categoria antes do nome e não repete registros", () => {
    const base = osmElementToCandidate({ type: "node", id: 10, lat: 1, lon: 1, tags: { name: "Studio Bela", amenity: "dentist" } }) as OsmCandidate;
    const byName = osmElementToCandidate({ type: "node", id: 11, lat: 1, lon: 1, tags: { name: "Odonto Clínica Centro", office: "company" } }) as OsmCandidate;
    const other = osmElementToCandidate({ type: "node", id: 12, lat: 1, lon: 1, tags: { name: "Padaria Pão", shop: "bakery" } }) as OsmCandidate;
    const matches = matchOsmCandidates([base, base, byName, other], ["clinicas odontologicas", "odonto"]);
    expect(matches.map((match) => [match.sourceRecordId, match.strength])).toEqual([
      ["node/10", 2],
      ["node/11", 1],
    ]);
  });
});

describe("BrasilAPI", () => {
  const response = brasilApiCnpjSchema.parse({
    cnpj: "11222333000181",
    razao_social: "MARIA DA SILVA 12345678900",
    nome_fantasia: "SORRISO",
    descricao_situacao_cadastral: "BAIXADA",
    cnae_fiscal: 8630504,
    cnae_fiscal_descricao: "Atividade odontológica",
    descricao_tipo_de_logradouro: "RUA",
    logradouro: "DOUTOR JOAO COLIN",
    numero: "100",
    complemento: "",
    bairro: "CENTRO",
    municipio: "JOINVILLE",
    uf: "SC",
    cep: "89201000",
    opcao_pelo_mei: true,
    ddd_telefone_1: "4799999999",
    email: "pessoa@exemplo.com",
  });

  it("completa só campos vazios e não importa telefone nem e-mail", () => {
    const result = enrichFromCnpj(emptyCompany, response);
    expect(result.changes).toEqual({
      segment: "Atividade odontológica",
      address: "Rua Doutor Joao Colin, 100",
      neighborhood: "Centro",
      state: "SC",
      postalCode: "89201000",
    });
    expect(result.filled).not.toContain("city");
    expect(JSON.stringify(result)).not.toContain("pessoa@exemplo.com");
    expect(JSON.stringify(result)).not.toContain("4799999999");
  });

  it("omite a razão social de MEI e avisa situação diferente de ativa", () => {
    const result = enrichFromCnpj(emptyCompany, response);
    expect(result.metadata.razaoSocial).toBeNull();
    expect(result.metadata.isMei).toBe(true);
    expect(result.isActive).toBe(false);
    expect(result.metadata.cnae).toBe("8630504 — Atividade odontológica");
  });

  it("formata nomes em maiúsculas", () => {
    expect(titleCase("RUA DAS FLORES DE MAIO")).toBe("Rua das Flores de Maio");
  });
});

describe("localização pelo endereço", () => {
  it("exige endereço e cidade", () => {
    expect(geocodingQuery({ address: null, city: "Joinville", state: "SC", postalCode: null })).toBeNull();
    expect(geocodingQuery({ address: "Rua A, 1", city: "Joinville", state: "SC", postalCode: null })).toEqual({
      street: "Rua A, 1",
      city: "Joinville",
      state: "SC",
      country: "Brasil",
    });
  });

  it("aceita resultado de endereço ou rua e recusa bairro ou cidade", () => {
    expect(pickGeocodingResult([{ lat: "-26.3", lon: "-48.8", addresstype: "building" }])).toMatchObject({ ok: true, latitude: -26.3, precision: "address" });
    expect(pickGeocodingResult([{ lat: "-26.3", lon: "-48.8", addresstype: "road" }])).toMatchObject({ ok: true, precision: "street" });
    expect(pickGeocodingResult([{ lat: "-26.3", lon: "-48.8", addresstype: "suburb" }])).toEqual({ ok: false, reason: "imprecise" });
    expect(pickGeocodingResult([])).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("avaliação das oportunidades", () => {
  const proximity: CriterionInput = {
    kind: "evaluated",
    rawScore: 75,
    evidence: [{ statement: "Distância aproximada de 2 km", status: "source_declared", observedAt: "2026-10-23T00:00:00Z" }],
  };
  const assessed = (overrides: Partial<{ fit: number | null; infeasible: boolean }> = {}) => ({
    kind: "assessed" as const,
    source: "IA (gemini)",
    observedAt: "2026-10-23T00:00:00Z",
    assessment: assessmentResponseSchema.parse({
      assessments: [
        {
          company: "c1",
          idea: "i1",
          productFit: { score: overrides.fit === undefined ? 80 : overrides.fit, justification: "Clínicas usam organizadores", missingInformation: [] },
          feasibility: { score: 70, infeasible: overrides.infeasible ?? false, justification: "Peça pequena em PLA" },
          commercialPotential: { score: 50, justification: "Compra eventual", missingInformation: ["Número de consultórios"] },
        },
      ],
    }).assessments[0],
  });

  it("sem IA, os critérios de julgamento ficam desconhecidos e a nota fica incompleta", () => {
    const criteria = opportunityCriteria(proximity, { kind: "unavailable", reason: "IA não configurada." });
    expect(criteria.product_fit).toMatchObject({ kind: "unknown" });
    expect(criteria.feasibility.kind).toBe("unknown");
    const result = computeScore({ criteria, evaluatedAt: "2026-10-23T00:00:00Z" }, APPROVED_SCORING_CONFIG_V2, 2);
    expect(result.isComplete).toBe(false);
    expect(result.scoreMin).toBe(0);
  });

  it("avaliação da IA entra como inferência, com nota, justificativa e o que falta", () => {
    const criteria = opportunityCriteria(proximity, assessed());
    expect(criteria.product_fit).toMatchObject({ kind: "evaluated", rawScore: 80 });
    const fit = criteria.product_fit as Extract<CriterionInput, { kind: "evaluated" }>;
    expect(fit.evidence[0]).toMatchObject({ status: "ai_inference", source: "IA (gemini)" });
    expect(criteria.commercial_potential).toMatchObject({ missingData: ["Número de consultórios"] });
    const result = computeScore({ criteria, evaluatedAt: "2026-10-23T00:00:00Z" }, APPROVED_SCORING_CONFIG_V2, 2);
    expect(result.isComplete).toBe(true);
    expect(result.criteria.find((item) => item.criterion === "product_fit")?.informationStatus).toBe("ai_inference");
    expect(result.criteria.find((item) => item.criterion === "product_fit")?.notes).toContain("Avaliação inferida pela IA; confirme antes de usar.");
  });

  it("nota nula da IA vira desconhecido; inviável aplica o teto", () => {
    expect(opportunityCriteria(proximity, assessed({ fit: null })).product_fit.kind).toBe("unknown");
    const criteria = opportunityCriteria(proximity, assessed({ infeasible: true }));
    const result = computeScore({ criteria, evaluatedAt: "2026-10-23T00:00:00Z" }, APPROVED_SCORING_CONFIG_V2, 2);
    expect(result.score).toBeLessThanOrEqual(39);
    expect(result.flags).toContain("blocking_cap_applied");
  });

  it("instruções enviam só nome, categoria e local das empresas", () => {
    const prompt = buildAssessmentPrompt({
      capacitySummary: "impressora A1 Mini",
      ideas: [{ ref: "i1", name: "Organizador", problem: null, application: null, technicalConstraints: null }],
      companies: [{ ref: "c1", name: "Clínica Sorriso", segment: "Clínica odontológica", place: "Centro, Joinville" }],
    });
    expect(prompt).toContain("c1: Clínica Sorriso | categoria: Clínica odontológica | local: Centro, Joinville");
    expect(prompt).toContain("Não invente porte");
    expect(prompt).not.toMatch(/telefone:|site:|cnpj:/i);
  });
});

describe("adaptadores das fontes", () => {
  const reply = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

  it("Overpass: envia a consulta com identificação e converte os elementos", async () => {
    const { fetchOsmCandidates } = await import("@/server/integrations/overpass");
    const fetchImpl = reply(200, { elements: [{ type: "node", id: 5, lat: -26.28, lon: -48.87, tags: { name: "Ótica Visão", shop: "optician" } }, { type: "node", id: 6 }] });
    const result = await fetchOsmCandidates({ latitude: -26.283, longitude: -48.877 }, 10, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toMatchObject({ ok: true, ignored: 1, truncated: false });
    if (result.ok) expect(result.candidates[0].segment).toBe("Ótica");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://overpass-api.de/api/interpreter");
    expect((init.headers as Record<string, string>)["User-Agent"]).toContain("CRIEXO-Intelligence");
    expect(String(init.body)).toContain("data=");
  });

  it("Overpass: traduz limite, erro e consulta interrompida", async () => {
    const { fetchOsmCandidates } = await import("@/server/integrations/overpass");
    const center = { latitude: -26.283, longitude: -48.877 };
    expect(await fetchOsmCandidates(center, 10, { fetchImpl: reply(429, {}) as unknown as typeof fetch })).toMatchObject({ ok: false, code: "rate_limited" });
    expect(await fetchOsmCandidates(center, 10, { fetchImpl: reply(504, {}) as unknown as typeof fetch })).toMatchObject({ ok: false, code: "unavailable" });
    expect(
      await fetchOsmCandidates(center, 10, { fetchImpl: reply(200, { elements: [], remark: "runtime error: Query timed out" }) as unknown as typeof fetch }),
    ).toMatchObject({ ok: false, code: "unavailable" });
    expect(await fetchOsmCandidates(center, 10, { fetchImpl: reply(200, { nada: true }) as unknown as typeof fetch })).toMatchObject({ ok: false, code: "invalid_output" });
  });

  it("BrasilAPI: recusa CNPJ com letras sem chamar a rede e trata não encontrado", async () => {
    const { fetchCnpj } = await import("@/server/integrations/brasilapi");
    const fetchImpl = reply(404, {});
    expect(await fetchCnpj("12ABC34501DE35", { fetchImpl: fetchImpl as unknown as typeof fetch })).toMatchObject({ ok: false, code: "unsupported" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await fetchCnpj("11222333000181", { fetchImpl: fetchImpl as unknown as typeof fetch })).toMatchObject({ ok: false, code: "not_found" });
  });

  it("Nominatim: busca estruturada no Brasil", async () => {
    const { geocodeAddress } = await import("@/server/integrations/nominatim");
    const fetchImpl = reply(200, [{ lat: "-26.3", lon: "-48.84", addresstype: "building" }]);
    const result = await geocodeAddress({ street: "Rua A, 1", city: "Joinville", country: "Brasil" }, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toMatchObject({ ok: true, latitude: -26.3, longitude: -48.84 });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toContain("https://nominatim.openstreetmap.org/search?");
    expect(url).toContain("countrycodes=br");
    expect(url).toContain("street=Rua+A%2C+1");
  });
});
