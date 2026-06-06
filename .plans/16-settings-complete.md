# Settings Page — Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar as funcionalidades do `/settings` que hoje estão como UI-only, hardcoded ou sem handler, conectando todas as abas a endpoints reais.

**Architecture:** Plano de 8 tarefas organizadas por tab em ordem de prioridade. Tasks 1–2 são backend+frontend para o tab Plano; Tasks 3–4 para Integrações; Tasks 5–6 para Conta; Task 7 para Segurança; Task 8 para Notificações. Cada task é shippable de forma independente.

**Tech Stack:** NestJS (api), Prisma/PostgreSQL, Next.js 14 App Router, @clerk/nextjs, Stripe SDK, TypeScript

---

## Context

A página `/settings` foi implementada com UI completa mas sem funcionalidade real em 4 das 5 tabs:
- **Plano**: dados hardcoded (nome do plano, preço, uso, histórico de faturas)
- **Integrações**: status hardcoded, botões sem handler, URL de webhook hardcoded
- **Conta**: campo `segment` não persiste; botão câmera sem handler; danger zone sem handlers
- **Segurança**: formulário de senha sem handler; sessões hardcoded; 2FA hardcoded
- **Notificações**: toggles sem persistência

O backend já possui `BillingController`, `SettingsController` e integração Stripe. Faltam apenas novos endpoints e pequenas extensões de schema.

Avatar upload foi adiado intencionalmente (sem storage definido).

---

## File Map

| Arquivo | Mudança |
|---|---|
| `apps/api/src/modules/billing/billing.service.ts` | + `getSubscription()`, `getBillingHistory()` |
| `apps/api/src/modules/billing/billing.controller.ts` | + `GET /billing/subscription`, `GET /billing/history` |
| `apps/api/src/modules/settings/settings.service.ts` | + retornar `whatsappStatus`, `whatsappPhoneId`, `segment`; aceitar `segment` no PATCH; + métodos de notifs |
| `apps/api/src/modules/settings/settings.controller.ts` | + `GET/PATCH /settings/notifications` |
| `packages/database/prisma/schema.prisma` | + `segment String?` no Tenant; + `notificationPrefs Json?` no Tenant |
| `apps/web/src/app/(dashboard)/settings/page.tsx` | Todas as tabs — binding de dados, modais, handlers |

---

## Task 1: Adicionar GET /billing/subscription e GET /billing/history (backend)

**Files:**
- Modify: `apps/api/src/modules/billing/billing.service.ts`
- Modify: `apps/api/src/modules/billing/billing.controller.ts`

### Contexto
O `BillingService` já tem `stripe` injetado e acesso ao `prisma`. O modelo `PlatformBilling` tem `conversationsThisMonth`, `conversationsLimit`, `billingCycleStart`, `billingCycleEnd`, `currentPlan`. O `Tenant` tem `planType`, `stripeCustomerId`.

- [ ] **Step 1.1: Adicionar método `getSubscription` ao BillingService**

Abrir `billing.service.ts` e adicionar após os métodos existentes:

```typescript
async getSubscription(tenantId: string) {
  const [billing, tenant] = await Promise.all([
    this.prisma.platformBilling.findUnique({ where: { tenantId } }),
    this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { planType: true, status: true, stripeCustomerId: true } }),
  ]);

  let renewalDate: string | null = null;
  if (tenant?.stripeCustomerId) {
    try {
      const subs = await this.stripe.subscriptions.list({
        customer: tenant.stripeCustomerId,
        status: 'active',
        limit: 1,
      });
      if (subs.data.length > 0) {
        renewalDate = new Date(subs.data[0].current_period_end * 1000).toISOString();
      }
    } catch {
      // Stripe indisponível — prosseguir sem renewalDate
    }
  }

  return {
    plan: tenant?.planType ?? 'STARTER',
    status: tenant?.status ?? 'TRIAL',
    renewalDate,
    usage: {
      conversations: { used: billing?.conversationsThisMonth ?? 0, limit: billing?.conversationsLimit ?? 100 },
      orders: { used: 0, limit: 500 },        // expandir quando tiver campo no modelo
      products: { used: 0, limit: 200 },      // expandir quando tiver campo no modelo
    },
  };
}
```

- [ ] **Step 1.2: Adicionar método `getBillingHistory` ao BillingService**

```typescript
async getBillingHistory(tenantId: string) {
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true },
  });

  if (!tenant?.stripeCustomerId) return { invoices: [] };

  try {
    const invoices = await this.stripe.invoices.list({
      customer: tenant.stripeCustomerId,
      limit: 12,
    });
    return {
      invoices: invoices.data.map((inv) => ({
        id: inv.id,
        date: new Date(inv.created * 1000).toISOString(),
        amount: (inv.amount_paid / 100).toFixed(2),
        currency: inv.currency.toUpperCase(),
        status: inv.status,
        pdfUrl: inv.invoice_pdf,
      })),
    };
  } catch {
    return { invoices: [] };
  }
}
```

- [ ] **Step 1.3: Adicionar endpoints ao BillingController**

```typescript
@Get('subscription')
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN)
getSubscription(@CurrentTenantId() tenantId: string) {
  return this.billingService.getSubscription(tenantId);
}

@Get('history')
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN)
getBillingHistory(@CurrentTenantId() tenantId: string) {
  return this.billingService.getBillingHistory(tenantId);
}
```

- [ ] **Step 1.4: Testar os endpoints**

```bash
pnpm --filter @whatsagent/api dev
# Em outro terminal:
curl -H "Authorization: Bearer <clerk_token>" http://localhost:3002/billing/subscription
curl -H "Authorization: Bearer <clerk_token>" http://localhost:3002/billing/history
```

Esperado: `{ plan: "GROWTH", status: "ACTIVE", renewalDate: "...", usage: {...} }` e `{ invoices: [...] }`

- [ ] **Step 1.5: Commit**

```bash
git add apps/api/src/modules/billing/
git commit -m "feat(api): add GET /billing/subscription and GET /billing/history endpoints"
```

---

## Task 2: Tab Plano — bind dados reais (frontend)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx` (função `TabPlano`)

### Contexto
`TabPlano()` tem dados hardcoded. O `useApi()` hook já está disponível no arquivo. Os novos endpoints são `GET /billing/subscription` e `GET /billing/history`.

**Mapeamento de plano → preço (R$):**
- STARTER → 97
- GROWTH → 297
- SCALE → 497
- ENTERPRISE → sob consulta

- [ ] **Step 2.1: Adicionar state e fetch ao TabPlano**

Substituir a função `TabPlano()` completa:

```tsx
function TabPlano() {
  const { apiFetch } = useApi();
  const [sub, setSub] = useState<{
    plan: string; status: string; renewalDate: string | null;
    usage: { conversations: { used: number; limit: number }; orders: { used: number; limit: number }; products: { used: number; limit: number } };
  } | null>(null);
  const [invoices, setInvoices] = useState<{
    id: string; date: string; amount: string; currency: string; status: string | null; pdfUrl: string | null;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  const PLAN_PRICE: Record<string, string> = {
    STARTER: "R$ 97/mês", GROWTH: "R$ 297/mês", SCALE: "R$ 497/mês", ENTERPRISE: "Sob consulta",
  };
  const PLAN_FEATURES: Record<string, string[]> = {
    STARTER: ["100 conversas/mês", "Agente IA com LangGraph", "Suporte por email"],
    GROWTH: ["Conversas ilimitadas", "Agente IA com LangGraph", "Catálogo de produtos", "Links de pagamento", "Analytics avançado", "Suporte prioritário"],
    SCALE: ["Tudo do Growth", "Multi-atendentes", "API access", "SLA garantido"],
    ENTERPRISE: ["Customizado", "Infraestrutura dedicada"],
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [subRes, histRes] = await Promise.all([
        apiFetch("/billing/subscription"),
        apiFetch("/billing/history"),
      ]);
      if (subRes.ok) setSub(await subRes.json());
      if (histRes.ok) {
        const data = await histRes.json();
        setInvoices(data.invoices ?? []);
      }
      setLoading(false);
    }
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const planName = sub?.plan ?? "STARTER";
  const renewalDisplay = sub?.renewalDate
    ? new Date(sub.renewalDate).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Carregando...</div>;
  }

  return (
    <div className="settings-tab-content">
      <SectionPanel title="Plano atual" description={PLAN_PRICE[planName] ?? "—"} accent="#22c55e">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-bold text-white">{planName.charAt(0) + planName.slice(1).toLowerCase()}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
            {sub?.status === "ACTIVE" ? "Ativo" : sub?.status === "TRIAL" ? "Trial" : sub?.status ?? "—"}
          </span>
        </div>
        <ul className="space-y-2 mb-6">
          {(PLAN_FEATURES[planName] ?? []).map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" /> {f}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500 mb-4">Renova em {renewalDisplay}</p>
        <button className="settings-btn-primary flex items-center gap-2">
          <ArrowUpRight className="w-4 h-4" /> Ver planos
        </button>
      </SectionPanel>

      <SectionPanel title="Uso do mês" accent="#6366f1">
        {([
          { label: "Conversas", color: "#6366f1", key: "conversations" as const },
          { label: "Pedidos",   color: "#22c55e", key: "orders" as const },
          { label: "Produtos",  color: "#f59e0b", key: "products" as const },
        ] as const).map(({ label, color, key }) => {
          const u = sub?.usage[key] ?? { used: 0, limit: 1 };
          const pct = Math.min((u.used / u.limit) * 100, 100);
          return (
            <div key={key} className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">{label}</span>
                <span className="text-slate-400">{u.used}/{u.limit}</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </SectionPanel>

      <SectionPanel title="Histórico de faturas" accent="#6366f1">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-slate-500">
            <CreditCard className="w-8 h-8" />
            <p className="text-sm">Nenhum pagamento registrado ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div>
                  <p className="text-sm text-white">{new Date(inv.date).toLocaleDateString("pt-BR")}</p>
                  <p className="text-xs text-slate-500">{inv.status}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white">{inv.currency} {inv.amount}</span>
                  {inv.pdfUrl && (
                    <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionPanel>
    </div>
  );
}
```

- [ ] **Step 2.2: Verificar no browser**

```bash
pnpm --filter @whatsagent/web dev
```

Navegar para `/settings` → tab **Plano**. Deve exibir plano real, barras de uso e histórico de faturas (ou estado vazio se sem faturas).

- [ ] **Step 2.3: Commit**

```bash
git add apps/web/src/app/(dashboard)/settings/page.tsx
git commit -m "feat(web): bind Plano tab to real billing API data"
```

---

## Task 3: Expor whatsappStatus e whatsappPhoneId no GET /settings/company (backend)

**Files:**
- Modify: `apps/api/src/modules/settings/settings.service.ts`
- Modify: `apps/api/src/modules/settings/settings.controller.ts` (verificar DTO de retorno)

### Contexto
`GET /settings/company` retorna `{ name, slug, timezone }`. O modelo `Tenant` já tem `whatsappStatus` (enum: `CONNECTED`, `DISCONNECTED`, `PENDING`) e `whatsappPhoneId`. O tab Integrações precisa desses campos para exibir status real.

- [ ] **Step 3.1: Atualizar SettingsService para incluir campos WhatsApp**

No método `getCompanySettings` (ou equivalente) do `settings.service.ts`, adicionar ao select do Prisma:

```typescript
// Localizar a query de leitura de Tenant e adicionar:
select: {
  name: true,
  slug: true,
  timezone: true,
  whatsappStatus: true,
  whatsappPhoneId: true,
  // ... outros campos já existentes
}
```

E incluir no objeto de retorno:
```typescript
return {
  name: tenant.name,
  slug: tenant.slug,
  timezone: tenant.timezone,
  whatsappStatus: tenant.whatsappStatus,   // "CONNECTED" | "DISCONNECTED" | "PENDING"
  whatsappPhoneId: tenant.whatsappPhoneId, // string | null
};
```

- [ ] **Step 3.2: Testar o endpoint**

```bash
curl -H "Authorization: Bearer <clerk_token>" http://localhost:3002/settings/company
```

Esperado: `{ "name": "...", "slug": "...", "timezone": "...", "whatsappStatus": "DISCONNECTED", "whatsappPhoneId": null }`

- [ ] **Step 3.3: Commit**

```bash
git add apps/api/src/modules/settings/
git commit -m "feat(api): expose whatsappStatus and whatsappPhoneId in GET /settings/company"
```

---

## Task 4: Tab Integrações — status real + modal de configuração WhatsApp (frontend)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx` (função `TabIntegracoes`)

### Contexto
- WhatsApp: status e phoneId já vêm do `GET /settings/company` (após Task 3). O endpoint `PATCH /settings/whatsapp` já existe e aceita `{ phoneId, metaAccessToken }`.
- OpenAI: sempre "Conectado" (configurado via env no backend; ou falha silenciosamente).
- Stripe: "Conectado" se `tenant.stripeCustomerId` existe — já disponível via `/billing/subscription` (campo `status`).
- MercadoPago: a integração é via env vars no backend (webhooks), sem OAuth. Mostrar "Configurado via servidor" sempre, sem botão de conectar.
- Webhook URL: `${process.env.NEXT_PUBLIC_API_URL}/webhooks/meta` — dinâmica por env.

- [ ] **Step 4.1: Substituir `TabIntegracoes` completa**

```tsx
function TabIntegracoes() {
  const { apiFetch } = useApi();
  const [company, setCompany] = useState<{ whatsappStatus: string; whatsappPhoneId: string | null } | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [phoneId, setPhoneId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [savingWA, setSavingWA] = useState(false);
  const [savedWA, setSavedWA] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "https://api.whatsagent.app"}/webhooks/meta`;

  useEffect(() => {
    apiFetch("/settings/company").then(async (r) => {
      if (r.ok) setCompany(await r.json());
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSaveWhatsApp = async () => {
    setSavingWA(true);
    const res = await apiFetch("/settings/whatsapp", {
      method: "PATCH",
      body: JSON.stringify({ phoneId, metaAccessToken: accessToken }),
    });
    setSavingWA(false);
    if (res.ok) {
      setSavedWA(true);
      setShowWhatsAppModal(false);
      setCompany((c) => c ? { ...c, whatsappPhoneId: phoneId, whatsappStatus: "PENDING" } : c);
      setTimeout(() => setSavedWA(false), 2000);
    }
  };

  const waStatus = company?.whatsappStatus ?? "DISCONNECTED";
  const isWAConnected = waStatus === "CONNECTED";

  const INTEGRATIONS = [
    {
      key: "whatsapp",
      name: "Meta Cloud API",
      color: "#f59e0b",
      description: "Recebe mensagens do WhatsApp via webhook oficial da Meta.",
      connected: isWAConnected,
      badge: isWAConnected ? "Conectado" : waStatus === "PENDING" ? "Pendente" : "Desconectado",
      onAction: () => { setPhoneId(company?.whatsappPhoneId ?? ""); setAccessToken(""); setShowWhatsAppModal(true); },
      actionLabel: isWAConnected ? "Gerenciar" : "Configurar",
    },
    {
      key: "openai",
      name: "OpenAI",
      color: "#22c55e",
      description: "LLM e Whisper para transcrição de áudio e geração de respostas.",
      connected: true,
      badge: "Conectado",
      onAction: undefined,
      actionLabel: "Gerenciar",
    },
    {
      key: "stripe",
      name: "Stripe",
      color: "#6366f1",
      description: "Assinatura da plataforma WhatsAgent.",
      connected: true,
      badge: "Conectado",
      onAction: undefined,
      actionLabel: "Gerenciar",
    },
    {
      key: "mercadopago",
      name: "Mercado Pago",
      color: "#06b6d4",
      description: "Pagamentos Pix para seus clientes via WhatsApp.",
      connected: true,
      badge: "Via servidor",
      onAction: undefined,
      actionLabel: undefined,
    },
  ];

  return (
    <div className="settings-tab-content">
      <SectionPanel title="Serviços conectados" accent="#6366f1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {INTEGRATIONS.map((intg) => (
            <div key={intg.key} className="rounded-xl border border-slate-800 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${intg.color}22` }}>
                    <Plug className="w-4 h-4" style={{ color: intg.color }} />
                  </div>
                  <span className="font-medium text-white text-sm">{intg.name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  intg.connected ? "bg-green-500/20 text-green-400" : "bg-slate-700 text-slate-400"
                }`}>{intg.badge}</span>
              </div>
              <p className="text-xs text-slate-500">{intg.description}</p>
              {intg.actionLabel && (
                <button
                  onClick={intg.onAction}
                  className={`settings-btn-sm flex items-center gap-1 self-start ${intg.connected ? "settings-btn-ghost" : "settings-btn-primary"}`}
                >
                  {intg.actionLabel} <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </SectionPanel>

      <SectionPanel title="URL de webhook" description="Configure este URL no painel da Meta para receber mensagens." accent="#f59e0b">
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-slate-800 rounded-lg px-3 py-2 text-slate-300 break-all">{webhookUrl}</code>
          <button onClick={handleCopyWebhook} className="settings-btn-ghost p-2 rounded-lg shrink-0">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Key className="w-4 h-4" />}
          </button>
        </div>
      </SectionPanel>

      {/* Modal de configuração WhatsApp */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Configurar Meta Cloud API</h3>
              <button onClick={() => setShowWhatsAppModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Phone Number ID</label>
                <input
                  type="text"
                  value={phoneId}
                  onChange={(e) => setPhoneId(e.target.value)}
                  placeholder="123456789012345"
                  className="settings-input w-full"
                />
                <p className="text-xs text-slate-500 mt-1">Encontrado em Meta for Developers → seu app → WhatsApp → Phone Numbers</p>
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Access Token</label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAxxxxxxxxxxxxxxxx"
                  className="settings-input w-full"
                />
                <p className="text-xs text-slate-500 mt-1">Token permanente gerado no Meta Business Suite</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowWhatsAppModal(false)} className="settings-btn-ghost flex-1">
                Cancelar
              </button>
              <button
                onClick={handleSaveWhatsApp}
                disabled={!phoneId || !accessToken || savingWA}
                className="settings-btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {savingWA ? <span className="animate-spin">⟳</span> : savedWA ? <Check className="w-4 h-4" /> : null}
                {savingWA ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4.2: Verificar no browser**

Navegar para `/settings` → tab **Integrações**. Verificar:
- Status do WhatsApp reflete dado real (DISCONNECTED por padrão)
- Clicar "Configurar" abre o modal
- Preencher phoneId + token e salvar chama `PATCH /settings/whatsapp`
- URL do webhook é correta

- [ ] **Step 4.3: Commit**

```bash
git add apps/web/src/app/(dashboard)/settings/page.tsx
git commit -m "feat(web): wire Integrações tab with real WhatsApp status and config modal"
```

---

## Task 5: Adicionar campo `segment` ao Tenant (backend + migration)

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `apps/api/src/modules/settings/settings.service.ts`
- New migration via Prisma CLI

### Contexto
O tab Conta tem um dropdown de segmento (E-commerce, Serviços, Alimentação, Moda, Tecnologia) que não persiste pois o modelo `Tenant` não tem esse campo. O backend precisa aceitar e retornar `segment`.

- [ ] **Step 5.1: Adicionar campo ao schema Prisma**

Em `packages/database/prisma/schema.prisma`, dentro do modelo `Tenant`, adicionar após o campo `timezone`:

```prisma
segment  String?  // e.g. "ecommerce" | "servicos" | "alimentacao" | "moda" | "tech"
```

- [ ] **Step 5.2: Gerar e aplicar migration**

```bash
pnpm --filter @whatsagent/database migrate:dev
# Quando pedir nome: settings_add_tenant_segment
```

Verificar que a migration foi criada em `packages/database/prisma/migrations/`.

- [ ] **Step 5.3: Atualizar SettingsService**

No método de GET, adicionar `segment: true` ao select e incluir no retorno.

No método de PATCH, aceitar `segment` do body e incluir no `data` do update:

```typescript
// No DTO de entrada (ou diretamente no método):
// Aceitar: { name?: string; timezone?: string; segment?: string }

// Na query de update:
await this.prisma.tenant.update({
  where: { id: tenantId },
  data: {
    ...(name !== undefined && { name }),
    ...(timezone !== undefined && { timezone }),
    ...(segment !== undefined && { segment }),
  },
});
```

- [ ] **Step 5.4: Testar**

```bash
curl -X PATCH http://localhost:3002/settings/company \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"segment": "ecommerce"}'
# Esperado: 200 OK com o tenant atualizado

curl http://localhost:3002/settings/company \
  -H "Authorization: Bearer <token>"
# Esperado: inclui "segment": "ecommerce"
```

- [ ] **Step 5.5: Commit**

```bash
git add packages/database/prisma/ apps/api/src/modules/settings/
git commit -m "feat(api): add segment field to Tenant with migration and settings endpoints"
```

---

## Task 6: Tab Conta — persistir segment + remover câmera + danger zone (frontend)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx` (função `TabConta`)

### Contexto
- O campo `segment` não está no `useEffect` de load nem no `handleSave`. Precisamos incluí-lo.
- O botão de câmera (avatar upload) foi adiado — trocar por um `<span>` ou `<div>` não clicável, ou simplesmente remover.
- "Excluir conta": abrir um `<UserProfile>` do Clerk num modal (cobre exclusão de conta) ou mostrar dialog de confirmação que redireciona para suporte.
- "Encerrar todas as sessões": usar `useClerk().signOut()` que invalida a sessão atual (multi-device sign-out requer backend Clerk).

- [ ] **Step 6.1: Adicionar imports necessários**

No topo do arquivo, adicionar à importação do clerk:

```typescript
import { useClerk } from "@clerk/nextjs";
```

- [ ] **Step 6.2: Atualizar `TabConta`**

Dentro da função `TabConta()`:

```typescript
const { signOut } = useClerk();
const [segment, setSegment] = useState("ecommerce");

// No useEffect de load, adicionar:
setSegment(data.segment ?? "ecommerce");

// No handleSave, adicionar segment ao body:
body: JSON.stringify({ name, timezone, segment }),
```

- [ ] **Step 6.3: Remover o botão de câmera**

Localizar o elemento com câmera (ícone `Camera`) e substituir a div clicável por um avatar estático:

```tsx
{/* Avatar — upload adiado, exibição estática */}
<div className="settings-avatar">
  <User className="w-8 h-8 text-slate-400" />
</div>
```

- [ ] **Step 6.4: Wire danger zone buttons**

```tsx
{/* Encerrar todas as sessões */}
<button
  onClick={() => signOut()}
  className="settings-btn-danger flex items-center gap-2"
>
  <LogOut className="w-4 h-4" /> Encerrar sessão atual
</button>

{/* Excluir conta — redireciona ao suporte */}
<button
  onClick={() => window.open("mailto:suporte@whatsagent.app?subject=Solicitar exclusão de conta", "_blank")}
  className="settings-btn-danger flex items-center gap-2"
>
  <Trash2 className="w-4 h-4" /> Excluir conta
</button>
```

> **Nota:** Exclusão de conta em SaaS multi-tenant requer deprovisionamento no backend (cancelar Stripe, deletar dados). Redirecionar ao suporte é a abordagem correta até implementar o fluxo completo.

- [ ] **Step 6.5: Verificar no browser**

Navegar para `/settings` → tab **Conta**. Verificar:
- Salvar com um segmento diferente → reload → segmento persiste
- Botão câmera foi removido
- "Encerrar sessão" chama signOut()

- [ ] **Step 6.6: Commit**

```bash
git add apps/web/src/app/(dashboard)/settings/page.tsx
git commit -m "feat(web): wire Conta tab segment field, remove avatar stub, wire danger zone"
```

---

## Task 7: Tab Segurança — embed Clerk UserProfile (frontend)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx` (função `TabSeguranca`)

### Contexto
O tab Segurança tem formulário custom de troca de senha e 2FA hardcoded. Como o auth é gerenciado pelo Clerk, **nunca** implementar senha custom — usar o `<UserProfile>` do Clerk que oferece troca de senha, 2FA e gestão de sessões fora da caixa.

- [ ] **Step 7.1: Adicionar import do UserProfile**

```typescript
import { UserProfile } from "@clerk/nextjs";
```

- [ ] **Step 7.2: Substituir `TabSeguranca` completa**

```tsx
function TabSeguranca() {
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="settings-tab-content">
      <SectionPanel
        title="Senha e autenticação"
        description="Gerencie sua senha, autenticação em dois fatores e sessões ativas."
        accent="#6366f1"
      >
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-indigo-400" />
            <div>
              <p className="text-sm font-medium text-white">Segurança da conta</p>
              <p className="text-xs text-slate-500">Senha, 2FA e sessões ativas gerenciados pelo Clerk</p>
            </div>
          </div>
          <button
            onClick={() => setShowProfile(true)}
            className="settings-btn-primary flex items-center gap-2"
          >
            <Key className="w-4 h-4" /> Gerenciar
          </button>
        </div>
      </SectionPanel>

      {/* Modal Clerk UserProfile */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowProfile(false)}
              className="absolute top-2 right-2 z-10 text-slate-400 hover:text-white bg-slate-900 rounded-full p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <UserProfile routing="hash" />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7.3: Verificar no browser**

Navegar para `/settings` → tab **Segurança**. Clicar "Gerenciar" → modal Clerk abre com opções de senha, 2FA e sessões ativas. Fechar com X funciona.

- [ ] **Step 7.4: Commit**

```bash
git add apps/web/src/app/(dashboard)/settings/page.tsx
git commit -m "feat(web): replace Segurança tab stubs with Clerk UserProfile modal"
```

---

## Task 8: Persistir preferências de Notificações (backend + frontend)

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `apps/api/src/modules/settings/settings.service.ts`
- Modify: `apps/api/src/modules/settings/settings.controller.ts`
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx` (função `TabNotificacoes`)

### Contexto
O tab de Notificações tem 6 toggles que hoje são estado local sem persistência. A solução mais simples é adicionar um campo `notificationPrefs Json?` ao `Tenant` e expor dois endpoints: `GET /settings/notifications` e `PATCH /settings/notifications`.

**Estrutura do JSON:**
```json
{
  "newMessage": true,
  "handoffPending": true,
  "orderCreated": true,
  "paymentConfirmed": true,
  "weeklyReport": false,
  "productUpdates": false
}
```

- [ ] **Step 8.1: Adicionar campo ao schema Prisma**

Em `packages/database/prisma/schema.prisma`, dentro do modelo `Tenant`:

```prisma
notificationPrefs Json?  // { newMessage, handoffPending, orderCreated, paymentConfirmed, weeklyReport, productUpdates }
```

- [ ] **Step 8.2: Gerar e aplicar migration**

```bash
pnpm --filter @whatsagent/database migrate:dev
# Nome da migration: settings_add_notification_prefs
```

- [ ] **Step 8.3: Adicionar métodos ao SettingsService**

```typescript
async getNotificationPrefs(tenantId: string) {
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { notificationPrefs: true },
  });
  const defaults = {
    newMessage: true, handoffPending: true,
    orderCreated: true, paymentConfirmed: true,
    weeklyReport: false, productUpdates: false,
  };
  return { ...(typeof tenant?.notificationPrefs === 'object' ? tenant.notificationPrefs as object : {}), ...defaults,
           ...(typeof tenant?.notificationPrefs === 'object' ? tenant.notificationPrefs as object : {}) };
}

async updateNotificationPrefs(tenantId: string, prefs: Record<string, boolean>) {
  await this.prisma.tenant.update({
    where: { id: tenantId },
    data: { notificationPrefs: prefs },
  });
  return prefs;
}
```

> **Nota sobre merge:** o return do `getNotificationPrefs` garante que novos campos tenham defaults mesmo que o JSON salvo seja antigo.

- [ ] **Step 8.4: Adicionar endpoints ao SettingsController**

```typescript
@Get('notifications')
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN)
getNotifications(@CurrentTenantId() tenantId: string) {
  return this.settingsService.getNotificationPrefs(tenantId);
}

@Patch('notifications')
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN)
updateNotifications(@CurrentTenantId() tenantId: string, @Body() body: Record<string, boolean>) {
  return this.settingsService.updateNotificationPrefs(tenantId, body);
}
```

- [ ] **Step 8.5: Atualizar `TabNotificacoes` para persistência**

Substituir a função `TabNotificacoes()` completa:

```tsx
type NotifPrefs = {
  newMessage: boolean; handoffPending: boolean;
  orderCreated: boolean; paymentConfirmed: boolean;
  weeklyReport: boolean; productUpdates: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  newMessage: true, handoffPending: true,
  orderCreated: true, paymentConfirmed: true,
  weeklyReport: false, productUpdates: false,
};

function TabNotificacoes() {
  const { apiFetch } = useApi();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch("/settings/notifications").then(async (r) => {
      if (r.ok) setPrefs({ ...DEFAULT_PREFS, ...(await r.json()) });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: keyof NotifPrefs) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    setSaving(true);
    const res = await apiFetch("/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify(prefs),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1800); }
  };

  return (
    <div className="settings-tab-content">
      <SectionPanel title="Conversas" accent="#6366f1">
        <FieldRow label="Nova mensagem recebida" hint="Notifica quando um contato envia mensagem">
          <Toggle checked={prefs.newMessage} onChange={() => toggle("newMessage")} />
        </FieldRow>
        <FieldRow label="Handoff pendente" hint="Alerta quando o agente solicita atendimento humano">
          <Toggle checked={prefs.handoffPending} onChange={() => toggle("handoffPending")} />
        </FieldRow>
      </SectionPanel>

      <SectionPanel title="Pedidos" accent="#22c55e">
        <FieldRow label="Pedido criado" hint="Notifica quando um novo pedido é registrado">
          <Toggle checked={prefs.orderCreated} onChange={() => toggle("orderCreated")} />
        </FieldRow>
        <FieldRow label="Pagamento confirmado" hint="Alerta quando o pagamento é aprovado">
          <Toggle checked={prefs.paymentConfirmed} onChange={() => toggle("paymentConfirmed")} />
        </FieldRow>
      </SectionPanel>

      <SectionPanel title="Relatórios" accent="#f59e0b">
        <FieldRow label="Relatório semanal" hint="Resumo de conversas e pedidos toda segunda-feira">
          <Toggle checked={prefs.weeklyReport} onChange={() => toggle("weeklyReport")} />
        </FieldRow>
        <FieldRow label="Novidades e dicas" hint="Atualizações de produto e melhores práticas">
          <Toggle checked={prefs.productUpdates} onChange={() => toggle("productUpdates")} />
        </FieldRow>
      </SectionPanel>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="settings-btn-primary flex items-center gap-2"
        >
          {saving ? <span className="animate-spin">⟳</span> : saved ? <Check className="w-4 h-4" /> : null}
          {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar preferências"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8.6: Verificar no browser**

Navegar para `/settings` → tab **Notificações**. Verificar:
- Toggles carregam o estado salvo no banco
- Alterar toggles e clicar "Salvar preferências" → reload → estado persiste

- [ ] **Step 8.7: Commit**

```bash
git add packages/database/prisma/ apps/api/src/modules/settings/ apps/web/src/app/(dashboard)/settings/page.tsx
git commit -m "feat: add notification preferences persistence to settings"
```

---

## Verificação End-to-End

Após completar todas as tasks:

- [ ] **Plano:** Navegar `/settings` → Plano → confirmar dados reais (plano, uso, faturas)
- [ ] **Integrações:** Configurar WhatsApp (phoneId + token) → salvar → status muda para PENDING
- [ ] **Conta:** Alterar nome + segmento → salvar → reload → valores persistem
- [ ] **Segurança:** Clicar "Gerenciar" → modal Clerk abre com opções completas de senha/2FA
- [ ] **Notificações:** Alterar toggles → salvar → reload → valores persistem
- [ ] **Testes unitários:** `pnpm --filter @whatsagent/api test` deve passar

```bash
pnpm --filter @whatsagent/api test
pnpm --filter @whatsagent/web lint
```

---

## Ordem de execução recomendada

```
Task 1 (backend billing) → Task 2 (frontend plano) → Task 3 (backend whatsapp status)
→ Task 4 (frontend integrações) → Task 5 (backend segment migration)
→ Task 6 (frontend conta) → Task 7 (frontend segurança) → Task 8 (backend+frontend notifs)
```

Tasks 3+5+8 (backend) podem ser feitas em paralelo antes das respectivas tasks de frontend.
