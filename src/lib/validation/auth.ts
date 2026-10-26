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

/**
 * Mensagem do login a partir do erro do Supabase Auth. Senha errada e e-mail
 * inexistente têm a mesma mensagem (não revela quem tem conta). "E-mail não
 * confirmado" só acontece com a senha certa, então pode ser dito com clareza.
 */
export function signInErrorMessage(error: { code?: string | null; status?: number | null }): string {
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  if (error.code === "email_not_confirmed") {
    return "Este e-mail ainda não foi confirmado. Use o link enviado por e-mail ou peça ao administrador para confirmar o usuário no Supabase.";
  }
  if (error.code === "user_banned") return "Este usuário está bloqueado. Fale com o administrador.";
  if (error.status && error.status >= 500) return "O serviço de login está indisponível. Tente novamente em instantes.";
  return "E-mail ou senha incorretos.";
}
