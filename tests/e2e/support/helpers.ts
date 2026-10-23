import { expect, type Page } from "@playwright/test";

/** Funções comuns aos testes que usam o servidor simulado das fontes. */
export const admin = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
export const mock = `http://localhost:${process.env.MOCK_SOURCES_PORT ?? 4010}`;
export const reference = { latitude: -26.3, longitude: -48.84 };

export async function setMock(path: string, body: unknown) {
  const response = await fetch(`${mock}/__mock/${path}`, { method: "POST", body: JSON.stringify(body) });
  expect(response.ok).toBe(true);
}

export async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(admin.email!);
  await page.getByLabel("Senha").fill(admin.password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function setRegion(page: Page) {
  await page.goto("/configuracoes");
  const region = page.locator("#regiao");
  await region.getByLabel("Endereço do ponto de referência").fill("Endereço de teste E2E, 1");
  await region.getByLabel("Coordenadas (latitude, longitude)").fill(`${reference.latitude}, ${reference.longitude}`);
  await region.getByLabel("Raio de atuação (km)").fill("10");
  await region.getByRole("button", { name: "Salvar região" }).click();
  await expect(page.getByText(/Região de atuação salva\.|Nenhuma alteração\./)).toBeVisible();
}

export async function createCompany(page: Page, fields: Record<string, string>) {
  await page.goto("/empresas/nova");
  for (const [label, value] of Object.entries(fields)) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(page).toHaveURL(/\/empresas\/[0-9a-f-]{36}\?salvo=1$/);
  return page.url().replace("?salvo=1", "");
}

/** Pesquisa com uma ideia aprovada, pronta para a busca. */
export async function readyResearch(page: Page, query: string, ideaName: string) {
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
