import { expect, test, type Page } from "@playwright/test";

/**
 * Área de Empresas. Usa E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 * As empresas criadas aqui têm o prefixo "[E2E]" e um sufixo único por execução.
 */
const admin = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };

/** Gera um CNPJ numérico válido (fictício) para cada execução. */
function fakeCnpj(seed: number): string {
  const base = String(seed).padStart(12, "0").slice(-12);
  const digit = (digits: string) => {
    const weights = digits.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const rest = [...digits].reduce((sum, char, index) => sum + Number(char) * weights[index], 0) % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = digit(base);
  return `${base}${first}${digit(base + first)}`;
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(admin.email!);
  await page.getByLabel("Senha").fill(admin.password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("empresas", () => {
  test.skip(!admin.email || !admin.password, "Usuário E2E não configurado");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("cadastra, encontra, detalha e edita uma empresa", async ({ page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.project.name}`;
    const name = `[E2E] Oficina Teste ${suffix}`;
    const unique = Date.now() + (testInfo.project.name === "mobile" ? 1 : 0);
    const cnpj = fakeCnpj(unique);
    // Telefone fictício único por execução, para não coincidir com outra empresa de teste.
    const phoneDigits = String(unique).slice(-8);
    const phone = `(47) ${phoneDigits.slice(0, 4)}-${phoneDigits.slice(4)}`;

    // Garante um ponto de referência para a distância (valores fictícios).
    await page.goto("/configuracoes");
    const region = page.locator("#regiao");
    await region.getByLabel("Endereço do ponto de referência").fill("Endereço de teste E2E, 1");
    await region.getByLabel("Coordenadas (latitude, longitude)").fill("-26.283, -48.877018");
    await region.getByLabel("Raio de atuação (km)").fill("10");
    await region.getByRole("button", { name: "Salvar região" }).click();
    await expect(page.getByText(/Região de atuação salva\.|Nenhuma alteração\./)).toBeVisible();

    await page.goto("/empresas/nova");
    await page.getByLabel("Nome da empresa").fill(name);
    await page.getByLabel("CNPJ").fill(cnpj);
    await page.getByLabel("Segmento").fill("Oficina mecânica E2E");
    await page.getByLabel("Telefone comercial").fill("3433-0000");
    await page.getByLabel("Bairro").fill("Costa e Silva");
    await page.getByLabel("Coordenadas (latitude, longitude)").fill("-26.25, -48.85");
    await page.getByLabel("Conferi a localização no mapa").check();
    await page.getByRole("button", { name: "Cadastrar empresa" }).click();

    // Telefone sem DDD é recusado, e o resto do formulário é preservado.
    await expect(page.getByText("Informe o telefone com DDD, ex.: (47) 3433-0000.")).toBeVisible();
    await expect(page.getByLabel("Nome da empresa")).toHaveValue(name);
    await page.getByLabel("Telefone comercial").fill(phone);
    await page.getByRole("button", { name: "Cadastrar empresa" }).click();

    await expect(page).toHaveURL(/\/empresas\/[0-9a-f-]{36}\?salvo=1$/);
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByText("Empresa salva")).toBeVisible();
    await expect(page.getByText(phone)).toBeVisible();
    await expect(page.getByText(/km do ponto de referência/)).toBeVisible();
    const provenance = page.locator("table").filter({ hasText: "Natureza" });
    await expect(provenance.getByRole("row", { name: /Telefone/ })).toContainText("Cadastro manual");
    await expect(provenance.getByRole("row", { name: /Localização no mapa/ })).toContainText("Confirmada");
    const detailsUrl = page.url().replace("?salvo=1", "");

    // Busca pela lista e pela pesquisa global.
    await page.goto("/empresas");
    await page.getByLabel("Buscar", { exact: true }).fill(suffix);
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByText("1 empresa", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name }).first()).toBeVisible();

    if (testInfo.project.name === "desktop") {
      await page.goto("/dashboard");
      const globalSearch = page.getByRole("textbox", { name: "Buscar empresas" });
      await globalSearch.fill(suffix);
      await globalSearch.press("Enter");
      await expect(page).toHaveURL(/\/empresas\?q=/);
      await expect(page.getByRole("link", { name }).first()).toBeVisible();
    }

    // Mesmo nome: aviso de possível duplicidade; o usuário decide.
    await page.goto("/empresas/nova");
    await page.getByLabel("Nome da empresa").fill(`${name} Ltda`);
    await page.getByRole("button", { name: "Cadastrar empresa" }).click();
    await expect(page.getByText("Possível empresa repetida")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: name })).toContainText("mesmo nome");
    await page.getByRole("button", { name: "É outra empresa, salvar mesmo assim" }).click();
    await expect(page).toHaveURL(/\/empresas\/[0-9a-f-]{36}\?salvo=1$/);

    // Mesmo CNPJ: bloqueado.
    await page.goto("/empresas/nova");
    await page.getByLabel("Nome da empresa").fill(`[E2E] Outra ${suffix}`);
    await page.getByLabel("CNPJ").fill(cnpj);
    await page.getByRole("button", { name: "Cadastrar empresa" }).click();
    await expect(page.getByText("CNPJ já cadastrado.")).toBeVisible();
    await expect(page.getByRole("button", { name: "É outra empresa, salvar mesmo assim" })).toHaveCount(0);

    // Edição: o campo alterado ganha nova origem; os demais são mantidos.
    await page.goto(detailsUrl);
    await page.getByRole("link", { name: "Editar" }).click();
    await expect(page.getByLabel("Nome da empresa")).toHaveValue(name);
    await page.getByLabel("Site").fill(`www.e2e-${unique}.com.br`);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page).toHaveURL(/\?salvo=1$/);
    await expect(page.getByRole("link", { name: `e2e-${unique}.com.br` })).toHaveAttribute("rel", /noopener/);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("lista sem rolagem horizontal e endereço inexistente mostra aviso", async ({ page }) => {
    await page.goto("/empresas");
    await expect(page.getByRole("heading", { name: "Empresas", level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.goto("/empresas/00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("Empresa não encontrada")).toBeVisible();
    await page.goto("/empresas/nao-e-um-id");
    await expect(page.getByText("Empresa não encontrada")).toBeVisible();
  });
});
