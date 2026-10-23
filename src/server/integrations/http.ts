import "server-only";

/** Identificação exigida pelas políticas de uso do OpenStreetMap/Nominatim. */
export const USER_AGENT = "CRIEXO-Intelligence/0.1 (sistema interno; Joinville-SC)";

export type SourceFailure = {
  ok: false;
  code: "rate_limited" | "unavailable" | "timeout" | "invalid_output" | "not_found" | "unsupported";
  message: string;
};

/** `fetch` com tempo limite e erros traduzidos; nunca lança exceção. */
export async function requestJson(
  url: string,
  init: RequestInit & { timeoutMs: number; fetchImpl?: typeof fetch; serviceName: string },
): Promise<{ ok: true; body: unknown } | SourceFailure> {
  const { timeoutMs, fetchImpl = fetch, serviceName, ...rest } = init;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      ...rest,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...rest.headers },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return isTimeout
      ? { ok: false, code: "timeout", message: `${serviceName} demorou demais para responder.` }
      : { ok: false, code: "unavailable", message: `Não foi possível conectar a ${serviceName}.` };
  }
  if (response.status === 404) return { ok: false, code: "not_found", message: `${serviceName} não encontrou o registro.` };
  if (response.status === 429) return { ok: false, code: "rate_limited", message: `Limite de uso de ${serviceName} atingido. Tente mais tarde.` };
  if (!response.ok) return { ok: false, code: "unavailable", message: `${serviceName} respondeu com erro (${response.status}).` };
  try {
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false, code: "invalid_output", message: `A resposta de ${serviceName} não pôde ser lida.` };
  }
}

export function serviceUrl(envName: string, fallback: string): string {
  const value = process.env[envName];
  return value && /^https?:\/\//.test(value) ? value.replace(/\/$/, "") : fallback;
}
