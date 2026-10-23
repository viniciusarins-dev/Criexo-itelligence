import { z } from "zod";

export const signInSchema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }).trim().toLowerCase().max(254),
  password: z.string().min(1, { error: "Informe a senha." }).max(200),
});

/**
 * Aceita apenas caminhos internos, evitando redirecionamento aberto. A
 * validação usa o próprio parser de URL: o navegador descarta tabulações e
 * quebras de linha, então "/\t/site.com" viraria "//site.com".
 */
export function safeRedirectPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || !value.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  const base = "http://interno.invalid";
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base || url.pathname.startsWith("//") || url.pathname.startsWith("/login")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
