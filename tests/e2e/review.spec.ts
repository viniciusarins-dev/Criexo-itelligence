import { expect, test } from "@playwright/test";

import { admin, createCompany, mock, readyResearch, setMock, setRegion, signIn } from "./support/helpers";

/**
 * Revisão humana das possíveis duplicidades, confirmação de localização e
 * recálculo da pontuação. Usa o servidor simulado das fontes e E2E_ADMIN_*.
 */
test.describe("revisão e pontuação", () => {
  test.skip(!admin.email || !admin.password, "Usuário E2E não configurado");
  test.afterEach(async () => {
    await fetch(`${mock}/__mock/reset`, { method: "POST" });
  });

  test("decide duplicidades, confirma a localização e recalcula a pontuação", async ({ page }, testInfo) => {
    const stamp = `${Date.now()}${testInfo.project.name.slice(0, 1)}`;
    const category = `criexorev${stamp}`;
    const same = `Rev Mesma ${stamp}`;
    const different = `Rev Outra ${stamp}`;
    const id = Number(`${Date.now()}`.slice(-9));
    // Telefone único por execução: o mesmo telefone em outra empresa é (corretamente) apontado como duplicidade.
    const phoneDigits = `3${`${Date.now()}`.slice(-7)}`;
    const phoneDisplay = `(47) ${phoneDigits.slice(0, 4)}-${phoneDigits.slice(4)}`;
    await signIn(page);
    await setRegion(page);
    const sameUrl = await createCompany(page, { "Nome da empresa": same, Segmento: "Escritório" });
    await createCompany(page, { "Nome da empresa": different, Segmento: "Escritório" });
    await setMock("overpass", {
      status: 200,
      body: {
        elements: [
          { type: "node", id, lat: -26.3005, lon: -48.8405, tags: { name: same, shop: category, phone: `+55 47 ${phoneDigits}` } },
          { type: "node", id: id + 1, lat: -26.301, lon: -48.841, tags: { name: different, shop: category } },
        ],
      },
    });
    await readyResearch(page, category, `Produto rev ${stamp}`);
    await page.getByRole("button", { name: "Buscar empresas" }).click();
    await expect(page.getByText(/Busca concluída: 2 empresa\(s\)\./)).toBeVisible();
    const researchUrl = page.url();
    await expect(page.getByText("Possível duplicidade")).toHaveCount(2);

    // Fila de revisão: nada foi unido ainda.
    await page.goto("/empresas");
    await page.getByRole("link", { name: /Possíveis duplicidades \(\d+\)/ }).click();
    await expect(page.getByRole("heading", { name: "Possíveis duplicidades", level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    const sameCard = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: `É a mesma empresa: ${same}` }) });
    await expect(sameCard.getByText("(completaria o cadastro)").first()).toBeVisible();
    await sameCard.getByRole("button", { name: `É a mesma empresa: ${same}` }).click();
    await page.getByRole("dialog").getByLabel("Observação (opcional)").fill(`Mesmo telefone no balcão ${stamp}`);
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Registro ligado à empresa cadastrada.")).toBeVisible();
    await page.getByRole("button", { name: `São empresas diferentes: ${different}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Cadastrada como empresa nova.")).toBeVisible();
    const decided = page.getByRole("list", { name: "Decisões anteriores" });
    await expect(decided.getByText(`“Mesmo telefone no balcão ${stamp}”`)).toBeVisible();
    await expect(decided.getByRole("link", { name: "cadastrada como nova" }).first()).toBeVisible();

    // A empresa cadastrada recebeu só o que faltava, com a origem.
    await page.goto(sameUrl);
    await expect(page.getByText(phoneDisplay)).toBeVisible();
    await expect(page.getByRole("link", { name: "OpenStreetMap", exact: true })).toBeVisible();
    await expect(page.getByText("Escritório").first()).toBeVisible();

    // Confirmação humana da localização.
    await page.getByRole("button", { name: "Confirmar localização" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText(/Localização confirmada\./)).toBeVisible();
    await expect(page.getByText(/Conferida por .* em /)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar localização" })).toHaveCount(0);

    // Recalcular: a oportunidade não tinha nota (empresa sem localização na busca).
    await page.goto(researchUrl);
    await page.getByRole("list", { name: "Empresas encontradas" }).getByRole("link", { name: /Produto rev .* · sem nota/ }).first().click();
    await page.getByRole("button", { name: "Recalcular" }).click();
    await expect(page.getByText(/Pontuação recalculada: sem nota → \d+\./)).toBeVisible();
    await expect(page.getByText(/Nota sem nota → \d+ \(versão \d+\)\./)).toBeVisible();
    await expect(page.getByText("Pontuação recalculada", { exact: true })).toBeVisible();

    // Nova execução: os registros agora estão ligados, sem aviso de duplicidade.
    await page.goto(researchUrl);
    await page.getByRole("button", { name: "Executar novamente" }).click();
    await page.getByRole("button", { name: "Criar nova execução" }).click();
    await page.waitForURL((url) => /\/pesquisas\/[0-9a-f-]{36}$/.test(url.pathname) && url.href !== researchUrl);
    await page.getByRole("button", { name: "Buscar empresas" }).click();
    await expect(page.getByText(/Busca concluída: 2 empresa\(s\)\./)).toBeVisible();
    await expect(page.getByText("Possível duplicidade")).toHaveCount(0);
  });

  test("relatórios mostram as contagens e exportam CSV", async ({ page }) => {
    await signIn(page);
    await page.goto("/relatorios");
    await expect(page.getByRole("heading", { name: "Relatórios", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Funil comercial" })).toBeVisible();
    await page.getByRole("link", { name: "Todo o período" }).click();
    await expect(page).toHaveURL(/periodo=todos/);
    await expect(page.getByText("Oportunidades criadas")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    for (const [label, header] of [
      ["Oportunidades (CSV)", "Empresa;CNPJ;Segmento;Bairro;Cidade;Produto;Status"],
      ["Empresas (CSV)", "Empresa;CNPJ;Segmento;Site;Telefone comercial"],
    ] as const) {
      const download = page.waitForEvent("download");
      await page.getByRole("link", { name: label }).click();
      const file = await download;
      expect(file.suggestedFilename()).toMatch(/^criexo-(oportunidades|empresas)-\d{4}-\d{2}-\d{2}\.csv$/);
      const content = await (await file.createReadStream()).toArray();
      const text = Buffer.concat(content).toString("utf8");
      expect(text.startsWith("\uFEFF" + header)).toBe(true);
      expect(text.endsWith("\r\n")).toBe(true);
    }
  });

  test("exportação exige sessão", async ({ request }) => {
    const response = await request.get("/relatorios/exportar/oportunidades", { maxRedirects: 0 });
    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers()["location"]).toContain("/login");
  });
});
