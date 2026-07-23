import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

// Credenciais do dev-tenant semeadas por `pnpm db:seed` (packages/database/src/seed.ts).
export const DEV_USER_EMAIL = "owner@dev-tenant.com";
export const DEV_USER_PASSWORD = "devpassword123";

/** Login real via UI (não via API) — exercita o fluxo BFF/cookie completo. */
export async function loginAsDevUser(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(DEV_USER_EMAIL);
  await page.locator('input[type="password"]').fill(DEV_USER_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/overview/, { timeout: 15_000 });
}
