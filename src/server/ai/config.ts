import "server-only";

import { z } from "zod";

/**
 * Configuração da IA por variáveis de ambiente (somente no servidor).
 * Nada tem valor padrão: sem provedor, modelo, chave e limite diário
 * explícitos, a IA fica "não configurada" e o sistema segue sem ela.
 */
const schema = z.object({
  AI_PROVIDER: z.enum(["gemini"]),
  GEMINI_API_KEY: z.string().min(10),
  GEMINI_MODEL: z.string().regex(/^[a-z0-9.\-]+$/i, "Nome de modelo inválido."),
  AI_DAILY_REQUEST_LIMIT: z.coerce.number().int().min(1).max(10_000),
});

export type AiConfig = { provider: "gemini"; apiKey: string; model: string; dailyLimit: number };

export type AiConfigResult = { ok: true; config: AiConfig } | { ok: false; missing: string[] };

export function readAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfigResult {
  const parsed = schema.safeParse({
    AI_PROVIDER: env.AI_PROVIDER || undefined,
    GEMINI_API_KEY: env.GEMINI_API_KEY || undefined,
    GEMINI_MODEL: env.GEMINI_MODEL || undefined,
    AI_DAILY_REQUEST_LIMIT: env.AI_DAILY_REQUEST_LIMIT || undefined,
  });
  if (!parsed.success) {
    return { ok: false, missing: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] };
  }
  return {
    ok: true,
    config: {
      provider: parsed.data.AI_PROVIDER,
      apiKey: parsed.data.GEMINI_API_KEY,
      model: parsed.data.GEMINI_MODEL,
      dailyLimit: parsed.data.AI_DAILY_REQUEST_LIMIT,
    },
  };
}
