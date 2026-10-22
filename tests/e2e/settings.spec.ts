import { expect, test, type Page } from "@playwright/test";

/**
 * Tela de Configurações. Requer, além dos usuários de auth-and-dashboard:
 *   E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD → perfil ATIVO com papel "member".
 * Os valores gravados aqui são de teste (não são as configurações reais).
 */
const admin = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
const member = { email: process.env.E2E_MEMBER_EMAIL, password: process.env.E2E_MEMBER_PASSWORD };
const inactiveEmail = process.env.E2E_INACTIVE_EMAIL;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("configurações — administrador", () => {
  test.skip(!admin.email || !admin.password || !inactiveEmail, "Usuários E2E não configurados");

  test.beforeEach(async ({ page }) => {
    await signIn(page, admin.email!, admin.password!);
    await page.goto("/configuracoes");
    await expect(page.getByRole("heading", { name: "Configurações", level: 1 })).toBeVisible();
  });

  test("salva a região de atuação e valida as coordenadas", async ({ page }) => {
    const region = page.locator("#regiao");
    // Valores fictícios de teste.
    const radius = String(5 + (Date.now() % 40));
    await region.getByLabel("Endereço do ponto de referência").fill("Endereço de teste E2E, 1");
    await region.getByLabel("Coordenadas (latitude, longitude)").fill("isto não é coordenada");
    await region.getByLabel("Raio de atuação (km)").fill(radius);
    await region.getByRole("button", { name: "Salvar região" }).click();
    await expect(region.getByText('Cole as coordenadas no formato "-26.27, -48.85".')).toBeVisible();
    // O que foi digitado continua no formulário após o erro.
    await expect(region.getByLabel("Endereço do ponto de referência")).toHaveValue("Endereço de teste E2E, 1");
    await expect(region.getByLabel("Raio de atuação (km)")).toHaveValue(radius);

    await region.getByLabel("Coordenadas (latitude, longitude)").fill("-26.30, -48.84");
    await region.getByRole("button", { name: "Salvar região" }).click();
    await expect(page.getByText(/Região de atuação salva\.|Nenhuma alteração\./)).toBeVisible();

    await page.reload();
    const reloaded = page.locator("#regiao");
    await expect(reloaded.getByText("Configurada")).toBeVisible();
    await expect(reloaded.getByLabel("Raio de atuação (km)")).toHaveValue(radius);
    await expect(reloaded.getByLabel("Coordenadas (latitude, longitude)")).toHaveValue("-26.3, -48.84");
    await expect(reloaded.getByRole("link", { name: "Conferir o ponto no mapa" })).toHaveAttribute(
      "href",
      /openstreetmap\.org\/\?mlat=-26\.3&mlon=-48\.84/,
    );
  });

  test("salva a capacidade produtiva e mostra o que falta confirmar", async ({ page }) => {
    const section = page.locator("#capacidade");
    const hours = String(10 + (Date.now() % 50));
    await section.getByLabel("Modelo da impressora").fill("Impressora de teste");
    await section.getByLabel("Largura (cm)").fill("18");
    await section.getByLabel("Profundidade (cm)").fill("18");
    await section.getByLabel("Altura (cm)").fill("18");
    await section.getByLabel("PLA").check();
    await section.getByLabel("Horas de trabalho por semana").fill(hours);
    await section.getByLabel("Prazo padrão de entrega (dias)").fill("3");
    await section.getByLabel("Modelagem 3D").selectOption("simple_only");
    await section.getByLabel("A impressora fica ligada").selectOption("");
    await section.getByLabel("Horas por dia com a impressora ligada").fill("9,5");
    await section.getByLabel("Limite de peça pequena").fill("8");
    await section.getByLabel("Unidade do limite").selectOption("");
    await section.getByLabel("O tempo de impressão é contado").selectOption("");
    await section.getByLabel("Peças por dia · menos de 1 hora").fill("32");
    await section.getByLabel("Peças por dia · de 1 a 5 horas").fill("16");
    await section.getByLabel("Peças por dia · 5 horas ou mais").fill("12");
    await section.getByLabel("Várias peças pequenas são impressas juntas na mesma mesa").check();
    await section.getByRole("button", { name: "Salvar capacidade" }).click();
    await expect(page.getByText(/Capacidade produtiva salva/)).toBeVisible();

    await page.reload();
    const reloaded = page.locator("#capacidade");
    await expect(reloaded.getByText("3 a confirmar")).toBeVisible();
    await expect(
      reloaded.getByText("Quando a impressora fica ligada · Unidade do limite de peça pequena · Tempo de impressão: por peça ou por mesa"),
    ).toBeVisible();
    await expect(reloaded.getByLabel("Horas de trabalho por semana")).toHaveValue(hours);
    await expect(reloaded.getByLabel("PLA")).toBeChecked();
    await expect(reloaded.getByLabel("Várias peças pequenas são impressas juntas na mesma mesa")).toBeChecked();
    await expect(reloaded.getByLabel("Horas por dia com a impressora ligada")).toHaveValue("9.5");

    // Valor inválido é recusado pelo servidor.
    await reloaded.getByLabel("Horas de trabalho por semana").fill("500");
    await reloaded.getByRole("button", { name: "Salvar capacidade" }).click();
    await expect(page.getByText("Revise os campos destacados.")).toBeVisible();
    await expect(reloaded.getByLabel("Horas de trabalho por semana")).toHaveValue("500");
    await expect(reloaded.getByLabel("Modelo da impressora")).toHaveValue("Impressora de teste");
  });

  test("mostra a pontuação aprovada", async ({ page }) => {
    const section = page.locator("#pontuacao");
    await expect(section.getByText("Versão 2")).toBeVisible();
    await expect(section.getByText("Aprovada")).toBeVisible();
    await expect(section.getByText("nota a partir de 60.")).toBeVisible();
  });

  test("libera e bloqueia o acesso de um usuário", async ({ page }) => {
    const row = page.locator("#equipe tr", { hasText: inactiveEmail! });
    // Garante o estado inicial caso uma execução anterior tenha sido interrompida.
    if (await row.getByRole("button", { name: "Bloquear acesso" }).isVisible()) {
      await row.getByRole("button", { name: "Bloquear acesso" }).click();
      await row.getByRole("button", { name: "Confirmar bloqueio" }).click();
    }
    await expect(row.getByText("Aguardando liberação")).toBeVisible();
    await row.getByRole("button", { name: "Liberar acesso" }).click();
    await expect(row.getByText("Ativo", { exact: true })).toBeVisible();

    await row.getByRole("button", { name: "Bloquear acesso" }).click();
    await row.getByRole("button", { name: "Confirmar bloqueio" }).click();
    await expect(row.getByText("Aguardando liberação")).toBeVisible();

    // O próprio acesso não pode ser alterado.
    const self = page.locator("#equipe tr", { hasText: "(você)" });
    await expect(self.getByLabel(/Papel de/)).toBeDisabled();
    await expect(self.getByRole("button")).toHaveCount(0);
  });

  test("sem rolagem horizontal", async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("configurações — membro sem papel de administrador", () => {
  test.skip(!member.email || !member.password, "Usuário membro E2E não configurado");

  test("vê a região apenas para leitura e não gerencia a equipe", async ({ page }) => {
    await signIn(page, member.email!, member.password!);
    await page.goto("/configuracoes");
    const region = page.locator("#regiao");
    await expect(region.getByText("Apenas administradores alteram a região de atuação.")).toBeVisible();
    await expect(region.getByLabel("Raio de atuação (km)")).toBeDisabled();
    await expect(region.getByRole("button", { name: "Salvar região" })).toHaveCount(0);
    await expect(page.locator("#equipe").getByText("Somente administradores gerenciam a equipe")).toBeVisible();
    // Capacidade produtiva pode ser registrada por qualquer membro ativo.
    await expect(page.locator("#capacidade").getByRole("button", { name: "Salvar capacidade" })).toBeEnabled();
  });
});
