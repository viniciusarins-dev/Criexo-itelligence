import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "@/lib/security/csp";
import { safeRedirectPath, signInErrorMessage } from "@/lib/validation/auth";

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
