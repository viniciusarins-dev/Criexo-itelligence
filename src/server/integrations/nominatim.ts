import "server-only";

import { geocodingResponseSchema, pickGeocodingResult, type GeocodingQuery, type GeocodingResult } from "@/domain/sources/geocoding";

import { requestJson, serviceUrl, type SourceFailure } from "./http";

/** Política do Nominatim: no máximo 1 requisição por segundo. */
let lastRequestAt = 0;

export async function geocodeAddress(query: GeocodingQuery, options: { fetchImpl?: typeof fetch } = {}): Promise<GeocodingResult | SourceFailure> {
  const wait = lastRequestAt + 1100 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();

  const base = serviceUrl("NOMINATIM_URL", "https://nominatim.openstreetmap.org");
  const params = new URLSearchParams({ ...query, format: "jsonv2", limit: "1", countrycodes: "br", "accept-language": "pt-BR" });
  const result = await requestJson(`${base}/search?${params.toString()}`, {
    method: "GET",
    timeoutMs: 15_000,
    fetchImpl: options.fetchImpl,
    serviceName: "o serviço de localização (Nominatim)",
  });
  if (!result.ok) return result;
  const parsed = geocodingResponseSchema.safeParse(result.body);
  if (!parsed.success) return { ok: false, code: "invalid_output", message: "O serviço de localização respondeu fora do formato esperado." };
  return pickGeocodingResult(parsed.data);
}
