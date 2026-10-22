import { z } from "zod";

/**
 * Variáveis públicas do Supabase. A chave publicável (ou anon) é segura no
 * navegador porque todo acesso a dados passa por RLS. A service_role key
 * NUNCA deve aparecer aqui nem em qualquer variável NEXT_PUBLIC_*.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export type EnvResult =
  | { ok: true; env: PublicEnv }
  | { ok: false; missing: string[] };

export function readPublicEnv(): EnvResult {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (parsed.success) return { ok: true, env: parsed.data };
  return {
    ok: false,
    missing: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))],
  };
}
