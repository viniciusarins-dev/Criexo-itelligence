import { describe, expect, it } from "vitest";

import { APPROVED_SCORING_CONFIG_V2, computeScore, parseScoringConfig } from "@/domain/scoring";
import { geoReferenceSchema, parseCoordinatePair, radiusKmSchema } from "@/domain/settings/geo";
import { pendingProductionItems, productionSettingsSchema, type ProductionSettings } from "@/domain/settings/production";

describe("parseCoordinatePair", () => {
  it("lê o formato copiado do Google Maps", () => {
    expect(parseCoordinatePair("-26.27052, -48.85513")).toEqual({ latitude: -26.27052, longitude: -48.85513 });
    expect(parseCoordinatePair("  -26.2 -48.8 ")).toEqual({ latitude: -26.2, longitude: -48.8 });
  });

  it("aceita vírgula decimal quando o separador é ponto e vírgula", () => {
    expect(parseCoordinatePair("-26,27; -48,85")).toEqual({ latitude: -26.27, longitude: -48.85 });
  });

  it("rejeita textos que não são um par de coordenadas válido", () => {
    expect(parseCoordinatePair("")).toBeNull();
    expect(parseCoordinatePair("Rua Landman, 147")).toBeNull();
    expect(parseCoordinatePair("-26.27")).toBeNull();
    expect(parseCoordinatePair("-95, 10")).toBeNull();
    expect(parseCoordinatePair("10, 200")).toBeNull();
  });
});

describe("configurações geográficas", () => {
  it("valida endereço e coordenadas", () => {
    expect(geoReferenceSchema.safeParse({ address: "Rua Landman, 147", latitude: -26.27, longitude: -48.85 }).success).toBe(true);
    expect(geoReferenceSchema.safeParse({ address: "  ", latitude: -26.27, longitude: -48.85 }).success).toBe(false);
  });

  it("aceita raio entre 0 e 100 km", () => {
    expect(radiusKmSchema.safeParse(10).success).toBe(true);
    expect(radiusKmSchema.safeParse(0).success).toBe(false);
    expect(radiusKmSchema.safeParse(101).success).toBe(false);
  });
});

const christian: ProductionSettings = {
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

describe("capacidade produtiva", () => {
  it("aceita as respostas do Christian e aponta o que falta confirmar", () => {
    expect(productionSettingsSchema.parse(christian)).toEqual(christian);
    expect(pendingProductionItems(christian)).toEqual([]);
    expect(
      pendingProductionItems({ ...christian, printerSchedule: null, throughput: { ...christian.throughput, printTimeBasis: null } }),
    ).toEqual(["Quando a impressora fica ligada", "Tempo de impressão: por peça ou por mesa"]);
  });

  it("lê versões gravadas antes do campo de horário da impressora", () => {
    const { printerSchedule: _schedule, printerHoursPerDay: _hours, ...older } = christian;
    void _schedule;
    void _hours;
    const parsed = productionSettingsSchema.parse(older);
    expect(parsed.printerSchedule).toBeNull();
    expect(parsed.printerHoursPerDay).toBeNull();
  });

  it("rejeita valores impossíveis", () => {
    expect(productionSettingsSchema.safeParse({ ...christian, weeklyWorkHours: 200 }).success).toBe(false);
    expect(productionSettingsSchema.safeParse({ ...christian, printerHoursPerDay: 25 }).success).toBe(false);
    expect(
      productionSettingsSchema.safeParse({ ...christian, printer: { model: "", buildVolumeCm: null } }).success,
    ).toBe(false);
  });
});

describe("pontuação v2 aprovada", () => {
  it("é válida e qualifica a partir de 60", () => {
    expect(parseScoringConfig(APPROVED_SCORING_CONFIG_V2).qualificationMinScore).toBe(60);
    const all = (raw: number) =>
      computeScore(
        {
          evaluatedAt: "2026-10-22T12:00:00Z",
          criteria: {
            product_fit: { kind: "evaluated", rawScore: raw, evidence: [] },
            feasibility: { kind: "evaluated", rawScore: raw, evidence: [] },
            proximity: { kind: "evaluated", rawScore: raw, evidence: [] },
            commercial_potential: { kind: "evaluated", rawScore: raw, evidence: [] },
          },
        },
        APPROVED_SCORING_CONFIG_V2,
        2,
      );
    expect(all(60).qualification).toBe("qualified");
    expect(all(59).qualification).toBe("not_qualified");
  });
});
