# Design: Stripe — Billing do SaaS

## Contexto

O WhatsAgent cobra tenants por plano (STARTER/GROWTH/SCALE) via assinatura mensal no Stripe. O `BillingService` já tem a lógica de criar checkout session e processar webhooks, mas não tem nenhum endpoint HTTP exposto — o `BillingModule` não tem controller.

## Decisões

- **Somente mensal**: um price ID por plano (3 no total). Sem ciclo anual por enquanto.
- **Customer persistido (Abordagem B)**: ao criar checkout, verificar `tenant.stripeCustomerId` no banco e reusá-lo. Se não existir, criar e salvar. Evita duplicatas no Stripe.
- **Trial de 14 dias**: já configurado no service (`trial_period_days: 14`), mantido.
- **Webhook público**: `POST /billing/webhooks/stripe` sem auth guard, protegido por validação de assinatura Stripe (`stripe.webhooks.constructEvent` + raw body).

## Setup Externo

1. **Conta Stripe** em `stripe.com`
2. **API Keys** (Developers → API keys):
   - `STRIPE_SECRET_KEY` = `sk_test_...`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_test_...`
3. **Produtos e preços** (Product catalog → Add product):
   - Starter mensal → `STRIPE_PRICE_STARTER_MONTHLY`
   - Growth mensal → `STRIPE_PRICE_GROWTH_MONTHLY`
   - Scale mensal → `STRIPE_PRICE_SCALE_MONTHLY`
4. **Webhook** (Developers → Webhooks → Add endpoint):
   - URL: `https://ngrok-url/billing/webhooks/stripe`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...`
5. **Frontend URL** no `.env.local`: `FRONTEND_URL=http://localhost:3000`

## Arquitetura

### Arquivos modificados/criados

| Ação | Arquivo |
|---|---|
| Modificar | `apps/api/src/modules/billing/billing.service.ts` |
| Criar | `apps/api/src/modules/billing/billing.controller.ts` |
| Criar | `apps/api/src/modules/billing/dto/create-checkout.dto.ts` |
| Modificar | `apps/api/src/modules/billing/billing.module.ts` |

### Endpoints

**`POST /billing/checkout`**
- Guard: `ClerkAuthGuard + RolesGuard`
- Roles: `OWNER`, `ADMIN`
- Body: `{ plan: "STARTER" | "GROWTH" | "SCALE" }`
- Returns: `{ checkoutUrl: string }`
- Fluxo: verifica `tenant.stripeCustomerId` → cria customer se não existir → salva ID → cria checkout session

**`POST /billing/webhooks/stripe`**
- Guard: nenhum (público)
- Precisa de raw body para validação da assinatura
- Valida via `stripe.webhooks.constructEvent(rawBody, signature, secret)`
- Trata: `customer.subscription.created/updated` → atualiza `planType` e `status`; `customer.subscription.deleted` → status `CANCELLED`
- Retorna 200 sempre (mesmo em erros de negócio) para evitar retentativas desnecessárias do Stripe

### Correções no BillingService

**`STRIPE_PRICE_MAP`**: Mover de variável global para método privado que lê via `ConfigService`:
```ts
private getPriceMap(): Record<string, string> {
  return {
    STARTER: this.config.get("STRIPE_PRICE_STARTER_MONTHLY") ?? "",
    GROWTH:  this.config.get("STRIPE_PRICE_GROWTH_MONTHLY") ?? "",
    SCALE:   this.config.get("STRIPE_PRICE_SCALE_MONTHLY") ?? "",
  };
}
```

**`createCheckoutSession`**: Verificar e reusar `stripeCustomerId`:
```ts
let customerId = tenant.stripeCustomerId;
if (!customerId) {
  const customer = await stripe.customers.create({ name: tenant.name, metadata: { tenantId } });
  customerId = customer.id;
  await prisma.tenant.update({ where: { id: tenantId }, data: { stripeCustomerId: customerId } });
}
// usar customerId no session.create
```

## O que NÃO está no escopo

- Endpoint para cancelar ou trocar plano (sem tela de billing no frontend ainda)
- Cobrança por uso (meter/SCALE conversations)
- Portal do cliente Stripe
- Suporte a múltiplos métodos de pagamento (só cartão por enquanto)
