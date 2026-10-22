import type { InformationStatus } from "@/domain/types/information";

import type { ScoringConfig } from "./config";
import type { CriterionInput } from "./engine";

export type GeoPoint = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function assertPoint(point: GeoPoint) {
  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    Math.abs(point.latitude) > 90 ||
    Math.abs(point.longitude) > 180
  ) {
    throw new RangeError(`Coordenadas inválidas: ${point.latitude}, ${point.longitude}`);
  }
}

/** Distância em linha reta (fórmula de Haversine), em quilômetros. */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  assertPoint(a);
  assertPoint(b);
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type ProximityContext = {
  /** Ponto de referência configurado; `null` enquanto não for definido (RN-04). */
  reference: GeoPoint | null;
  radiusKm: number | null;
  company: {
    location: GeoPoint | null;
    locationStatus: InformationStatus;
    locationSource?: string;
    locationObservedAt?: string;
  };
};

/**
 * Avaliador do critério de proximidade (seção 6.3).
 * Nunca inventa distância: sem ponto de referência, raio ou localização da
 * empresa, o critério fica como desconhecido.
 */
export function evaluateProximity(context: ProximityContext, config: ScoringConfig): CriterionInput {
  const missingData: string[] = [];
  if (!context.reference) missingData.push("Ponto de referência da pesquisa não configurado.");
  if (context.radiusKm === null) missingData.push("Raio geográfico não configurado.");
  const { location, locationStatus } = context.company;
  if (!location || locationStatus === "unknown") {
    missingData.push("Localização da empresa desconhecida.");
  }
  if (missingData.length > 0 || !context.reference || context.radiusKm === null || !location) {
    return { kind: "unknown", missingData };
  }
  if (!(context.radiusKm > 0)) throw new RangeError("O raio deve ser maior que zero.");

  const distanceKm = haversineDistanceKm(context.reference, location);
  const notes: string[] = [];
  let rawScore =
    distanceKm >= context.radiusKm ? 0 : 100 * (1 - distanceKm / context.radiusKm);

  if (distanceKm >= context.radiusKm) {
    notes.push(`Fora do raio configurado de ${context.radiusKm} km.`);
  }
  if (locationStatus !== "confirmed" && rawScore > config.proximity.unverifiedMaxScore) {
    rawScore = config.proximity.unverifiedMaxScore;
    notes.push("Nota limitada porque a localização ainda não foi confirmada.");
  }

  return {
    kind: "evaluated",
    rawScore: Math.round(rawScore * 100) / 100,
    evidence: [
      {
        statement: `Distância aproximada de ${distanceKm.toFixed(1)} km do ponto de referência.`,
        status: locationStatus,
        source: context.company.locationSource,
        observedAt: context.company.locationObservedAt,
      },
    ],
    notes,
  };
}
