import { z } from "zod";

/** Tira espaços e maiúsculas antes de validar: e-mail colado com espaço no fim não pode ser recusado. */
const emailField = z
  .string({ error: "Informe um e-mail válido." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Informe um e-mail válido." }).max(254, { error: "Informe um e-mail válido." }));

export const signInSchema = z.object({
  email: emailField,
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

/** Primeiro acesso: o e-mail precisa estar liberado; a senha segue a política do Supabase (10+, letras e números). */
export const firstAccessSchema = z
  .object({
    email: emailField,
    password: z
      .string()
      .min(10, { error: "Use pelo menos 10 caracteres." })
      .max(72, { error: "Use no máximo 72 caracteres." })
      .regex(/[A-Za-z]/, { error: "Inclua pelo menos uma letra." })
      .regex(/[0-9]/, { error: "Inclua pelo menos um número." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], error: "As senhas não são iguais." });

/** Mensagem do primeiro acesso a partir do erro do Supabase Auth. */
export function firstAccessErrorMessage(error: { code?: string | null; status?: number | null }): string {
  if (error.code === "user_already_exists" || error.code === "email_exists") {
    return "Este e-mail já tem senha. Entre pela tela de login.";
  }
  if (error.code === "weak_password") return "Senha fraca: use pelo menos 10 caracteres, com letras e números.";
  if (error.code === "signup_disabled") {
    return "O primeiro acesso está desligado no Supabase. O administrador precisa ligar “Allow new users to sign up”.";
  }
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  // A trava do banco recusa e-mails fora da lista; o Supabase devolve isso como erro 500 genérico.
  if (error.code === "unexpected_failure" || (error.status && error.status >= 500)) {
    return "Este e-mail não está liberado para acesso. Confira o endereço ou fale com o administrador.";
  }
  return "Não foi possível criar a senha. Tente novamente.";
}
