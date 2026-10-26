import { expect, test } from "@playwright/test";
import { Client } from "pg";

/**
 * Primeiro acesso: e-mail liberado cria a própria senha e entra.
 * Requer TEST_DATABASE_URL para colocar o e-mail na lista de liberados.
 */
const databaseUrl = process.env.TEST_DATABASE_URL;

async function authorize(email: string, role: "admin" | "member", displayName: string) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("insert into public.authorized_emails (email, role, display_name) values ($1, $2, $3)", [email, role, displayName]);
  } finally {
    await client.end();
  }
}

test.describe("primeiro acesso", () => {
  test.skip(!databaseUrl, "TEST_DATABASE_URL não configurado");

  test("e-mail liberado cria a senha e entra; uso único; e-mail fora da lista é recusado", async ({ page }, testInfo) => {
    const email = `primeiro.${Date.now()}.${testInfo.project.name}@criexo.test`;
    const password = "SenhaNova2026";
    await authorize(email, "admin", "Primeiro Acesso");

    await page.goto("/login");
    await page.getByRole("link", { name: "Crie sua senha" }).click();
    await expect(page).toHaveURL(/\/primeiro-acesso$/);
    await expect(page.getByRole("heading", { name: "Primeiro acesso", level: 1 })).toBeVisible();

    // Validação: senha curta e senhas diferentes.
    await page.getByLabel("E-mail liberado").fill(email);
    await page.getByLabel("Nova senha").fill("curta1");
    await page.getByLabel("Repita a senha").fill("curta1");
    await page.getByRole("button", { name: "Criar senha e entrar" }).click();
    await expect(page.getByText("Use pelo menos 10 caracteres.")).toBeVisible();
    await page.getByLabel("Nova senha").fill(password);
    await page.getByLabel("Repita a senha").fill("OutraSenha2026");
    await page.getByRole("button", { name: "Criar senha e entrar" }).click();
    await expect(page.getByText("As senhas não são iguais.")).toBeVisible();

    // Fora da lista: recusado pelo banco.
    await page.getByLabel("E-mail liberado").fill(`intruso.${Date.now()}@criexo.test`);
    await page.getByLabel("Nova senha").fill(password);
    await page.getByLabel("Repita a senha").fill(password);
    await page.getByRole("button", { name: "Criar senha e entrar" }).click();
    await expect(page.getByText(/não está liberado para acesso/)).toBeVisible();

    // Liberado (com espaços e maiúsculas, como vem de um copiar e colar): cria e entra já como administrador.
    await page.getByLabel("E-mail liberado").fill(`  ${email.toUpperCase()} `);
    await page.getByLabel("Nova senha").fill(password);
    await page.getByLabel("Repita a senha").fill(password);
    await page.getByRole("button", { name: "Criar senha e entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    // Nome vindo da lista de liberados; papel de administrador (só ele edita a região).
    await page.getByRole("button", { name: "Menu do usuário Primeiro Acesso" }).click();
    await expect(page.getByRole("menu").getByText(email)).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/configuracoes");
    await expect(page.getByRole("button", { name: "Salvar região" })).toBeEnabled();
    await expect(page.getByText("Apenas administradores alteram a região de atuação.")).toHaveCount(0);

    // Sai e tenta de novo: o e-mail já foi usado.
    await page.context().clearCookies();
    await page.goto("/primeiro-acesso");
    await page.getByLabel("E-mail liberado").fill(email);
    await page.getByLabel("Nova senha").fill("OutraSenha2026");
    await page.getByLabel("Repita a senha").fill("OutraSenha2026");
    await page.getByRole("button", { name: "Criar senha e entrar" }).click();
    await expect(page.getByText(/já tem senha/)).toBeVisible();

    // A senha criada funciona no login normal.
    await page.getByRole("link", { name: "Entrar" }).click();
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
