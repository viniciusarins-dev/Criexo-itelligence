import "server-only";

import { buildOverpassQuery, osmElementToCandidate, overpassResponseSchema, type OsmCandidate } from "@/domain/sources/osm";

import { requestJson, serviceUrl, type SourceFailure } from "./http";

const TIMEOUT_MS = 35_000;

/** Estabelecimentos com nome no raio (uma consulta à instância pública do Overpass). */
export async function fetchOsmCandidates(
  center: { latitude: number; longitude: number },
  radiusKm: number,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<{ ok: true; candidates: OsmCandidate[]; ignored: number; truncated: boolean } | SourceFailure> {
  const endpoint = serviceUrl("OVERPASS_URL", "https://overpass-api.de/api/interpreter");
  const result = await requestJson(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: buildOverpassQuery(center, radiusKm) }).toString(),
    timeoutMs: TIMEOUT_MS,
    fetchImpl: options.fetchImpl,
    serviceName: "o OpenStreetMap (Overpass)",
  });
  if (!result.ok) return result;
  const parsed = overpassResponseSchema.safeParse(result.body);
  if (!parsed.success) return { ok: false, code: "invalid_output", message: "O OpenStreetMap respondeu fora do formato esperado." };
  // "remark" indica consulta interrompida (tempo ou memória) no servidor.
  if (parsed.data.remark && /runtime error|timed out|out of memory/i.test(parsed.data.remark)) {
    return { ok: false, code: "unavailable", message: "O OpenStreetMap interrompeu a consulta. Tente novamente mais tarde." };
  }
  const candidates = parsed.data.elements.map(osmElementToCandidate).filter((item): item is OsmCandidate => item !== null);
  return {
    ok: true,
    candidates,
    ignored: parsed.data.elements.length - candidates.length,
    truncated: parsed.data.elements.length >= 500,
  };
}
