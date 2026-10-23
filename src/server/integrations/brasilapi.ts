import "server-only";

import { brasilApiCnpjSchema, type BrasilApiCnpj } from "@/domain/sources/brasilapi";

import { requestJson, serviceUrl, type SourceFailure } from "./http";

export async function fetchCnpj(cnpj: string, options: { fetchImpl?: typeof fetch } = {}): Promise<{ ok: true; data: BrasilApiCnpj } | SourceFailure> {
  if (!/^[0-9]{14}$/.test(cnpj)) {
    return { ok: false, code: "unsupported", message: "A consulta pública ainda não aceita CNPJ com letras." };
  }
  const base = serviceUrl("BRASILAPI_URL", "https://brasilapi.com.br");
  const result = await requestJson(`${base}/api/cnpj/v1/${cnpj}`, {
    method: "GET",
    timeoutMs: 20_000,
    fetchImpl: options.fetchImpl,
    serviceName: "a BrasilAPI",
  });
  if (!result.ok) return result;
  const parsed = brasilApiCnpjSchema.safeParse(result.body);
  if (!parsed.success) return { ok: false, code: "invalid_output", message: "A BrasilAPI respondeu fora do formato esperado." };
  return { ok: true, data: parsed.data };
}
