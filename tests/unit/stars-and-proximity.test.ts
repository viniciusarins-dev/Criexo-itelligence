import { describe, expect, it } from "vitest";

import {
  evaluateProximity,
  haversineDistanceKm,
  PROPOSED_SCORING_CONFIG_V1 as config,
  scoreToStars,
} from "@/domain/scoring";

describe("scoreToStars (intervalos provisórios)", () => {
  it.each([
    [0, 1],
    [19.99, 1],
    [20, 2],
    [39.99, 2],
    [40, 3],
    [59.99, 3],
    [60, 4],
    [79.99, 4],
    [80, 5],
    [100, 5],
  ])("nota %s → %s estrela(s)", (score, stars) => {
    expect(scoreToStars(score, config.starBands)).toBe(stars);
  });

  it("rejeita notas fora do intervalo", () => {
    expect(() => scoreToStars(-1, config.starBands)).toThrow(RangeError);
    expect(() => scoreToStars(100.01, config.starBands)).toThrow(RangeError);
  });
});

describe("haversineDistanceKm", () => {
  it("é zero para o mesmo ponto e simétrica", () => {
    const a = { latitude: -26.3, longitude: -48.85 };
    const b = { latitude: -26.25, longitude: -48.8 };
    expect(haversineDistanceKm(a, a)).toBe(0);
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 10);
  });

  it("calcula ~111,2 km para 1 grau de latitude", () => {
    expect(haversineDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(111.19, 1);
  });

  it("rejeita coordenadas inválidas", () => {
    expect(() => haversineDistanceKm({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 })).toThrow(RangeError);
  });
});

describe("evaluateProximity", () => {
  // Pontos arbitrários usados apenas no teste — não representam o ponto de referência real.
  const reference = { latitude: 0, longitude: 0 };
  const fiveKmNorth = { latitude: 5 / 111.19, longitude: 0 };

  it("fica desconhecida sem ponto de referência ou raio configurados (RN-04)", () => {
    const result = evaluateProximity(
      { reference: null, radiusKm: null, company: { location: fiveKmNorth, locationStatus: "confirmed" } },
      config,
    );
    expect(result.kind).toBe("unknown");
    expect(result.missingData).toHaveLength(2);
  });

  it("fica desconhecida quando a localização da empresa não é conhecida", () => {
    const result = evaluateProximity(
      { reference, radiusKm: 10, company: { location: null, locationStatus: "unknown" } },
      config,
    );
    expect(result).toEqual({ kind: "unknown", missingData: ["Localização da empresa desconhecida."] });
  });

  it("decai linearmente dentro do raio", () => {
    const result = evaluateProximity(
      { reference, radiusKm: 10, company: { location: fiveKmNorth, locationStatus: "confirmed" } },
      config,
    );
    expect(result.kind).toBe("evaluated");
    if (result.kind === "evaluated") expect(result.rawScore).toBeCloseTo(50, 0);
  });

  it("vale zero fora do raio", () => {
    const result = evaluateProximity(
      { reference, radiusKm: 3, company: { location: fiveKmNorth, locationStatus: "confirmed" } },
      config,
    );
    expect(result.kind === "evaluated" && result.rawScore).toBe(0);
  });

  it("não dá nota máxima a localização não verificada", () => {
    const result = evaluateProximity(
      { reference, radiusKm: 10, company: { location: reference, locationStatus: "source_declared" } },
      config,
    );
    expect(result.kind === "evaluated" && result.rawScore).toBe(config.proximity.unverifiedMaxScore);

    const confirmed = evaluateProximity(
      { reference, radiusKm: 10, company: { location: reference, locationStatus: "confirmed" } },
      config,
    );
    expect(confirmed.kind === "evaluated" && confirmed.rawScore).toBe(100);
  });
});
