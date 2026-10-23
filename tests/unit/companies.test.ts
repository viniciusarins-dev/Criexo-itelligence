import { describe, expect, it } from "vitest";

import {
  changedIdentifiers,
  findDuplicateCandidates,
  relevantDuplicates,
  manualProvenance,
  parseCompanyInput,
  sanitizeSearchTerm,
  type CompanyDraft,
  type CompanyFormInput,
} from "@/domain/companies/company";

const empty: CompanyFormInput = {
  name: "",
  cnpj: "",
  segment: "",
  website: "",
  phone: "",
  address: "",
  neighborhood: "",
  city: "",
  state: "",
  postalCode: "",
  coordinates: "",
  locationConfirmed: false,
};

function parsed(input: Partial<CompanyFormInput>): CompanyDraft {
  const result = parseCompanyInput({ ...empty, ...input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.draft;
}

describe("parseCompanyInput", () => {
  it("normaliza um cadastro completo", () => {
    const draft = parsed({
      name: "  Oficina  Exemplo Ltda ",
      cnpj: "12.ABC.345/01DE-35",
      segment: "Oficina mecânica",
      website: "www.exemplo.com.br",
      phone: "(47) 3433-0000",
      neighborhood: "Costa e Silva",
      city: "Joinville",
      state: "sc",
      postalCode: "89218-000",
      coordinates: "-26.28, -48.87",
      locationConfirmed: true,
    });
    expect(draft).toMatchObject({
      name: "Oficina Exemplo Ltda",
      normalizedName: "oficina exemplo",
      cnpj: "12ABC34501DE35",
      website: "https://www.exemplo.com.br/",
      websiteDomain: "exemplo.com.br",
      phoneNormalized: "4734330000",
      state: "SC",
      postalCode: "89218000",
      latitude: -26.28,
      longitude: -48.87,
      locationStatus: "confirmed",
    });
  });

  it("deixa vazio como desconhecido, sem inventar valores", () => {
    const draft = parsed({ name: "Empresa" });
    expect(draft).toMatchObject({ cnpj: null, website: null, phone: null, latitude: null, locationStatus: "unknown" });
  });

  it("coordenadas sem conferência ficam como declaradas, não confirmadas", () => {
    expect(parsed({ name: "Empresa", coordinates: "-26.28, -48.87" }).locationStatus).toBe("source_declared");
  });

  it("aponta cada campo inválido", () => {
    const result = parseCompanyInput({
      ...empty,
      cnpj: "11.222.333/0001-82",
      website: "javascript:alert(1)",
      phone: "3433-0000",
      state: "XX",
      postalCode: "123",
      coordinates: "rua tal",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ["cnpj", "coordinates", "name", "phone", "postalCode", "state", "website"].sort(),
      );
    }
  });

  it("exige coordenadas para marcar a localização como conferida", () => {
    const result = parseCompanyInput({ ...empty, name: "Empresa", locationConfirmed: true });
    expect(result.ok).toBe(false);
  });
});

describe("manualProvenance", () => {
  const context = { observedAt: "2026-10-22T12:00:00.000Z", userId: "user-1" };

  it("registra origem só para campos preenchidos", () => {
    const provenance = manualProvenance(parsed({ name: "Empresa", phone: "(47) 3433-0000" }), null, context);
    expect(Object.keys(provenance).sort()).toEqual(["name", "phone"]);
    expect(provenance.phone).toEqual({ status: "confirmed", source: "Cadastro manual", observedAt: context.observedAt, by: "user-1" });
  });

  it("mantém a origem de campos que não mudaram e atualiza os alterados", () => {
    const before = parsed({ name: "Empresa", phone: "(47) 3433-0000", city: "Joinville" });
    const external = {
      name: { status: "source_declared" as const, source: "OpenStreetMap", observedAt: "2026-01-01T00:00:00.000Z" },
      phone: { status: "source_declared" as const, source: "OpenStreetMap", observedAt: "2026-01-01T00:00:00.000Z" },
      city: { status: "source_declared" as const, source: "OpenStreetMap", observedAt: "2026-01-01T00:00:00.000Z" },
    };
    const after = parsed({ name: "Empresa", phone: "(47) 3433-1111", city: "" });
    const provenance = manualProvenance(after, { draft: before, provenance: external }, context);
    expect(provenance.name?.source).toBe("OpenStreetMap");
    expect(provenance.phone?.source).toBe("Cadastro manual");
    expect(provenance.city).toBeUndefined();
  });

  it("localização herda o status de conferência", () => {
    const provenance = manualProvenance(parsed({ name: "Empresa", coordinates: "-26.2, -48.8" }), null, context);
    expect(provenance.location?.status).toBe("source_declared");
  });
});

describe("findDuplicateCandidates", () => {
  const existing = [
    { id: "a", name: "Oficina Exemplo", normalizedName: "oficina exemplo", cnpj: "11222333000181", websiteDomain: null, phoneNormalized: null, neighborhood: "Centro", city: "Joinville" },
    { id: "b", name: "Outra", normalizedName: "outra", cnpj: null, websiteDomain: "exemplo.com.br", phoneNormalized: "4734330000", neighborhood: null, city: null },
    { id: "c", name: "Sem relação", normalizedName: "sem relacao", cnpj: null, websiteDomain: null, phoneNormalized: null, neighborhood: null, city: null },
  ];

  it("CNPJ igual é duplicidade certa; outras coincidências são prováveis", () => {
    const draft = parsed({ name: "Oficina Exemplo ME", cnpj: "11.222.333/0001-81", website: "exemplo.com.br", phone: "47 3433 0000" });
    const result = findDuplicateCandidates(draft, existing);
    expect(result.map((candidate) => [candidate.id, candidate.strength, candidate.reasons])).toEqual([
      ["a", "certain", ["cnpj", "name"]],
      ["b", "probable", ["website", "phone"]],
    ]);
    expect(result[0].location).toBe("Centro, Joinville");
  });

  it("ignora a própria empresa ao editar", () => {
    const draft = parsed({ name: "Oficina Exemplo" });
    expect(findDuplicateCandidates(draft, existing, "a")).toEqual([]);
  });
});

describe("relevantDuplicates (edição)", () => {
  const existing = [
    { id: "x", name: "Filial", normalizedName: "oficina exemplo", cnpj: null, websiteDomain: "novo.com.br", phoneNormalized: null, neighborhood: null, city: null },
  ];

  it("não repete aviso de nome que não mudou; avisa sobre o site alterado", () => {
    const before = parsed({ name: "Oficina Exemplo" });
    const after = parsed({ name: "Oficina Exemplo", website: "novo.com.br" });
    const all = findDuplicateCandidates(after, existing, "self");
    expect(all[0].reasons).toEqual(["website", "name"]);
    expect(relevantDuplicates(all, changedIdentifiers(before, after))).toEqual([{ ...all[0], reasons: ["website"] }]);

    const unchanged = findDuplicateCandidates(before, existing, "self");
    expect(relevantDuplicates(unchanged, changedIdentifiers(before, before))).toEqual([]);
  });

  it("no cadastro novo, todos os avisos valem", () => {
    const draft = parsed({ name: "Oficina Exemplo" });
    const all = findDuplicateCandidates(draft, existing);
    expect(relevantDuplicates(all, null)).toEqual(all);
  });
});

describe("sanitizeSearchTerm", () => {
  it("remove caracteres especiais da sintaxe de filtros", () => {
    expect(sanitizeSearchTerm("oficina,name.eq.x)(*%")).toBe("oficina name eq x");
    expect(sanitizeSearchTerm("  auto   peças  ")).toBe("auto peças");
  });
});
