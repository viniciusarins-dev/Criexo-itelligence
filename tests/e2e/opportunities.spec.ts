import { expect, test, type Page } from "@playwright/test";

/**
 * Oportunidades e pipeline. Usa E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 * Cria uma empresa "[E2E]" própria por execução.
 */
const admin = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(admin.email!);
  await page.getByLabel("Senha").fill(admin.password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function createCompany(page: Page, name: string) {
  await page.goto("/empresas/nova");
  await page.getByLabel("Nome da empresa").fill(name);
  await page.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(page).toHaveURL(/\/empresas\/[0-9a-f-]{36}\?salvo=1$/);
}

test.describe("oportunidades", () => {
  test.skip(!admin.email || !admin.password, "Usuário E2E não configurado");

  test("cria, salva, registra contato, muda status, descarta e reabre", async ({ page }, testInfo) => {
    const name = `[E2E] Oportunidade ${Date.now()}-${testInfo.project.name}`;
    await signIn(page);
    await createCompany(page, name);

    // Criar a oportunidade na página da empresa.
    await page.getByRole("button", { name: "Criar oportunidade" }).click();
    await expect(page).toHaveURL(/\/oportunidades\/[0-9a-f-]{36}\?criada=1$/);
    await expect(page.getByText("Oportunidade criada")).toBeVisible();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    const opportunityUrl = page.url().replace("?criada=1", "");

    // Criar de novo leva à mesma oportunidade (uma por empresa e produto).
    await page.getByRole("link", { name, exact: true }).click();
    await page.getByRole("button", { name: "Criar oportunidade" }).click();
    await expect(page).toHaveURL(/\?existente=1$/);
    expect(page.url().replace("?existente=1", "")).toBe(opportunityUrl);

    // Salvar ≠ contatar.
    await page.getByRole("button", { name: "Salvar oportunidade" }).click();
    await expect(page.getByText("Oportunidade salva.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Salva" })).toHaveAttribute("aria-pressed", "true");

    // Observação vazia é recusada.
    await page.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByText("Escreva a observação.")).toBeVisible();

    // Contato com mudança explícita para "Contatada".
    await page.getByRole("radio", { name: "Contato realizado" }).click();
    await page.getByLabel("Como foi o contato?").fill("Ligação: pediu orçamento de suportes.");
    await page.getByLabel("Mover para “Contatada”").check();
    await page.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByText("Contato registrado. Status: Contatada.")).toBeVisible();

    const history = page.getByRole("list", { name: "Histórico da oportunidade" });
    await expect(history).toContainText("Contato registrado");
    await expect(history).toContainText("Ligação: pediu orçamento de suportes.");
    await expect(history).toContainText("Nova → Contatada");
    await expect(history).toContainText("Oportunidade salva");

    // Mudar status com observação.
    await page.getByLabel("Novo status").selectOption({ label: "Em negociação" });
    await page.getByLabel("Observação (opcional)").fill("Enviado orçamento.");
    await page.getByRole("button", { name: "Mudar status" }).click();
    await expect(page.getByText("Status alterado para Em negociação.")).toBeVisible();
    await expect(history).toContainText("Contatada → Em negociação");

    // Descartar pede confirmação; cancelar não muda nada.
    await page.getByRole("button", { name: "Descartar" }).click();
    const dialog = page.getByRole("dialog", { name: "Descartar oportunidade?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
    await expect(history).not.toContainText("→ Descartada");

    await page.getByRole("button", { name: "Descartar" }).click();
    await dialog.getByLabel("Motivo (opcional)").fill("Comprou de outro fornecedor.");
    await dialog.getByRole("button", { name: "Descartar" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Oportunidade encerrada: Descartada")).toBeVisible();
    await expect(history).toContainText("Em negociação → Descartada");
    await expect(page.getByRole("button", { name: "Descartar" })).toHaveCount(0);

    // Reabrir.
    await page.getByLabel("Novo status").selectOption({ label: "Para analisar" });
    await page.getByRole("button", { name: "Mudar status" }).click();
    await expect(history).toContainText("Descartada → Para analisar");

    // Aparece na lista filtrada por salvas e no pipeline.
    await page.goto(`/oportunidades?salvas=1&q=${encodeURIComponent(name.replace("[E2E] ", ""))}`);
    await expect(page.getByText("1 oportunidade", { exact: true })).toBeVisible();

    await page.goto("/pipeline?salvas=1");
    // O quadro rola por dentro; a página não ganha rolagem horizontal.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    const column = page.getByRole("region", { name: "Para analisar" });
    await expect(column.getByRole("link", { name })).toBeVisible();
    await column.getByLabel(`Mover ${name} para outro status`).selectOption({ label: "Convertida" });
    await expect(page.getByText("Status alterado para Convertida.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Convertida" }).getByRole("link", { name })).toBeVisible();

    await page.goto("/pipeline?visao=tabela&salvas=1");
    await expect(page.getByRole("row", { name: new RegExp(name.replace(/[[\]]/g, "\\$&")) })).toContainText("Convertida");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("oportunidade inexistente mostra aviso", async ({ page }) => {
    await signIn(page);
    await page.goto("/oportunidades/00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("Oportunidade não encontrada")).toBeVisible();
  });
});
