import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { admin, signIn } from "./support/helpers";

/**
 * Acessibilidade automática (axe, WCAG 2.1 A/AA) e ausência de bloqueios da
 * CSP em todas as telas. Não substitui a revisão manual com teclado e leitor
 * de tela (docs/IMPLEMENTACAO.md, etapa 8).
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.locator("h1").first().waitFor();
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
  }));
  expect(summary, `Violações em ${path}`).toEqual([]);
}

function watchCsp(page: Page) {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy|Content-Security-Policy/i.test(message.text())) violations.push(message.text());
  });
  return violations;
}

test("login e primeiro acesso sem sessão são acessíveis", async ({ page }) => {
  const csp = watchCsp(page);
  await audit(page, "/login");
  await audit(page, "/primeiro-acesso");
  expect(csp).toEqual([]);
});

test.describe("telas internas", () => {
  test.skip(!admin.email || !admin.password, "Usuário E2E não configurado");

  test("entra e navega só pelo teclado", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").focus();
    await page.keyboard.type(admin.email!);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Senha")).toBeFocused();
    await page.keyboard.type(admin.password!);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dashboard$/);

    // O primeiro Tab leva ao atalho "Pular para o conteúdo".
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#conteudo$/);
  });

  test("todas as telas passam no axe e na CSP", async ({ page }) => {
    test.setTimeout(120_000);
    const csp = watchCsp(page);
    await signIn(page);
    const paths = [
      "/dashboard",
      "/prospeccao",
      "/pesquisas",
      "/empresas",
      "/empresas/nova",
      "/empresas/duplicidades",
      "/oportunidades",
      "/pipeline",
      "/produtos",
      "/produtos/nova",
      "/relatorios",
      "/configuracoes",
    ];
    for (const path of paths) await audit(page, path);

    // Páginas de detalhe, quando existirem dados.
    for (const [list, pattern] of [
      ["/pesquisas", 'a[href^="/pesquisas/"]'],
      ["/empresas", 'a[href^="/empresas/"]:not([href="/empresas/nova"]):not([href="/empresas/duplicidades"])'],
      ["/oportunidades", 'a[href^="/oportunidades/"]'],
      ["/produtos", 'a[href^="/produtos/"]:not([href="/produtos/nova"])'],
    ] as const) {
      await page.goto(list);
      const href = await page.locator(`main ${pattern}`).first().getAttribute("href", { timeout: 3000 }).catch(() => null);
      if (href) await audit(page, href);
    }
    expect(csp).toEqual([]);
  });
});

test("cabeçalhos de segurança com nonce novo a cada requisição", async ({ request }) => {
  const first = await request.get("/login");
  const second = await request.get("/login");
  const csp = first.headers()["content-security-policy"];
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("unsafe-eval");
  expect(second.headers()["content-security-policy"]).not.toBe(csp);
  expect(first.headers()["strict-transport-security"]).toContain("max-age=");
  expect(first.headers()["x-frame-options"]).toBe("DENY");
  expect(first.headers()["x-content-type-options"]).toBe("nosniff");
  expect(first.headers()["x-powered-by"]).toBeUndefined();
});
