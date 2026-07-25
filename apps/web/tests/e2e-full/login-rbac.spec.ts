import { expect, test, type Page } from "@playwright/test";

const CLIENT = {
  email: process.env.E2E_CLIENT_EMAIL ?? "ciroviski@gmail.com",
  password: process.env.E2E_CLIENT_PASSWORD ?? "123456",
};

const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? "owner@dev-tenant.com",
  password: process.env.E2E_ADMIN_PASSWORD ?? "devpassword123",
};

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("voce@empresa.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await expect(page).toHaveURL(/\/overview/, { timeout: 15_000 });
}

test.describe("Login RBAC — cliente vs admin", () => {
  test("cliente autentica e não vê seção Plataforma", async ({ page }) => {
    await login(page, CLIENT.email, CLIENT.password);

    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("Plataforma")).toHaveCount(0);
    await expect(page.getByText("Super Admin")).toHaveCount(0);
    await expect(page.getByText("Logs do Sistema")).toHaveCount(0);
  });

  test("admin autentica e vê seção Plataforma", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);

    await expect(page.getByText("Plataforma")).toBeVisible();
    await expect(page.getByRole("link", { name: /super admin/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^planos$/i })).toBeVisible();
  });

  test("cliente recebe erro em API super-admin", async ({ page }) => {
    await login(page, CLIENT.email, CLIENT.password);

    const response = await page.request.get(
      "/api/proxy/super-admin/tenants?page=1&limit=10",
    );

    expect(response.ok()).toBe(false);
    expect([401, 403, 404]).toContain(response.status());
  });
});
