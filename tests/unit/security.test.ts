import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "@/lib/security/csp";
import { firstAccessErrorMessage, firstAccessSchema, safeRedirectPath, signInErrorMessage, signInSchema } from "@/lib/validation/auth";

describe("redirecionamento após o login", () => {
  it("aceita caminhos internos", () => {
    expect(safeRedirectPath("/empresas?q=oficina#lista")).toBe("/empresas?q=oficina#lista");
    expect(safeRedirectPath("/pesquisas/123")).toBe("/pesquisas/123");
  });

  it("recusa qualquer saída para outro site", () => {
    for (const value of [
      "//site-malicioso.com",
      "/\\\\site-malicioso.com",
      "/\t/site-malicioso.com",
      "/\n/site-malicioso.com",
      "/\r\n/site-malicioso.com",
      "https://site-malicioso.com",
      "javascript:alert(1)",
      " /dashboard",
      "/login?next=//x",
      "",
      null,
      42,
    ]) {
      expect(safeRedirectPath(value), JSON.stringify(value)).toBe("/dashboard");
    }
  });
});

describe("Content Security Policy", () => {
  it("só permite scripts do site com o nonce e nada de terceiros", () => {
    const csp = buildContentSecurityPolicy("abc", { isDev: false, isHttps: true });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toMatch(/https?:\/\//);
  });

  it("libera eval só em desenvolvimento e não força https em http local", () => {
    const csp = buildContentSecurityPolicy("abc", { isDev: true, isHttps: false });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("mensagens do login", () => {
  it("aceita e-mail colado com espaços e maiúsculas", () => {
    expect(signInSchema.parse({ email: "  Vinicius@Exemplo.com ", password: "x" }).email).toBe("vinicius@exemplo.com");
    expect(signInSchema.safeParse({ email: "sem-arroba", password: "x" }).success).toBe(false);
  });

  it("diferencia e-mail não confirmado, excesso de tentativas e serviço fora do ar", () => {
    expect(signInErrorMessage({ code: "email_not_confirmed", status: 400 })).toMatch(/ainda não foi confirmado/);
    expect(signInErrorMessage({ code: "over_request_rate_limit", status: 429 })).toMatch(/Muitas tentativas/);
    expect(signInErrorMessage({ status: 503 })).toMatch(/indisponível/);
  });

  it("senha errada e e-mail inexistente têm a mesma mensagem", () => {
    expect(signInErrorMessage({ code: "invalid_credentials", status: 400 })).toBe("E-mail ou senha incorretos.");
    expect(signInErrorMessage({})).toBe("E-mail ou senha incorretos.");
  });
});

describe("primeiro acesso", () => {
  const valid = { email: " Christian@Exemplo.com ", password: "senhaforte123", confirmPassword: "senhaforte123" };

  it("normaliza o e-mail e exige senha de 10+ caracteres com letras e números, repetida igual", () => {
    expect(firstAccessSchema.parse(valid).email).toBe("christian@exemplo.com");
    expect(firstAccessSchema.safeParse({ ...valid, password: "curta1", confirmPassword: "curta1" }).success).toBe(false);
    expect(firstAccessSchema.safeParse({ ...valid, password: "semnumeroaqui", confirmPassword: "semnumeroaqui" }).success).toBe(false);
    expect(firstAccessSchema.safeParse({ ...valid, password: "1234567890", confirmPassword: "1234567890" }).success).toBe(false);
    const mismatch = firstAccessSchema.safeParse({ ...valid, confirmPassword: "outrasenha123" });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0].path).toEqual(["confirmPassword"]);
  });

  it("explica cada recusa do Supabase", () => {
    expect(firstAccessErrorMessage({ code: "user_already_exists", status: 422 })).toMatch(/já tem senha/);
    expect(firstAccessErrorMessage({ code: "unexpected_failure", status: 500 })).toMatch(/não está liberado/);
    expect(firstAccessErrorMessage({ code: "signup_disabled", status: 422 })).toMatch(/Allow new users to sign up/);
    expect(firstAccessErrorMessage({ code: "weak_password", status: 422 })).toMatch(/Senha fraca/);
  });
});
