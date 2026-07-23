import { test, expect } from "@playwright/test";
import { loginAsDevUser } from "./helpers/auth";
import { sendInboundWhatsAppText } from "./helpers/webhook";

/**
 * E2E completo contra a stack local de verdade (não sobe nada sozinho — ver
 * README em tests/e2e-full/README.md para como rodar). Cobre o fluxo que o
 * smoke suite (tests/e2e/) não alcança por não ter backend: login real,
 * navegação com cache, uma mensagem chegando via socket (simulando o
 * WhatsApp via webhook assinado) e handoff para atendente humano.
 */
test.describe.serial("Fluxo completo — login, inbox em tempo real, handoff", () => {
  test("login real via UI chega no overview", async ({ page }) => {
    await loginAsDevUser(page);
    // loginAsDevUser já espera a URL mudar para /overview; aqui só confirmamos
    // que a sessão realmente colou (revisita autenticada sem cair no /login).
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);
  });

  test("navegar overview → inbox → overview não refaz o loading dos KPIs", async ({ page }) => {
    await loginAsDevUser(page);

    await page.goto("/overview");
    // Espera os KPIs carregarem de verdade na primeira visita.
    await expect(page.locator(".shimmer").first()).not.toBeVisible({ timeout: 15_000 });

    await page.goto("/inbox");
    await page.goto("/overview");

    // staleTime cobre essa janela — não deve haver nenhum placeholder de loading
    // piscando na 2ª visita (cache-first, sem refetch bloqueante).
    await expect(page.locator(".shimmer")).toHaveCount(0, { timeout: 1_000 });
  });

  test("mensagem inbound chega em tempo real e handoff funciona", async ({ page }) => {
    await loginAsDevUser(page);
    await page.goto("/inbox");

    const fromPhone = `5511${Date.now().toString().slice(-9)}`;
    const contactName = `E2E ${fromPhone.slice(-4)}`;
    const greeting = "Olá, quero saber sobre os produtos disponíveis";

    await sendInboundWhatsAppText({ fromPhone, contactName, text: greeting });

    // Mensagem chega via RabbitMQ → api → socket, sem reload de página.
    const conversationRow = page.getByText(contactName, { exact: true });
    await expect(conversationRow).toBeVisible({ timeout: 20_000 });

    await conversationRow.click();
    await expect(page.getByText(greeting)).toBeVisible({ timeout: 10_000 });

    // Handoff: "Pausar bot" assume a conversa para o atendente humano.
    await page.getByRole("button", { name: "Pausar bot" }).click();
    await expect(page.getByRole("button", { name: "Devolver ao bot" })).toBeVisible({
      timeout: 10_000,
    });

    // Com a conversa assumida, o operador consegue responder.
    const operatorReply = "Olá! Sou um atendente humano, como posso ajudar?";
    await page.getByLabel("Mensagem").fill(operatorReply);
    await page.getByRole("button", { name: "Enviar mensagem" }).click();

    await expect(page.getByText(operatorReply)).toBeVisible({ timeout: 10_000 });
  });
});
