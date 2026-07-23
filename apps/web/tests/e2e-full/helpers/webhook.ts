import { createHmac } from "crypto";
import { requireRepoEnv, repoEnv } from "./env";

const CHANNEL_SERVICE_URL =
  repoEnv("CHANNEL_SERVICE_URL") ?? `http://localhost:${repoEnv("PORT_CHANNEL") ?? "3001"}`;

// Mesmo valor fixo setado pelo seed (packages/database/src/seed.ts) no dev-tenant.
const DEV_WHATSAPP_PHONE_ID = "dev-whatsapp-phone-id";

interface InboundTextOptions {
  /** Telefone do "cliente" simulado — use um novo a cada teste para criar um contato/conversa novos. */
  fromPhone: string;
  contactName?: string;
  text: string;
}

/**
 * Monta e assina (HMAC-SHA256, igual ao Meta) um payload de webhook de texto
 * inbound, e faz o POST para o channel-service local — mesmo caminho que uma
 * mensagem real do WhatsApp percorreria, sem precisar de credenciais da Meta.
 */
export async function sendInboundWhatsAppText({
  fromPhone,
  contactName = "Cliente Teste E2E",
  text,
}: InboundTextOptions): Promise<void> {
  const secret = requireRepoEnv("META_WEBHOOK_SECRET");
  const waMessageId = `wamid.e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const payload = {
    object: "whatsapp_business_account" as const,
    entry: [
      {
        id: "e2e-waba-id",
        changes: [
          {
            field: "messages" as const,
            value: {
              messaging_product: "whatsapp" as const,
              metadata: {
                display_phone_number: DEV_WHATSAPP_PHONE_ID,
                phone_number_id: DEV_WHATSAPP_PHONE_ID,
              },
              contacts: [{ profile: { name: contactName }, wa_id: fromPhone }],
              messages: [
                {
                  from: fromPhone,
                  id: waMessageId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text" as const,
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const body = JSON.stringify(payload);
  const signature = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  const res = await fetch(`${CHANNEL_SERVICE_URL}/webhooks/meta`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": signature,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(
      `[e2e-full] POST /webhooks/meta falhou: ${res.status} ${await res.text().catch(() => "")}`,
    );
  }
}
