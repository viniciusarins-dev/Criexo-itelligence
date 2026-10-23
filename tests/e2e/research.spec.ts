import { expect, test, type Page } from "@playwright/test";

/**
 * Nova prospecção, aprovação de ideias, busca na base interna e nova execução.
 * Usa E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD. O servidor de teste roda sem as
 * variáveis da IA, então as sugestões automáticas aparecem como não configuradas.
 */
const admin = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(admin.email!);
  await page.getByLabel("Senha").fill(admin.password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function addIdea(page: Page, name: string, segment: string) {
  await page.getByRole("button", { name: "Adicionar ideia manual" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome da ideia").fill(name);
  await dialog.getByLabel("Segmento-alvo").fill(segment);
  await dialog.getByLabel("Premissas (uma por linha)").fill("Clientes pedem suportes no balcão");
  await dialog.getByRole("button", { name: "Registrar ideia" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("list", { name: "Ideias da pesquisa" }).getByRole("link", { name, exact: true }).first()).toBeVisible();
}

async function decide(page: Page, ideaName: string, decision: "Aprovar" | "Rejeitar") {
  await page.getByRole("button", { name: `${decision}: ${ideaName}`, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Observação (opcional)").fill(`${decision} no teste`);
  await dialog.getByRole("button", { name: decision, exact: true }).click();
  await expect(dialog).toBeHidden();
}

test.describe("prospecção", () => {
  test.skip(!admin.email || !admin.password, "Usuário E2E não configurado");

  test("pesquisa guiada: ideias, aprovação individual, busca, resultado parcial e nova execução", async ({ page }, testInfo) => {
    const stamp = `${Date.now()}${testInfo.project.name}`;
    const segment = `Segmentoe2e${stamp}`;
    const companyName = `[E2E] Prospecção ${stamp}`;
    const ideaName = `Suporte E2E ${stamp}`;
    const similarName = `Suporte E2E ${stamp} balcão`;
    await signIn(page);

    // Empresa da base interna que deve ser encontrada pela busca.
    await page.goto("/empresas/nova");
    await page.getByLabel("Nome da empresa").fill(companyName);
    await page.getByLabel("Segmento").fill(segment);
    await page.getByRole("button", { name: "Cadastrar empresa" }).click();
    await expect(page).toHaveURL(/\/empresas\/[0-9a-f-]{36}\?salvo=1$/);

    // Parâmetros: validação no servidor e configurações usadas.
    await page.goto("/prospeccao");
    await expect(page.getByRole("heading", { name: "Nova prospecção", level: 1 })).toBeVisible();
    await expect(page.getByText("Não configurada")).toBeVisible();
    await page.getByRole("button", { name: "Criar pesquisa" }).click();
    await expect(page.getByText("Informe o segmento ou o produto.")).toBeVisible();
    await page.getByLabel("Segmento ou produto").fill(segment);
    await page.getByLabel("Objetivo (opcional)").fill("Testar o fluxo completo");
    await page.getByRole("button", { name: "Criar pesquisa" }).click();
    await expect(page).toHaveURL(/\/pesquisas\/[0-9a-f-]{36}$/);
    const researchUrl = page.url();
    await expect(page.getByRole("heading", { name: segment, level: 1 })).toBeVisible();
    await expect(page.getByText("Rascunho")).toBeVisible();
    await expect(page.getByText("IA não configurada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sugerir ideias com IA" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Buscar empresas" })).toBeDisabled();

    // Ideias manuais; a segunda é parecida com a primeira.
    await addIdea(page, ideaName, segment);
    await addIdea(page, similarName, segment);
    await expect(page.getByText("Ideia parecida já registrada").first()).toBeVisible();
    await expect(page.getByText("Aguardando aprovação")).toBeVisible();
    await expect(page.getByRole("button", { name: "Buscar empresas" })).toBeDisabled();

    // Decisão individual: uma aprovada, outra rejeitada.
    await decide(page, ideaName, "Aprovar");
    await expect(page.getByText("1 ideia(s) aguardando decisão.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Buscar empresas" })).toBeDisabled();
    await decide(page, similarName, "Rejeitar");
    await expect(page.getByText("Pronta para buscar")).toBeVisible();

    // Busca: só uma empresa corresponde, então o resultado é parcial e avisado.
    await page.getByRole("button", { name: "Buscar empresas" }).click();
    await expect(page.getByText("Resultado parcial", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/1 empresa\(s\) encontrada\(s\); o esperado é de 5 a 10/)).toBeVisible();
    const results = page.getByRole("list", { name: "Empresas encontradas" });
    await expect(results.getByRole("link", { name: companyName })).toBeVisible();
    await expect(results.getByText(/Segmento “.*” corresponde à pesquisa · fonte: Base interna/)).toBeVisible();
    // Só a ideia aprovada gera oportunidade.
    // O link da oportunidade mostra o produto e a nota (sem localização nem IA, "sem nota").
    await expect(results.getByRole("link", { name: `${ideaName} · sem nota`, exact: true })).toBeVisible();
    await expect(results.getByRole("link", { name: similarName })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    // Nova execução: outra pesquisa, a original continua com os resultados.
    await page.getByRole("button", { name: "Executar novamente" }).click();
    await page.getByRole("button", { name: "Criar nova execução" }).click();
    await page.waitForURL((url) => /\/pesquisas\/[0-9a-f-]{36}$/.test(url.pathname) && url.href !== researchUrl);
    await expect(page.getByText("Nova execução", { exact: true })).toBeVisible();
    await expect(page.getByText("Pronta para buscar")).toBeVisible();
    await page.getByRole("button", { name: "Buscar empresas" }).click();
    await expect(page.getByRole("list", { name: "Empresas encontradas" }).getByRole("link", { name: companyName })).toBeVisible();

    await page.getByRole("link", { name: "pesquisa original" }).click();
    await expect(page).toHaveURL(researchUrl);
    await expect(page.getByRole("list", { name: "Empresas encontradas" }).getByRole("link", { name: companyName })).toBeVisible();
    await expect(page.getByText("Outras execuções desta pesquisa")).toBeVisible();

    // A lista de pesquisas mostra as duas.
    await page.goto("/pesquisas");
    await expect(page.getByRole("link", { name: segment })).toHaveCount(2);

    // Produtos e ideias: decisão com histórico e oportunidade relacionada.
    await page.goto("/produtos?status=approved");
    // Rejeitada, a ideia parecida não aparece no filtro de aprovadas.
    await expect(page.getByText(similarName)).toHaveCount(0);
    await page.getByRole("link", { name: ideaName }).filter({ visible: true }).click();
    await expect(page.getByRole("heading", { name: ideaName, level: 1 })).toBeVisible();
    await expect(page.getByText("Aguardando decisão → Aprovada")).toBeVisible();
    await expect(page.getByText("“Aprovar no teste”", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: companyName })).toBeVisible();
    await expect(page.getByText("Declarada pela fonte")).toBeVisible();
  });

  test("cadastra ideia avulsa e valida os campos", async ({ page }, testInfo) => {
    const name = `Ideia avulsa E2E ${Date.now()}${testInfo.project.name}`;
    await signIn(page);
    await page.goto("/produtos");
    await page.getByRole("link", { name: "Nova ideia" }).first().click();
    await page.getByRole("button", { name: "Registrar ideia" }).click();
    await expect(page.getByText("Informe o nome da ideia.")).toBeVisible();
    await page.getByLabel("Nome da ideia").fill(name);
    await page.getByLabel("Problema que resolve").fill("Organização do balcão");
    await page.getByRole("button", { name: "Registrar ideia" }).click();
    await expect(page).toHaveURL(/\/produtos\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByText("Aguardando decisão", { exact: true })).toBeVisible();
    await expect(page.getByText("Organização do balcão")).toBeVisible();

    await page.getByRole("button", { name: `Rejeitar: ${name}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Rejeitar", exact: true }).click();
    await expect(page.getByText("Ideia rejeitada.")).toBeVisible();
    await expect(page.getByRole("button", { name: `Aprovar mesmo assim: ${name}` })).toBeVisible();
  });
});
