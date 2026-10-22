import { z } from "zod";

export const signInSchema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }).trim().toLowerCase().max(254),
  password: z.string().min(1, { error: "Informe a senha." }).max(200),
});

/** Aceita apenas caminhos internos, evitando redirecionamento aberto. */
export function safeRedirectPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/login")) return fallback;
  return value;
}
