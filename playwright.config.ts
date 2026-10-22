import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3000);
// Opcional: usar um Chromium já instalado no sistema em vez do baixado pelo Playwright.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // Os testes compartilham os mesmos usuários; sair de uma sessão encerra as demais.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Requer `npm run build` antes. Usa as variáveis de .env.local.
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
