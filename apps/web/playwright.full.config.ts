import { defineConfig, devices } from "@playwright/test";

/**
 * Config do E2E completo (login → cache → mensagem em tempo real → handoff).
 * Diferente de playwright.config.ts (smoke, roda no CI): este NÃO sobe
 * nenhum servidor — assume que você já tem `pnpm docker:up` + `pnpm dev`
 * (+ ai-orchestrator) rodando localmente. Ver tests/e2e-full/README.md.
 */
export default defineConfig({
  testDir: "./tests/e2e-full",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 45_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
