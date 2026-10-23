import { expect, test, type Page } from "@playwright/test";

/**
 * Fontes externas (OpenStreetMap, BrasilAPI, Nominatim) contra o servidor
 * simulado em tests/e2e/support/mock-sources.mjs. Usa E2E_ADMIN_EMAIL /
 * E2E_ADMIN_PASSWORD e define a região de atuação com valores de teste.
 */
const admin = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
const mock = `http://localhost:${process.env.MOCK_SOURCES_PORT ?? 4010}`;
const reference = { latitude: -26.3, longitude: -48.84 };

async function setMock(path: string, body: unknown) {
  const response = await fetch(`${mock}/__mock/${path}`, { method: "POST", body: JSON.stringify(body) });
  expect(response.ok).toBe(true);
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(admin.email!);
  await page.getByLabel("Senha").fill(admin.password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function setRegion(page: Page) {
  await page.goto("/configuracoes");
  const region = page.locator("#regiao");
  await region.getByLabel("Endereço do ponto de referência").fill("Endereço de teste E2E, 1");
  await region.getByLabel("Coordenadas (latitude, longitude)").fill(`${reference.latitude}, ${reference.longitude}`);
  await region.getByLabel("Raio de atuação (km)").fill("10");
  await region.getByRole("button", { name: "Salvar região" }).click();
  await expect(page.getByText(/Região de atuação salva\.|Nenhuma alteração\./)).toBeVisible();
}

async function createCompany(page: Page, fields: Record<string, string>) {
  await page.goto("/empresas/nova");
  for (const [label, value] of Object.entries(fields)) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(page).toHaveURL(/\/empresas\/[0-9a-f-]{36}\?salvo=1$/);
  return page.url().replace("?salvo=1", "");
}

/** Pesquisa com uma ideia aprovada, pronta para a busca. */
async function readyResearch(page: Page, query: string, ideaName: string) {
  await page.goto("/prospeccao");
  await page.getByLabel("Segmento ou produto").fill(query);
  await page.getByRole("button", { name: "Criar pesquisa" }).click();
  await expect(page).toHaveURL(/\/pesquisas\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Adicionar ideia manual" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome da ideia").fill(ideaName);
  await dialog.getByRole("button", { name: "Registrar ideia" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: `Aprovar: ${ideaName}`, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Aprovar", exact: true }).click();
  await expect(page.getByText("Pronta para buscar")).toBeVisible();
}

/** CNPJ numérico válido e único por execução (dígitos verificadores calculados). */
function uniqueCnpj(): string {
  const base = `${Date.now()}`.slice(-8).padStart(8, "0") + "0001";
  const digit = (value: string) => {
    const weights = value.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const rest = [...value].reduce((sum, char, index) => sum + Number(char) * weights[index], 0) % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = digit(base);
  return `${base}${first}${digit(base + first)}`;
}

test.describe("fontes externas", () => {
  test.skip(!admin.email || !admin.password, "Usuário E2E não configurado");
  test.afterEach(async () => {
    await fetch(`${mock}/__mock/reset`, { method: "POST" });
  });

  test("busca no OpenStreetMap: importa, pontua, sinaliza duplicidade e reaproveita na nova execução", async ({ page }, testInfo) => {
    const stamp = `${Date.now()}${testInfo.project.name.slice(0, 1)}`;
    const category = `criexoe2e${stamp}`;
    const fresh = `Odonto Alfa ${stamp}`;
    const duplicateName = `Odonto Duplicada ${stamp}`;
    const id = Number(`${Date.now()}`.slice(-9));
    await signIn(page);
    await setRegion(page);
    // Já cadastrada, com outro segmento: só o OpenStreetMap a encontra, pelo mesmo nome.
    await createCompany(page, { "Nome da empresa": duplicateName, Segmento: "Escritório" });

    await setMock("overpass", {
      status: 200,
      body: {
        elements: [
          { type: "node", id, lat: -26.301, lon: -48.841, tags: { name: fresh, shop: category, "addr:street": "Rua Teste", "addr:housenumber": "5", "addr:city": "Joinville" } },
          { type: "node", id: id + 1, lat: -26.302, lon: -48.842, tags: { name: duplicateName, shop: category } },
          { type: "node", id: id + 2, lat: -26.303, lon: -48.843, tags: { name: `Padaria ${stamp}`, shop: "bakery" } },
          { type: "node", id: id + 3, tags: { name: "Sem posição", shop: category } },
        ],
      },
    });

    await readyResearch(page, category, `Organizador ${stamp}`);
    await page.getByRole("button", { name: "Buscar empresas" }).click();
    await expect(page.getByText(/Busca concluída: 2 empresa\(s\) · 1 nova\(s\) do OpenStreetMap/)).toBeVisible();
    const lastQuery = (await (await fetch(`${mock}/__mock/last`)).json()) as { query: string };
    expect(lastQuery.query).toContain("around:10000,-26.300000,-48.840000");

    const results = page.getByRole("list", { name: "Empresas encontradas" });
    const freshItem = results.getByRole("listitem").filter({ has: page.getByRole("link", { name: fresh }) });
    await expect(freshItem.getByText("Nova no cadastro")).toBeVisible();
    await expect(freshItem.getByText(/fonte: OpenStreetMap/)).toBeVisible();
    // Pontuação calculada pela distância; sem IA, incompleta.
    await expect(freshItem.getByRole("link", { name: /Organizador .* · \d+\*/ })).toBeVisible();
    const duplicateItem = results.getByRole("listitem").filter({ has: page.getByRole("link", { name: duplicateName, exact: true }) });
    await expect(duplicateItem.getByText("Possível duplicidade")).toBeVisible();
    await expect(duplicateItem.getByText(/os dados não foram unidos/)).toBeVisible();
    await expect(duplicateItem.getByRole("link", { name: "Ver o registro no OpenStreetMap" })).toHaveAttribute("href", `https://www.openstreetmap.org/node/${id + 1}`);
    await expect(results.getByText(`Padaria ${stamp}`)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "© colaboradores do OpenStreetMap (ODbL)" })).toBeVisible();
    await expect(page.getByText("Resultado parcial", { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    const researchUrl = page.url();

    // Oportunidade: proximidade avaliada, critérios de julgamento desconhecidos (IA não configurada).
    await freshItem.getByRole("link", { name: /Organizador/ }).click();
    await expect(page.getByText(/Dados incompletos: a nota pode ficar entre/)).toBeVisible();
    await expect(page.getByText(/Distância aproximada de 0,1 km|Distância aproximada de 0.1 km/)).toBeVisible();
    await expect(page.getByText(/Avaliação de compatibilidade com o produto não feita: IA não configurada\./)).toBeVisible();

    // Empresa importada: origem de cada campo e atribuição.
    await page.goto(researchUrl);
    await freshItem.getByRole("link", { name: fresh }).click();
    await expect(page.getByRole("heading", { name: fresh, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "OpenStreetMap", exact: true })).toHaveAttribute("href", `https://www.openstreetmap.org/node/${id}`);
    await expect(page.getByText("Declarada pela fonte").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "© colaboradores do OpenStreetMap (ODbL)" })).toBeVisible();

    // Nova execução: a mesma empresa é reaproveitada, não cadastrada de novo.
    await page.goto(researchUrl);
    await page.getByRole("button", { name: "Executar novamente" }).click();
    await page.getByRole("button", { name: "Criar nova execução" }).click();
    await page.waitForURL((url) => /\/pesquisas\/[0-9a-f-]{36}$/.test(url.pathname) && url.href !== researchUrl);
    await page.getByRole("button", { name: "Buscar empresas" }).click();
    await expect(page.getByText(/Busca concluída: 2 empresa\(s\)\./)).toBeVisible();
    const again = page.getByRole("list", { name: "Empresas encontradas" }).getByRole("listitem").filter({ has: page.getByRole("link", { name: fresh }) });
    await expect(again).toBeVisible();
    await expect(again.getByText("Nova no cadastro")).toHaveCount(0);
    await expect(again.getByText(/fonte: OpenStreetMap/)).toBeVisible();
  });

  test("falha do OpenStreetMap é comunicada e a base interna continua", async ({ page }, testInfo) => {
    const stamp = `${Date.now()}${testInfo.project.name.slice(0, 1)}`;
    const segment = `criexofalha${stamp}`;
    await signIn(page);
    await setRegion(page);
    await createCompany(page, { "Nome da empresa": `[E2E] Interna ${stamp}`, Segmento: segment });
    await setMock("overpass", { status: 504, body: {} });

    await readyResearch(page, segment, `Ideia falha ${stamp}`);
    await page.getByRole("button", { name: "Buscar empresas" }).click();
    await expect(page.getByText(/Busca concluída: 1 empresa\(s\) · fonte\(s\) com problema: OpenStreetMap/)).toBeVisible();
    await expect(page.getByText(/Fonte\(s\) com problema: OpenStreetMap — detalhes abaixo\./)).toBeVisible();
    const sources = page.getByRole("list", { name: "Fontes consultadas" });
    await expect(sources.getByRole("listitem").filter({ hasText: "OpenStreetMap" }).getByText("Falhou")).toBeVisible();
    await expect(sources.getByText(/respondeu com erro \(504\)/)).toBeVisible();
    await expect(page.getByRole("list", { name: "Empresas encontradas" }).getByRole("link", { name: `[E2E] Interna ${stamp}` })).toBeVisible();
  });

  test("completa pelo CNPJ e localiza pelo endereço sem sobrescrever o cadastro", async ({ page }, testInfo) => {
    const stamp = `${Date.now()}${testInfo.project.name.slice(0, 1)}`;
    const cnpj = uniqueCnpj();
    await signIn(page);
    const companyUrl = await createCompany(page, { "Nome da empresa": `[E2E] CNPJ ${stamp}`, CNPJ: cnpj, Segmento: "Segmento manual" });
    await setMock("cnpj", {
      cnpj,
      status: 200,
      body: {
        cnpj,
        razao_social: "PESSOA DE TESTE 00000000000",
        nome_fantasia: "LOJA TESTE",
        descricao_situacao_cadastral: "ATIVA",
        cnae_fiscal: 4789099,
        cnae_fiscal_descricao: "Comércio varejista de outros produtos",
        descricao_tipo_de_logradouro: "RUA",
        logradouro: "DAS FLORES",
        numero: "12",
        bairro: "COSTA E SILVA",
        municipio: "JOINVILLE",
        uf: "SC",
        cep: "89218000",
        opcao_pelo_mei: true,
        ddd_telefone_1: "4799990000",
      },
    });
    await setMock("nominatim", { status: 200, body: [{ lat: "-26.2901", lon: "-48.8702", addresstype: "building" }] });

    await page.goto(companyUrl);
    await expect(page.getByRole("button", { name: "Localizar pelo endereço" })).toBeDisabled();
    await page.getByRole("button", { name: "Completar pelo CNPJ" }).click();
    // Cidade e UF já vêm preenchidas no cadastro novo (Joinville–SC) e não são trocadas.
    await expect(page.getByText("Completado: endereço, bairro, CEP.")).toBeVisible();
    // O segmento informado à mão foi mantido; telefone e razão social de MEI não entram.
    await expect(page.getByText("Segmento manual").first()).toBeVisible();
    await expect(page.getByText("Rua das Flores, 12")).toBeVisible();
    await expect(page.getByText("Situação cadastral: ATIVA")).toBeVisible();
    await expect(page.getByText("Optante pelo MEI")).toBeVisible();
    await expect(page.getByText(/PESSOA DE TESTE/)).toHaveCount(0);
    await expect(page.getByText(/99990000/)).toHaveCount(0);
    await expect(page.getByText("BrasilAPI (dados da Receita Federal)").first()).toBeVisible();

    await page.getByRole("button", { name: "Localizar pelo endereço" }).click();
    await expect(page.getByText("Localização encontrada pelo endereço. Ela ainda não está confirmada.")).toBeVisible();
    await expect(page.getByText(/Nominatim \(OpenStreetMap\) — pelo endereço/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Localizar pelo endereço" })).toBeDisabled();

    // Consulta de novo: nada mais a completar.
    await page.getByRole("button", { name: "Completar pelo CNPJ" }).click();
    await expect(page.getByText("Nenhum campo vazio para completar.")).toBeVisible();
  });
});
