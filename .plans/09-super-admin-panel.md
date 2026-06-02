# Super Admin Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar a página estática `/tenants` do Super Admin ao backend real, adicionando dados ao vivo, paginação, ações de suspensão/reativação e link de navegação.

**Architecture:** O backend NestJS (`super-admin.service.ts`) já tem os 4 endpoints necessários mas não inclui dados de billing por tenant; o frontend (`(admin)/tenants/page.tsx`) é um componente de servidor com dados mock hardcoded que precisa se tornar client component usando o hook `useApi`. Sem novas rotas, sem novos módulos: apenas conectar o que já existe.

**Tech Stack:** NestJS (Prisma), Next.js 14 App Router, `useApi` hook (Clerk JWT), Tailwind CSS / shadcn glass-card pattern, Lucide React icons.

---

## File Map

| Arquivo | Mudança |
|---------|---------|
| `apps/api/src/modules/super-admin/super-admin.service.ts` | Inclui `billing` no `getAllTenants` |
| `apps/web/src/middleware.ts` | Adiciona `/tenants` às rotas protegidas |
| `apps/web/src/app/(admin)/tenants/page.tsx` | Reescreve como client component com API real, ações e paginação |
| `apps/web/src/components/layout/Sidebar.tsx` | Adiciona link "Super Admin" na navegação |

---

## Task 1: Backend — Include billing data in `getAllTenants`

**Files:**
- Modify: `apps/api/src/modules/super-admin/super-admin.service.ts`

O serviço atual não inclui `billing` no retorno dos tenants. A UI precisa de `conversationsThisMonth` e `conversationsLimit` (do model `PlatformBilling`) para renderizar a barra de progresso.

- [ ] **Step 1: Update `getAllTenants` to include billing**

Substituir o bloco `include` no `findMany`:

```typescript
// apps/api/src/modules/super-admin/super-admin.service.ts
async getAllTenants(page = 1, limit = 25) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    this.prisma.tenant.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { conversations: true } },
        billing: {
          select: { conversationsThisMonth: true, conversationsLimit: true },
        },
      },
    }),
    this.prisma.tenant.count(),
  ]);
  return { items, total };
}
```

O restante do arquivo permanece igual (sem mudança em `getPlatformKpis`, `suspendTenant`, `activateTenant`).

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter @whatsagent/api build
```

Expected: sem erros de tipo. Se `billing` não existir no include, o Prisma vai reclamar — revisar o schema em `packages/database/prisma/schema.prisma` para confirmar a relação `billing` no model `Tenant`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/super-admin/super-admin.service.ts
git commit -m "feat(api): include billing data in super-admin getAllTenants"
```

---

## Task 2: Frontend — Protect `/tenants` in middleware

**Files:**
- Modify: `apps/web/src/middleware.ts`

A rota `/tenants` não está na lista de rotas protegidas pelo Clerk. Qualquer pessoa pode acessar a URL sem estar autenticada (o API retornaria 401, mas a página carregaria de qualquer forma).

- [ ] **Step 1: Add `/tenants` to protected routes**

```typescript
// apps/web/src/middleware.ts
const isProtectedRoute = createRouteMatcher([
  "/setup/(.*)",
  "/overview(.*)",
  "/analytics(.*)",
  "/catalog(.*)",
  "/inbox(.*)",
  "/orders(.*)",
  "/agent(.*)",
  "/settings(.*)",
  "/support(.*)",
  "/tenants(.*)",   // ← adicionar
]);
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "feat(web): protect /tenants admin route in Clerk middleware"
```

---

## Task 3: Frontend — Convert tenants page to live data (API + actions + pagination)

**Files:**
- Modify: `apps/web/src/app/(admin)/tenants/page.tsx`

Reescrita completa: de servidor estático → client component que usa `useApi`, com loading states, suspend/activate via confirm + POST, e paginação simples.

- [ ] **Step 1: Rewrite `tenants/page.tsx`**

```tsx
"use client";
import { Header } from "@/components/layout/Header";
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, Ban, RotateCcw } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useEffect, useState, useCallback } from "react";

const PAGE_SIZE = 25;

interface TenantBilling {
  conversationsThisMonth: number;
  conversationsLimit: number;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELLED";
  planType: string;
  whatsappStatus: "CONNECTED" | "DISCONNECTED";
  billing: TenantBilling | null;
  _count: { conversations: number };
}

interface KPIs {
  total_tenants: number;
  active_tenants: number;
  total_conversations: number;
}

interface TenantsResponse {
  items: Tenant[];
  total: number;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE:    "bg-green-500/10 text-green-400 border-green-500/20",
    TRIAL:     "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    SUSPENDED: "bg-red-500/10 text-red-400 border-red-500/20",
    CANCELLED: "bg-slate-700 text-slate-500 border-slate-600",
  };
  const labels: Record<string, string> = {
    ACTIVE: "Ativo", TRIAL: "Trial", SUSPENDED: "Suspenso", CANCELLED: "Cancelado",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] ?? styles["SUSPENDED"]}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function TenantsPage() {
  const { apiFetch } = useApi();
  const [kpis, setKpis] = useState<KPIs>({ total_tenants: 0, active_tenants: 0, total_conversations: 0 });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const [kpiRes, tenantsRes] = await Promise.all([
          apiFetch("/super-admin/kpis"),
          apiFetch(`/super-admin/tenants?page=${p}&limit=${PAGE_SIZE}`),
        ]);
        if (kpiRes.ok) setKpis(await kpiRes.json() as KPIs);
        if (tenantsRes.ok) {
          const data = await tenantsRes.json() as TenantsResponse;
          setTenants(data.items);
          setTotal(data.total);
        }
      } finally {
        setLoading(false);
      }
    },
    [apiFetch],
  );

  useEffect(() => { void load(page); }, [page, load]);

  async function handleAction(tenantId: string, action: "suspend" | "activate") {
    const label = action === "suspend" ? "suspender" : "reativar";
    if (!confirm(`Tem certeza que deseja ${label} este tenant?`)) return;
    setActionLoading(tenantId);
    try {
      const res = await apiFetch(`/super-admin/tenants/${tenantId}/${action}`, { method: "POST" });
      if (res.ok) await load(page);
    } finally {
      setActionLoading(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const KPI_CARDS = [
    { label: "Total Tenants",   value: kpis.total_tenants },
    { label: "Tenants Ativos",  value: kpis.active_tenants },
    { label: "Conversas Total", value: kpis.total_conversations.toLocaleString("pt-BR") },
    { label: "Nesta Página",    value: `${tenants.length} / ${total}` },
  ];

  return (
    <div className="animate-fade-in">
      <Header title="Super Admin" subtitle={`${total} tenants na plataforma`} />
      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {KPI_CARDS.map((k) => (
            <div key={k.label} className="glass-card p-4">
              <p className="text-xs text-slate-500 mb-1">{k.label}</p>
              <p className="text-xl font-bold text-white">{loading ? "—" : k.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E293B]">
            <h3 className="text-sm font-semibold text-white">Todos os Tenants</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E293B]">
                {["Tenant", "Plano", "WhatsApp", "Conversas/Limite", "Status", "Ações"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">
                    Carregando...
                  </td>
                </tr>
              ) : (
                tenants.map((t) => {
                  const msgs  = t.billing?.conversationsThisMonth ?? 0;
                  const limit = t.billing?.conversationsLimit ?? 0;
                  const pct   = limit > 0 ? Math.min(100, (msgs / limit) * 100) : 0;
                  const busy  = actionLoading === t.id;

                  return (
                    <tr key={t.id} className="border-b border-[#1E293B]/50 hover:bg-[#0F172A]/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{t.name}</p>
                        <p className="text-xs text-slate-500">{t.slug}.whatsagent.com.br</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
                          {t.planType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs ${t.whatsappStatus === "CONNECTED" ? "text-green-400" : "text-slate-500"}`}>
                          {t.whatsappStatus === "CONNECTED"
                            ? <CheckCircle className="w-3.5 h-3.5" />
                            : <XCircle className="w-3.5 h-3.5" />}
                          {t.whatsappStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {msgs}/{limit}
                        <div className="w-20 h-1 bg-slate-800 rounded-full mt-1">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3">
                        {t.status !== "SUSPENDED" && t.status !== "CANCELLED" ? (
                          <button
                            onClick={() => handleAction(t.id, "suspend")}
                            disabled={busy}
                            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Suspender
                          </button>
                        ) : t.status === "SUSPENDED" ? (
                          <button
                            onClick={() => handleAction(t.id, "activate")}
                            disabled={busy}
                            className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 disabled:opacity-40 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reativar
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#1E293B]">
              <span className="text-xs text-slate-500">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1 || loading}
                  className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages || loading}
                  className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm --filter @whatsagent/web lint
```

Expected: sem erros de tipo. Ajustar se o TypeScript reclamar de `useCallback` ou `useEffect` dependency array.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(admin)/tenants/page.tsx
git commit -m "feat(web): connect super admin tenants page to real API with actions and pagination"
```

---

## Task 4: Frontend — Add Super Admin link in Sidebar

**Files:**
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

A sidebar atual não tem nenhum link para `/tenants`. O acesso é só via URL direta. Adicionar uma seção "Plataforma" no final da nav com o link de Super Admin.

- [ ] **Step 1: Add `Shield` to Lucide imports**

No topo do arquivo, adicionar `Shield` à importação existente:

```typescript
import {
  LayoutDashboard, MessageSquare, Bot, Package,
  ShoppingCart, BarChart3, PhoneCall, Settings, Shield,
} from "lucide-react";
```

- [ ] **Step 2: Append admin section to NAV array**

Adicionar ao final do array `NAV`:

```typescript
const NAV = [
  { section: "Menu", items: [
    { href: "/overview",  label: "Overview",    icon: LayoutDashboard },
    { href: "/inbox",     label: "Conversas",   icon: MessageSquare, badge: "active_conversations" },
    { href: "/support",   label: "Suporte",     icon: PhoneCall,     badge: "pending_handoffs" },
    { href: "/analytics", label: "Analytics",   icon: BarChart3 },
  ]},
  { section: "Configurar", items: [
    { href: "/agent",    label: "Agente IA",     icon: Bot },
    { href: "/catalog",  label: "Catálogo",      icon: Package },
    { href: "/orders",   label: "Pedidos",       icon: ShoppingCart, badge: "pending_orders" },
    { href: "/settings", label: "Configurações", icon: Settings },
  ]},
  { section: "Plataforma", items: [
    { href: "/tenants", label: "Super Admin", icon: Shield },
  ]},
];
```

Nenhuma outra mudança no arquivo — o loop `NAV.map(...)` já renderiza seções dinamicamente.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat(web): add Super Admin link to sidebar navigation"
```

---

## Verification

### Manual (end-to-end)

1. Iniciar a stack: `pnpm docker:up && pnpm dev`
2. Abrir `http://localhost:3000` e logar com uma conta OWNER
3. Verificar que "Super Admin" aparece na sidebar na seção "Plataforma"
4. Clicar no link — deve carregar `/tenants` com dados reais do banco (não mais os 2 tenants hardcoded)
5. KPIs devem refletir contagens reais: total de tenants e conversas
6. Coluna "Conversas/Limite" deve mostrar dados do `PlatformBilling` (0/100 para tenants novos)
7. Clicar "Suspender" em um tenant de teste → confirmar o diálogo → o badge de status deve mudar para "Suspenso" e o botão deve virar "Reativar"
8. Clicar "Reativar" → status volta para "Ativo"
9. Com >25 tenants no banco: verificar que a paginação aparece e navegar entre páginas funciona
10. Logout → tentar acessar `/tenants` diretamente → deve redirecionar para login (middleware protege a rota)

### Automated

```bash
pnpm --filter @whatsagent/api test
pnpm --filter @whatsagent/web lint
pnpm build
```
