import type { z } from "zod";

import { aiIdeasResponseSchema, type AiIdea } from "@/domain/ideas/idea";

export type AiFailure = {
  ok: false;
  code: "unauthorized" | "rate_limited" | "unavailable" | "timeout" | "invalid_output" | "blocked";
  message: string;
};

export type GenerationResult = { ok: true; ideas: AiIdea[] } | AiFailure;

type GeminiOptions = { apiKey: string; model: string; fetchImpl?: typeof fetch; timeoutMs?: number; temperature?: number };

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 45_000;

/** Extrai o primeiro objeto JSON do texto (a IA às vezes cerca a resposta com ```json). */
export function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

/**
 * Adaptador do Gemini (API REST). Recebe `fetch` por parâmetro para poder ser
 * testado sem rede. A resposta só é aceita se passar pelo esquema informado.
 */
export async function generateJsonWithGemini<T extends z.ZodType>(
  prompt: string,
  schema: T,
  options: GeminiOptions,
): Promise<{ ok: true; data: z.output<T> } | AiFailure> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(options.model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": options.apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: options.temperature ?? 0.7 },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return isTimeout
      ? { ok: false, code: "timeout", message: "A IA demorou demais para responder." }
      : { ok: false, code: "unavailable", message: "Não foi possível conectar ao serviço de IA." };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: "unauthorized", message: "A chave da IA foi recusada. Confira a configuração." };
  }
  if (response.status === 429) {
    return { ok: false, code: "rate_limited", message: "O limite gratuito da IA foi atingido. Tente mais tarde." };
  }
  if (!response.ok) {
    return { ok: false, code: "unavailable", message: `O serviço de IA respondeu com erro (${response.status}).` };
  }

  let body: GeminiResponse;
  try {
    body = (await response.json()) as GeminiResponse;
  } catch {
    return { ok: false, code: "invalid_output", message: "A resposta da IA não pôde ser lida." };
  }
  if (body.promptFeedback?.blockReason) {
    return { ok: false, code: "blocked", message: "A IA recusou o pedido." };
  }
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  const parsed = schema.safeParse(extractJson(text));
  if (!parsed.success) {
    return { ok: false, code: "invalid_output", message: "A IA respondeu fora do formato esperado. Nada foi gravado." };
  }
  return { ok: true, data: parsed.data };
}

export async function generateIdeasWithGemini(prompt: string, options: GeminiOptions): Promise<GenerationResult> {
  const result = await generateJsonWithGemini(prompt, aiIdeasResponseSchema, options);
  return result.ok ? { ok: true, ideas: result.data.ideas } : result;
}
