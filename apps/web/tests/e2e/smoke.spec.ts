import { test, expect } from "@playwright/test";

test.describe("Smoke — páginas públicas e proteção de rota", () => {
  test("landing page carrega", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
  });

  test("página de login renderiza o formulário", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("rota protegida sem sessão redireciona para /login", async ({ page }) => {
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
  });
});
