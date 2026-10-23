import { z } from "zod";

import type { CompanyDraft } from "@/domain/companies/company";

/**
 * Localização aproximada pelo endereço (Nominatim, OpenStreetMap). O ponto
 * vem da fonte e não é confirmado: a proximidade continua limitada (DP-09)
 * até alguém confirmar a localização.
 */
export const GEOCODING_SOURCE_NAME = "Nominatim (OpenStreetMap)";

export type GeocodingQuery = { street: string; city: string; state?: string; postalcode?: string; country: "Brasil" };

/** Monta a busca estruturada; sem endereço e cidade não há o que localizar. */
export function geocodingQuery(company: Pick<CompanyDraft, "address" | "city" | "state" | "postalCode">): GeocodingQuery | null {
  if (!company.address || !company.city) return null;
  return {
    street: company.address,
    city: company.city,
    ...(company.state ? { state: company.state } : {}),
    ...(company.postalCode ? { postalcode: company.postalCode } : {}),
    country: "Brasil",
  };
}

const resultSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  display_name: z.string().optional(),
  addresstype: z.string().optional(),
  type: z.string().optional(),
});

export const geocodingResponseSchema = z.array(z.unknown());

/** Tipos de resultado precisos o bastante para medir distância (não um bairro ou cidade inteira). */
const PRECISE_TYPES = new Set(["house", "building", "residential", "commercial", "retail", "industrial", "shop", "office", "amenity", "place", "road", "street", "yes"]);

export type GeocodingResult =
  | { ok: true; latitude: number; longitude: number; displayName: string | null; precision: "address" | "street" }
  | { ok: false; reason: "not_found" | "imprecise" };

export function pickGeocodingResult(results: unknown[]): GeocodingResult {
  const first = results.map((item) => resultSchema.safeParse(item)).find((item) => item.success);
  if (!first?.success) return { ok: false, reason: "not_found" };
  const kind = first.data.addresstype ?? first.data.type ?? "";
  if (!PRECISE_TYPES.has(kind)) return { ok: false, reason: "imprecise" };
  return {
    ok: true,
    latitude: first.data.lat,
    longitude: first.data.lon,
    displayName: first.data.display_name ?? null,
    precision: kind === "road" || kind === "street" ? "street" : "address",
  };
}
