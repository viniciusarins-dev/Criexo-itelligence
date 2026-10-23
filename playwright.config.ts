import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3000);
const mockPort = Number(process.env.MOCK_SOURCES_PORT ?? 4010);
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
  webServer: [
    {
      // Fontes externas simuladas: os testes não dependem de rede nem gastam limites reais.
      command: `node tests/e2e/support/mock-sources.mjs`,
      url: `http://localhost:${mockPort}/health`,
      reuseExistingServer: true,
      env: { MOCK_SOURCES_PORT: String(mockPort) },
    },
    {
      // Requer `npm run build` antes. Usa as variáveis de .env.local.
      command: `npx next start -p ${port}`,
      url: `http://localhost:${port}/login`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        OVERPASS_URL: `http://localhost:${mockPort}/api/interpreter`,
        BRASILAPI_URL: `http://localhost:${mockPort}`,
        NOMINATIM_URL: `http://localhost:${mockPort}`,
        OSM_DAILY_QUERY_LIMIT: "100000",
      },
    },
  ],
});
