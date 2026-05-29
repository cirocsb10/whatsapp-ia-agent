# WhatsAgent — Plan 6: Multi-Tenant Self-Service, Billing & Super Admin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o portal de onboarding self-service para novos tenants, integração de cobrança recorrente via Stripe (SaaS billing), suporte multi-agente por tenant com permissões RBAC, painel Super Admin para gestão de toda a plataforma, e documentação da API externa.

**Architecture:** Onboarding como wizard multi-step em Next.js (rota pública com Clerk sign-up integrado). Stripe Checkout para assinatura + webhooks para sincronizar status de billing. Super Admin protegido por role OPERATOR (fora do modelo tenant). Multi-agent: múltiplos usuários por tenant com roles diferentes.

**Tech Stack:** Stripe SDK v12 · @clerk/nextjs · Next.js 14 App Router · NestJS · Prisma · Swagger/OpenAPI (documentação API externa) · Resend (transacional email)

**Pré-requisito:** Plans 0–5 concluídos

---

## Proposta de Pricing (Mercado Brasil 2025)

### Benchmarks de mercado

| Concorrente | Foco | Preço |
|-------------|------|-------|
| WATI | WhatsApp CRM + bot básico | R$ 300–800/mês |
| Respond.io | Multi-canal + IA | R$ 250–900/mês |
| Intercom | Full customer success | R$ 800–3.000/mês |
| Evolution API (DIY) | Só infraestrutura | R$ 0 (open source, risco ban) |
| **WhatsAgent** | Agente IA vendedor completo | **R$ 197–1.497/mês** |

### Tabela de Planos

| | **Trial** | **STARTER** | **GROWTH** | **SCALE** | **ENTERPRISE** |
|---|-----------|-------------|------------|-----------|----------------|
| **Preço/mês** | Grátis | R$ 197 | R$ 497 | R$ 997 | Sob consulta |
| **Conversas/mês** | 100 | 500 | 3.000 | 10.000 | Ilimitado |
| **Números WhatsApp** | 1 | 1 | 1 | 3 | Ilimitado |
| **Produtos no catálogo** | 20 | 100 | 1.000 | Ilimitado | Ilimitado |
| **Agentes humanos** | 1 | 2 | 5 | 15 | Ilimitado |
| **Histórico de conv.** | 7 dias | 30 dias | 90 dias | 1 ano | Ilimitado |
| **Analytics** | Básico | Básico | Completo | Avançado + Export | BI customizado |
| **API externa** | ✗ | ✗ | ✗ | ✓ | ✓ |
| **Modelo IA** | mini | mini | mini | mini+4o | Configurável |
| **SLA suporte** | — | Email 48h | Email 24h | Chat 4h | Dedicado |
| **Trial** | 14 dias | — | — | — | — |
| **Duração trial → plano** | Converte automaticamente ou cancela | | | | |

> **Conversa** = thread completa com um contato (inclui todos os turnos). Áudios transcrevem e contam como 1 conversa.

### Custo de IA por plano (estimado, OpenAI)

| Plano | Conversas | Custo OpenAI | Custo Meta API | **Margem bruta** |
|-------|-----------|-------------|----------------|-----------------|
| STARTER R$ 197 | 500 | ~R$ 30 | ~R$ 0 (serviço) | **~85%** |
| GROWTH R$ 497 | 3.000 | ~R$ 180 | ~R$ 0 | **~64%** |
| SCALE R$ 997 | 10.000 | ~R$ 600 | ~R$ 0 | **~40%** |
| ENTERPRISE | — | variável | variável | negociado |

> Estimativa com 80% gpt-4o-mini + 20% gpt-4o + 15% conversas com áudio (30s médio).
> Meta Cloud API: conversas iniciadas pelo usuário são **grátis** na janela de 24h.
> Margem aumenta com cache de system prompt (reduz ~30% dos tokens de input).

### Excedente de conversas

Tenant que ultrapassar o limite do plano:
- Cobrado **R$ 0,60/conversa excedente** (STARTER/GROWTH) ou **R$ 0,40** (SCALE)
- Cobrança automática via Stripe metered billing ao fim do ciclo
- Alerta em 80% e 100% do limite via email + banner no dashboard

### Regras de negócio para implementar no código

```typescript
// apps/api/src/modules/billing/billing.constants.ts

export const PLAN_LIMITS = {
  TRIAL: {
    conversations: 100,
    products: 20,
    agents: 1,
    whatsapp_numbers: 1,
    history_days: 7,
    api_access: false,
    llm_model: "gpt-4o-mini",
  },
  STARTER: {
    conversations: 500,
    products: 100,
    agents: 2,
    whatsapp_numbers: 1,
    history_days: 30,
    api_access: false,
    llm_model: "gpt-4o-mini",
    overage_price_brl_cents: 60,  // R$ 0,60/conversa excedente
  },
  GROWTH: {
    conversations: 3000,
    products: 1000,
    agents: 5,
    whatsapp_numbers: 1,
    history_days: 90,
    api_access: false,
    llm_model: "gpt-4o-mini",
    overage_price_brl_cents: 60,
  },
  SCALE: {
    conversations: 10000,
    products: -1,  // -1 = ilimitado
    agents: 15,
    whatsapp_numbers: 3,
    history_days: 365,
    api_access: true,
    llm_model: "gpt-4o",   // Usa 4o por padrão no SCALE
    overage_price_brl_cents: 40,
  },
  ENTERPRISE: {
    conversations: -1,
    products: -1,
    agents: -1,
    whatsapp_numbers: -1,
    history_days: -1,
    api_access: true,
    llm_model: "gpt-4o",
  },
} as const satisfies Record<string, PlanConfig>;

export const STRIPE_PRICES = {
  STARTER: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
    annual: process.env.STRIPE_PRICE_STARTER_ANNUAL ?? "",  // 20% off
  },
  GROWTH: {
    monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY ?? "",
    annual: process.env.STRIPE_PRICE_GROWTH_ANNUAL ?? "",
  },
  SCALE: {
    monthly: process.env.STRIPE_PRICE_SCALE_MONTHLY ?? "",
    annual: process.env.STRIPE_PRICE_SCALE_ANNUAL ?? "",
  },
} as const;

// Preços anuais (20% desconto):
// STARTER anual: R$ 157,60/mês (R$ 1.891,20/ano)
// GROWTH anual:  R$ 397,60/mês (R$ 4.771,20/ano)
// SCALE anual:   R$ 797,60/mês (R$ 9.571,20/ano)
```

### Variáveis Stripe a adicionar ao .env.example

```bash
# STRIPE PRICES (criar no Stripe Dashboard)
STRIPE_PRICE_STARTER_MONTHLY=""
STRIPE_PRICE_STARTER_ANNUAL=""
STRIPE_PRICE_GROWTH_MONTHLY=""
STRIPE_PRICE_GROWTH_ANNUAL=""
STRIPE_PRICE_SCALE_MONTHLY=""
STRIPE_PRICE_SCALE_ANNUAL=""
# Overage: usar Stripe metered billing
STRIPE_METER_ID_CONVERSATIONS=""
```

### Middleware de verificação de limite

```typescript
// apps/api/src/common/guards/plan-limit.guard.ts
// Verificar antes de processar cada conversa nova:
// 1. Buscar messagesThisMonth do tenant no Redis (cache 5min)
// 2. Se >= limite do plano → bloquear nova conversa, notificar tenant
// 3. Se dentro do limite → permitir e incrementar contador
// Contador resetado todo dia 1 via cron job
```

---

## Estrutura de Arquivos

```
Criar:
  apps/web/app/(onboarding)/
  ├── layout.tsx                        # Layout wizard (sem sidebar)
  ├── setup/page.tsx                    # Step 1: Conta criada
  ├── setup/company/page.tsx            # Step 2: Dados da empresa
  ├── setup/whatsapp/page.tsx           # Step 3: Conectar WhatsApp
  ├── setup/products/page.tsx           # Step 4: Primeiro produto
  └── setup/plan/page.tsx               # Step 5: Escolher plano Stripe
  
  apps/web/app/(admin)/
  ├── layout.tsx                        # Super Admin layout
  ├── page.tsx                          # Redirect → /admin/tenants
  └── tenants/
      ├── page.tsx                      # Lista de tenants
      └── [id]/page.tsx                 # Detalhe do tenant
  
  apps/api/src/modules/billing/
  ├── billing.service.ts                # Stripe integration
  ├── billing.controller.ts             # Checkout + webhook Stripe
  └── dto/
  
  apps/api/src/modules/super-admin/
  ├── super-admin.module.ts
  ├── super-admin.service.ts
  └── super-admin.controller.ts
```

---

### Task 1: Onboarding Wizard Multi-Step

**Files:**
- Create: `apps/web/app/(onboarding)/layout.tsx`
- Create: `apps/web/app/(onboarding)/setup/page.tsx`
- Create: `apps/web/app/(onboarding)/setup/company/page.tsx`
- Create: `apps/web/app/(onboarding)/setup/whatsapp/page.tsx`
- Create: `apps/web/app/(onboarding)/setup/plan/page.tsx`

- [ ] **Step 1: Criar onboarding layout**

```tsx
// apps/web/app/(onboarding)/layout.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Check } from "lucide-react";

const STEPS = [
  { id: 1, label: "Conta", href: "/setup" },
  { id: 2, label: "Empresa", href: "/setup/company" },
  { id: 3, label: "WhatsApp", href: "/setup/whatsapp" },
  { id: 4, label: "Produtos", href: "/setup/products" },
  { id: 5, label: "Plano", href: "/setup/plan" },
];

export default async function OnboardingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Record<string, string>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-green-400" />
          </div>
          <span className="font-bold text-white">
            Whats<span className="text-green-400">Agent</span>
          </span>
        </Link>
        
        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1E293B] border border-[#334155] text-[10px] text-slate-400">
                  {step.id}
                </div>
                <span className="text-xs text-slate-500 hidden md:block">{step.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-8 h-px bg-[#1E293B] mx-2" />
              )}
            </div>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {children}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Criar setup/company/page.tsx**

```tsx
// apps/web/app/(onboarding)/setup/company/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const schema = z.object({
  name: z.string().min(2, "Nome muito curto").max(100),
  slug: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
  timezone: z.string().default("America/Sao_Paulo"),
});

type FormData = z.infer<typeof schema>;

export default function CompanySetupPage() {
  const router = useRouter();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { timezone: "America/Sao_Paulo" },
  });

  async function onSubmit(data: FormData) {
    await api.post("tenants/setup", { json: data });
    router.push("/setup/whatsapp");
  }

  const name = form.watch("name") ?? "";
  const autoSlug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 50);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
          <Building2 className="w-6 h-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Sobre sua empresa</h1>
        <p className="text-slate-500 mt-1.5 text-sm">
          Essas informações identificam seu espaço no WhatsAgent
        </p>
      </div>

      <div className="glass-card p-6 space-y-4">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="text-slate-400 text-sm mb-1.5 block">Nome da empresa *</Label>
            <Input
              {...form.register("name")}
              placeholder="Ex: Loja da Maria, Padaria Bella Manhã"
              className="bg-[#0F172A] border-[#334155] text-white h-11"
            />
            {form.formState.errors.name && (
              <p className="text-red-400 text-xs mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label className="text-slate-400 text-sm mb-1.5 block">Subdomínio único *</Label>
            <div className="flex items-center">
              <Input
                {...form.register("slug")}
                defaultValue={autoSlug}
                placeholder="minha-loja"
                className="bg-[#0F172A] border-[#334155] text-white h-11 rounded-r-none"
              />
              <span className="flex items-center h-11 px-3 bg-[#1E293B] border border-l-0 border-[#334155] rounded-r-lg text-slate-500 text-sm whitespace-nowrap">
                .whatsagent.com.br
              </span>
            </div>
            {form.formState.errors.slug && (
              <p className="text-red-400 text-xs mt-1">{form.formState.errors.slug.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full h-11 bg-green-500 hover:bg-green-400 text-white gap-2 font-semibold"
          >
            Continuar
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar setup/whatsapp/page.tsx (Meta API setup)**

```tsx
// apps/web/app/(onboarding)/setup/whatsapp/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, ExternalLink, CheckCircle, ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export default function WhatsAppSetupPage() {
  const router = useRouter();
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [testPassed, setTestPassed] = useState(false);
  const [error, setError] = useState("");

  async function testConnection() {
    setTesting(true);
    setError("");
    try {
      await api.post("tenants/whatsapp/test", {
        json: { phoneNumberId, accessToken },
      });
      setTestPassed(true);
    } catch {
      setError("Conexão falhou. Verifique as credenciais e tente novamente.");
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    await api.post("tenants/whatsapp/connect", {
      json: { phoneNumberId, accessToken },
    });
    router.push("/setup/products");
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 mb-4">
          <MessageSquare className="w-6 h-6 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Conectar WhatsApp</h1>
        <p className="text-slate-500 mt-1.5 text-sm">
          Configure sua conta Meta Business para receber mensagens
        </p>
      </div>

      {/* Instructions */}
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-sm font-medium text-indigo-300">Como configurar</span>
        </div>
        <ol className="text-xs text-slate-400 space-y-1 ml-6 list-decimal">
          <li>Acesse o <a href="https://developers.facebook.com" target="_blank" rel="noopener" className="text-indigo-400 underline">Meta for Developers</a></li>
          <li>Crie um app Business e adicione o produto WhatsApp</li>
          <li>Copie o Phone Number ID e o System User Token</li>
          <li>Configure o webhook apontando para: <code className="text-green-400">https://api.whatsagent.com.br/webhooks/meta</code></li>
        </ol>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div>
          <Label className="text-slate-400 text-sm mb-1.5 block">Phone Number ID *</Label>
          <Input
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="Ex: 123456789012345"
            className="bg-[#0F172A] border-[#334155] text-white h-11 font-mono"
          />
        </div>

        <div>
          <Label className="text-slate-400 text-sm mb-1.5 block">System User Token *</Label>
          <Input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="EAAxxxxxxx..."
            className="bg-[#0F172A] border-[#334155] text-white h-11 font-mono"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {testPassed && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center gap-2 text-sm text-green-400">
            <CheckCircle className="w-4 h-4" />
            Conexão verificada com sucesso!
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={testConnection}
            disabled={!phoneNumberId || !accessToken || testing}
            className="flex-1 border-[#334155] text-slate-300 h-11"
          >
            {testing ? "Testando..." : "Testar Conexão"}
          </Button>
          <Button
            onClick={save}
            disabled={!testPassed}
            className="flex-1 bg-green-500 hover:bg-green-400 text-white h-11 gap-2"
          >
            Continuar
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <button
          onClick={() => router.push("/setup/products")}
          className="w-full text-xs text-slate-600 hover:text-slate-400 cursor-pointer transition-colors"
        >
          Pular por agora (configurar depois)
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(onboarding\)/
git commit -m "feat(web): add multi-step onboarding wizard with company setup and whatsapp connection"
```

---

### Task 2: Stripe Billing Integration

**Files:**
- Create: `apps/api/src/modules/billing/billing.service.ts`
- Create: `apps/api/src/modules/billing/billing.controller.ts`
- Test: `apps/api/src/modules/billing/billing.service.spec.ts`

- [ ] **Step 1: Escrever testes**

```typescript
// apps/api/src/modules/billing/billing.service.spec.ts
import { Test } from "@nestjs/testing";
import { BillingService } from "./billing.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

const STRIPE_PRICE_IDS = {
  STARTER: "price_starter_monthly",
  GROWTH: "price_growth_monthly",
  SCALE: "price_scale_monthly",
  ENTERPRISE: "price_enterprise_monthly",
};

const mockStripe = {
  customers: { create: jest.fn(), retrieve: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  subscriptions: { retrieve: jest.fn(), cancel: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
};

jest.mock("stripe", () => jest.fn().mockImplementation(() => mockStripe));

const mockPrisma = {
  platformBilling: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  tenant: { findUnique: jest.fn(), update: jest.fn() },
};

describe("BillingService", () => {
  let service: BillingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue("sk_test_xxx") } },
      ],
    }).compile();
    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
  });

  it("deve criar sessão Stripe Checkout para plano GROWTH", async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: "tenant-123",
      name: "Loja Teste",
      billing: null,
    });
    mockStripe.customers.create.mockResolvedValue({ id: "cus_test123" });
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_test123",
      url: "https://checkout.stripe.com/...",
    });

    const result = await service.createCheckoutSession("tenant-123", "GROWTH");

    expect(result.checkoutUrl).toContain("stripe.com");
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: expect.arrayContaining([
          expect.objectContaining({ price: STRIPE_PRICE_IDS.GROWTH }),
        ]),
      }),
    );
  });

  it("deve processar webhook de subscription activada", async () => {
    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_test123",
          customer: "cus_test123",
          status: "active",
          items: { data: [{ price: { id: STRIPE_PRICE_IDS.GROWTH } }] },
        },
      },
    };

    mockStripe.webhooks.constructEvent.mockReturnValue(event);
    mockPrisma.platformBilling.findUnique.mockResolvedValue({
      tenantId: "tenant-123",
    });

    await service.handleWebhook(Buffer.from("payload"), "test_sig");

    expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planType: "GROWTH" }),
      }),
    );
  });
});
```

- [ ] **Step 2: Implementar BillingService**

```typescript
// apps/api/src/modules/billing/billing.service.ts
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma/prisma.service";
import Stripe from "stripe";
import type { PlanType } from "@prisma/client";

const STRIPE_PRICE_MAP: Record<PlanType, string> = {
  STARTER: process.env.STRIPE_PRICE_STARTER ?? "price_starter",
  GROWTH: process.env.STRIPE_PRICE_GROWTH ?? "price_growth",
  SCALE: process.env.STRIPE_PRICE_SCALE ?? "price_scale",
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE ?? "price_enterprise",
};

const PLAN_MESSAGE_LIMITS: Record<PlanType, number> = {
  STARTER: 500,
  GROWTH: 5000,
  SCALE: 20000,
  ENTERPRISE: 999999,
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripe = new Stripe(config.get<string>("stripe.secretKey") as string, {
      apiVersion: "2024-11-20.acacia",
    });
  }

  async createCheckoutSession(
    tenantId: string,
    plan: PlanType,
  ): Promise<{ checkoutUrl: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { billing: true },
    });

    if (!tenant) throw new NotFoundException("Tenant not found");

    // Criar ou recuperar customer no Stripe
    let stripeCustomerId = tenant.billing?.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await this.stripe.customers.create({
        name: tenant.name,
        metadata: { tenantId },
      });
      stripeCustomerId = customer.id;
    }

    const frontendUrl = this.config.get<string>("frontendUrl") ?? "http://localhost:3000";

    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: STRIPE_PRICE_MAP[plan],
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/setup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/setup/plan?canceled=true`,
      metadata: { tenantId, plan },
      subscription_data: {
        metadata: { tenantId },
        trial_period_days: 14,
      },
      allow_promotion_codes: true,
    });

    // Salvar customer ID no banco
    await this.prisma.platformBilling.upsert({
      where: { tenantId },
      create: { tenantId, stripeCustomerId, currentPlan: "STARTER", messagesLimit: 500 },
      update: { stripeCustomerId },
    });

    return { checkoutUrl: session.url as string };
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const secret = this.config.get<string>("stripe.webhookSecret") as string;
    
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      throw new Error("Invalid Stripe webhook signature");
    }

    this.logger.log(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await this.syncSubscription(sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await this.cancelSubscription(sub);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        this.logger.log(`Payment succeeded for customer: ${invoice.customer}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handlePaymentFailed(invoice);
        break;
      }
    }
  }

  private async syncSubscription(sub: Stripe.Subscription): Promise<void> {
    const tenantId = sub.metadata?.["tenantId"];
    if (!tenantId) return;

    const priceId = sub.items.data[0]?.price?.id;
    const plan = Object.entries(STRIPE_PRICE_MAP).find(([, v]) => v === priceId)?.[0] as PlanType | undefined;
    
    if (!plan) {
      this.logger.warn(`Unknown price ID: ${priceId}`);
      return;
    }

    await Promise.all([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          planType: plan,
          status: sub.status === "active" || sub.status === "trialing" ? "ACTIVE" : "SUSPENDED",
        },
      }),
      this.prisma.platformBilling.update({
        where: { tenantId },
        data: {
          currentPlan: plan,
          messagesLimit: PLAN_MESSAGE_LIMITS[plan],
          stripeSubId: sub.id,
          billingCycleStart: new Date((sub.current_period_start ?? 0) * 1000),
          billingCycleEnd: new Date((sub.current_period_end ?? 0) * 1000),
        },
      }),
    ]);
  }

  private async cancelSubscription(sub: Stripe.Subscription): Promise<void> {
    const tenantId = sub.metadata?.["tenantId"];
    if (!tenantId) return;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "CANCELLED", planType: "STARTER" },
    });
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const billing = await this.prisma.platformBilling.findUnique({
      where: { stripeCustomerId: invoice.customer as string } as any,
    });

    if (billing) {
      await this.prisma.tenant.update({
        where: { id: billing.tenantId },
        data: { status: "SUSPENDED" },
      });
    }
  }
}
```

- [ ] **Step 3: Rodar testes**

```bash
pnpm test billing.service
```

Expected: PASS — 2 testes passando

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/billing/
git commit -m "feat(api): add stripe subscription billing with checkout, webhook and plan sync"
```

---

### Task 3: Super Admin Panel

**Files:**
- Create: `apps/web/app/(admin)/tenants/page.tsx`
- Create: `apps/api/src/modules/super-admin/super-admin.service.ts`
- Create: `apps/api/src/modules/super-admin/super-admin.controller.ts`

- [ ] **Step 1: Implementar Super Admin Service**

```typescript
// apps/api/src/modules/super-admin/super-admin.service.ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  planType: string;
  whatsappStatus: string;
  messagesThisMonth: number;
  messagesLimit: number;
  totalRevenue: number;
  totalConversations: number;
  createdAt: Date;
}

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllTenants(page = 1, limit = 25): Promise<{
    items: TenantSummary[];
    total: number;
  }> {
    const skip = (page - 1) * limit;

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          billing: {
            select: { messagesThisMonth: true, messagesLimit: true, currentPlan: true },
          },
          _count: {
            select: { conversations: true, orders: true },
          },
        },
      }),
      this.prisma.tenant.count(),
    ]);

    const summaries: TenantSummary[] = await Promise.all(
      tenants.map(async (t) => {
        const revenue = await this.prisma.payment.aggregate({
          where: { tenantId: t.id, status: "APPROVED" },
          _sum: { amountCents: true },
        });

        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          status: t.status,
          planType: t.billing?.currentPlan ?? "STARTER",
          whatsappStatus: t.whatsappStatus,
          messagesThisMonth: t.billing?.messagesThisMonth ?? 0,
          messagesLimit: t.billing?.messagesLimit ?? 500,
          totalRevenue: revenue._sum.amountCents ?? 0,
          totalConversations: t._count.conversations,
          createdAt: t.createdAt,
        };
      }),
    );

    return { items: summaries, total };
  }

  async getPlatformKpis(): Promise<Record<string, number>> {
    const [
      totalTenants,
      activeTenants,
      totalConversations,
      totalRevenue,
      messagesThisMonth,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: "ACTIVE" } }),
      this.prisma.conversation.count(),
      this.prisma.payment.aggregate({
        where: { status: "APPROVED" },
        _sum: { amountCents: true },
      }),
      this.prisma.platformBilling.aggregate({
        _sum: { messagesThisMonth: true },
      }),
    ]);

    return {
      total_tenants: totalTenants,
      active_tenants: activeTenants,
      total_conversations: totalConversations,
      total_revenue_cents: totalRevenue._sum.amountCents ?? 0,
      messages_this_month: messagesThisMonth._sum.messagesThisMonth ?? 0,
    };
  }

  async suspendTenant(tenantId: string): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "SUSPENDED" },
    });
  }

  async activateTenant(tenantId: string): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "ACTIVE" },
    });
  }
}
```

- [ ] **Step 2: Criar Super Admin Tenants Page**

```tsx
// apps/web/app/(admin)/tenants/page.tsx
import { Header } from "@/components/layout/Header";
import { api } from "@/lib/api";
import { Building2, CheckCircle, XCircle, AlertTriangle, MessageSquare } from "lucide-react";

async function getTenants() {
  try {
    return await api.get("super-admin/tenants").json<{
      items: any[];
      total: number;
    }>();
  } catch {
    return { items: [], total: 0 };
  }
}

async function getPlatformKpis() {
  try {
    return await api.get("super-admin/kpis").json<Record<string, number>>();
  } catch {
    return {
      total_tenants: 0, active_tenants: 0,
      total_conversations: 0, total_revenue_cents: 0, messages_this_month: 0,
    };
  }
}

export default async function SuperAdminTenantsPage() {
  const [{ items: tenants, total }, kpis] = await Promise.all([
    getTenants(),
    getPlatformKpis(),
  ]);

  return (
    <div className="animate-fade-in">
      <Header title="Super Admin" subtitle={`${total} tenants na plataforma`} />

      <div className="p-6 space-y-6">
        {/* Platform KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total Tenants", value: kpis.total_tenants, icon: Building2 },
            { label: "Tenants Ativos", value: kpis.active_tenants, icon: CheckCircle },
            { label: "Conversas", value: kpis.total_conversations?.toLocaleString("pt-BR"), icon: MessageSquare },
            { label: "Receita Total", value: `R$ ${((kpis.total_revenue_cents ?? 0) / 100).toLocaleString("pt-BR")}`, icon: null },
            { label: "Msgs este Mês", value: kpis.messages_this_month?.toLocaleString("pt-BR"), icon: null },
          ].map((k) => (
            <div key={k.label} className="glass-card p-4">
              <p className="text-xs text-slate-500 mb-1">{k.label}</p>
              <p className="text-xl font-bold text-white">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Tenants Table */}
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E293B]">
            <h3 className="text-sm font-semibold text-white">Todos os Tenants</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  {["Tenant", "Plano", "WhatsApp", "Msgs/Limite", "Receita", "Conversas", "Status", "Ações"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((t: any) => (
                  <tr key={t.id} className="border-b border-[#1E293B]/50 hover:bg-[#0F172A]/50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-white">{t.name}</p>
                        <p className="text-xs text-slate-500">{t.slug}.whatsagent.com.br</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
                        {t.planType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs ${
                        t.whatsappStatus === "CONNECTED" ? "text-green-400" : "text-slate-500"
                      }`}>
                        {t.whatsappStatus === "CONNECTED" ? (
                          <CheckCircle className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        {t.whatsappStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {t.messagesThisMonth}/{t.messagesLimit}
                      <div className="w-20 h-1 bg-slate-800 rounded-full mt-1">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${Math.min(100, (t.messagesThisMonth / t.messagesLimit) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-green-400 font-medium text-xs">
                      R$ {((t.totalRevenue ?? 0) / 100).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {t.totalConversations?.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <TenantStatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/admin/tenants/${t.id}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      >
                        Detalhes →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function TenantStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: typeof CheckCircle }> = {
    ACTIVE: { label: "Ativo", cls: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle },
    TRIAL: { label: "Trial", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: AlertTriangle },
    SUSPENDED: { label: "Suspenso", cls: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
    CANCELLED: { label: "Cancelado", cls: "bg-slate-700 text-slate-500 border-slate-600", icon: XCircle },
  };
  const { label, cls, icon: Icon } = map[status] ?? map["SUSPENDED"]!;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(admin\)/ apps/api/src/modules/super-admin/ apps/api/src/modules/billing/
git commit -m "feat: add super admin panel with tenant management and stripe billing integration"
```

---

## Verificação do Plan 6

- [ ] Onboarding wizard: criar conta → preencher empresa → conectar WA → escolher plano
- [ ] Slug único: `minha-loja.whatsagent.com.br` (rota Nginx/subdomínio)
- [ ] Stripe Checkout abre corretamente com plano selecionado
- [ ] Webhook Stripe atualiza status do tenant após pagamento de teste
- [ ] Após cancelamento → tenant vai para CANCELLED e perde acesso
- [ ] Super Admin (`/admin`) acessível somente com role OPERATOR
- [ ] Tabela de tenants mostra todos com métricas corretas
- [ ] Suspender tenant via API → status muda para SUSPENDED
- [ ] `pnpm turbo test` → todos os testes passando em todos os apps
- [ ] `docker compose up -d` → todos os serviços healthy
- [ ] E2E: Mensagem WhatsApp → webhook → queue → LangGraph → resposta enviada → aparece no Inbox em tempo real

---

## Checklist Final de Entrega (Produto Completo)

### Funcional
- [ ] WhatsApp recebe e responde mensagens de texto e áudio
- [ ] Catálogo pesquisável semanticamente (pgvector)
- [ ] Pagamento Pix gerado e confirmado automaticamente
- [ ] Handoff para humano funciona em tempo real
- [ ] Guard rails bloqueiam respostas indevidas
- [ ] Multi-tenant: cada empresa vê apenas seus dados
- [ ] Dashboard Analytics com KPIs, funil e heatmap
- [ ] Rule Builder sem código

### Segurança
- [ ] Todas as rotas protegidas por ClerkAuthGuard
- [ ] RBAC com roles por tenant
- [ ] Webhook HMAC validado (Meta + Stripe + Mercado Pago)
- [ ] Tenant isolation: tenant_id verificado em todos os queries
- [ ] Dados sensíveis (access tokens) encriptados em repouso
- [ ] Rate limiting nos endpoints públicos

### Performance
- [ ] p95 de resposta do AI Orchestrator < 5s
- [ ] Webhook Meta responde em < 500ms
- [ ] Dashboard carrega em < 2s (SSR)
- [ ] Busca semântica retorna em < 200ms (pgvector HNSW index)

### Infra
- [ ] Docker Compose local funcional (todos os devs)
- [ ] GitHub Actions CI passa (lint + test + build)
- [ ] Variáveis de ambiente documentadas em .env.example
- [ ] Migrations Prisma versionadas no git
