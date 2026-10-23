import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { compareDuplicate } from "@/domain/companies/duplicates";
import { recalculationCriteria, type CriterionInput } from "@/domain/scoring";
import { estabelecimentoToCompany, findMunicipioCode, parseCodeTable, parseReceitaLine } from "@/domain/sources/receita";

const fixture = (name: string) => readFileSync(new URL(`../fixtures/receita/${name}`, import.meta.url)).toString("latin1").split("\n").filter(Boolean);

describe("dados abertos do CNPJ", () => {
  const municipios = parseCodeTable(fixture("Municipios.csv"));
  const cnaes = parseCodeTable(fixture("Cnaes.csv"));
  const filter = { municipioCodes: findMunicipioCode(municipios, "Joinville"), uf: "SC", cnaePrefixes: [] };
  const rows = fixture("Estabelecimentos0.csv").map(parseReceitaLine);

  it("lê campos entre aspas, com ponto e vírgula e aspas dobradas", () => {
    expect(parseReceitaLine('"a";"b;c";"d ""x"""')).toEqual(["a", "b;c", 'd "x"']);
    expect(findMunicipioCode(municipios, "joinville")).toEqual(["0001"]);
    expect(cnaes.get("4774100")).toBe("Comércio varejista de artigos de óptica");
  });

  it("importa só ativo, do município, com nome fantasia; sem telefone nem e-mail", () => {
    const results = rows.map((fields) => estabelecimentoToCompany(fields, filter, { cnaes, cityName: "JOINVILLE" }));
    expect(results.map((result) => (result.ok ? "ok" : result.reason))).toEqual(["ok", "no_trade_name", "inactive", "other_place"]);
    const first = results[0];
    expect(first.ok && first.company).toEqual({
      cnpj: "11222333000181",
      name: "Ótica Visão",
      normalizedName: "otica visao",
      segment: "Comércio varejista de artigos de óptica",
      address: "Rua das Flores, 12, Sala 2",
      neighborhood: "Costa e Silva",
      city: "Joinville",
      state: "SC",
      postalCode: "89218000",
      metadata: { cnae: "4774100", situacao: "ATIVA", inicioAtividade: "10/03/2015", matriz: true },
    });
    expect(JSON.stringify(results)).not.toMatch(/34330000|pessoa@exemplo/);
  });

  it("filtra por CNAE e recusa linha incompleta", () => {
    expect(estabelecimentoToCompany(rows[0], { ...filter, cnaePrefixes: ["86"] }, { cnaes, cityName: "Joinville" })).toEqual({ ok: false, reason: "cnae_filtered" });
    expect(estabelecimentoToCompany(["1", "2"], filter, { cnaes, cityName: "Joinville" })).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("revisão de duplicidade", () => {
  it("mostra o que é igual e o que seria completado, sem trocar o nome", () => {
    const rows = compareDuplicate(
      { name: "Ótica Visão", segment: null, website: null, phone_normalized: "4734330000", address: null, neighborhood: null, city: "Joinville", state: "SC", postal_code: null, latitude: null, longitude: null },
      { name: "OTICA VISAO", segment: "Ótica", phone_normalized: "4734330000", city: "Araquari", latitude: -26.3, longitude: -48.84 },
    );
    const byField = Object.fromEntries(rows.map((row) => [row.field, row]));
    expect(byField.name).toMatchObject({ same: true, wouldFill: false });
    expect(byField.phone_normalized).toMatchObject({ same: true, existing: "(47) 3433-0000" });
    expect(byField.segment).toMatchObject({ wouldFill: true });
    expect(byField.city).toMatchObject({ same: false, wouldFill: false });
    expect(byField.location).toMatchObject({ wouldFill: true, candidate: "-26.30000, -48.84000" });
  });
});

describe("recálculo da pontuação", () => {
  const proximity: CriterionInput = { kind: "evaluated", rawScore: 100, evidence: [{ statement: "0,1 km", status: "confirmed" }] };

  it("reaproveita a avaliação anterior e troca só a proximidade", () => {
    const previous = {
      criteria: {
        product_fit: { kind: "evaluated", rawScore: 80, evidence: [{ statement: "IA", status: "ai_inference" }] },
        feasibility: { kind: "unknown", missingData: ["Sem capacidade"] },
        proximity: { kind: "evaluated", rawScore: 75, evidence: [] },
        commercial_potential: { kind: "evaluated", rawScore: 500, evidence: [] },
      },
    };
    const criteria = recalculationCriteria(previous, proximity);
    expect(criteria.proximity).toBe(proximity);
    expect(criteria.product_fit).toMatchObject({ kind: "evaluated", rawScore: 80 });
    expect(criteria.feasibility).toEqual({ kind: "unknown", missingData: ["Sem capacidade"] });
    // Valor inválido na pontuação anterior não é aproveitado.
    expect(criteria.commercial_potential.kind).toBe("unknown");
  });

  it("sem pontuação anterior, os critérios de julgamento ficam desconhecidos", () => {
    const criteria = recalculationCriteria(null, proximity);
    expect(criteria.product_fit).toEqual({ kind: "unknown", missingData: ["Avaliação de compatibilidade com o produto ainda não feita."] });
  });
});
