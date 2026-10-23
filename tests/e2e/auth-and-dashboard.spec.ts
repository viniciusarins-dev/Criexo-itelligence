import { expect, test, type Page } from "@playwright/test";

/**
 * Fluxos críticos de autenticação e do dashboard.
 * Requer um Supabase com as migrations aplicadas e dois usuários:
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD      → perfil ATIVO
 *   E2E_INACTIVE_EMAIL / E2E_INACTIVE_PASSWORD → perfil INATIVO
 */
const admin = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
const inactive = { email: process.env.E2E_INACTIVE_EMAIL, password: process.env.E2E_INACTIVE_PASSWORD };

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("visitante sem sessão é redirecionado para o login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
});

test("credenciais inválidas mostram erro genérico", async ({ page }) => {
  await signIn(page, "ninguem@criexo.test", "senha-errada");
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("validação de formulário no servidor", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
  await expect(page.getByText("Informe a senha.")).toBeVisible();
});

test.describe("com usuários configurados", () => {
  test.skip(!admin.email || !admin.password || !inactive.email || !inactive.password, "Usuários E2E não configurados");

  test("usuário inativo não acessa dados internos", async ({ page }) => {
    await signIn(page, inactive.email!, inactive.password!);
    await expect(page).toHaveURL(/\/acesso-pendente$/);
    await expect(page.getByText("Seu acesso ainda não foi liberado")).toBeVisible();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/acesso-pendente$/);

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("membro ativo entra, vê o dashboard com dados reais e sai", async ({ page }, testInfo) => {
    await signIn(page, admin.email!, admin.password!);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Prospecção comercial" })).toBeVisible();

    const indicators = page.getByRole("region", { name: "Indicadores" });
    await expect(indicators.getByText("Empresas cadastradas")).toBeVisible();
    await expect(indicators.getByText("Nota ≥ 60")).toBeVisible();
    await expect(page.getByText(/Pontuação em validação/)).toHaveCount(0);

    // Áreas ainda não implementadas não são links.
    const menuButton = page.getByRole("button", { name: "Abrir menu de navegação" });
    if (await menuButton.isVisible()) await menuButton.click();
    const nav = page.getByRole("navigation", { name: "Navegação principal" }).last();
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Empresas" })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Pipeline/ })).toHaveCount(0);
    await expect(nav.locator("[aria-disabled=true]", { hasText: "Pipeline comercial" })).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath("dashboard-menu.png"), fullPage: true });
    if (await menuButton.isVisible()) await page.keyboard.press("Escape");

    // Sem rolagem horizontal da página em nenhuma largura.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.screenshot({ path: testInfo.outputPath("dashboard.png"), fullPage: true });

    // Usuário logado que abre /login volta ao dashboard.
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", { name: /Menu do usuário/ }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("sessão revogada em outro dispositivo", () => {
  test.skip(!inactive.email || !inactive.password, "Usuários E2E não configurados");

  test("sair continua funcionando quando a sessão já foi encerrada em outro lugar", async ({ browser }) => {
    const first = await browser.newContext();
    const second = await browser.newContext();
    const pageA = await first.newPage();
    const pageB = await second.newPage();

    await signIn(pageA, inactive.email!, inactive.password!);
    await expect(pageA).toHaveURL(/\/acesso-pendente$/);
    await signIn(pageB, inactive.email!, inactive.password!);
    await expect(pageB).toHaveURL(/\/acesso-pendente$/);

    // Sair em A encerra todas as sessões do usuário.
    await pageA.getByRole("button", { name: "Sair" }).click();
    await expect(pageA).toHaveURL(/\/login$/);

    await pageB.getByRole("button", { name: "Sair" }).click();
    await expect(pageB).toHaveURL(/\/login$/);

    await first.close();
    await second.close();
  });
});
