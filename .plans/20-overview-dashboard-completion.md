# Overview Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Overview dashboard by fixing a chart groupBy bug, adding KPI trend deltas, auto-refresh, conditional setup banner, period selector, and secondary charts (funnel + handoff reasons).

**Architecture:** All data flows from `GET /analytics/*` endpoints in `apps/api` → fetched by `useEffect` in `apps/web/src/app/(dashboard)/overview/page.tsx` → rendered via purpose-built chart/card components. No new modules needed — only additions to the existing `analytics.service.ts` and `overview/page.tsx`.

**Tech Stack:** NestJS + Prisma (raw SQL via `$queryRaw`) for backend; React + Recharts + Tailwind/CSS vars for frontend.

---

## Gap Analysis

| Gap | Where | Impact |
|-----|--------|--------|
| `groupBy("startedAt")` groups per-timestamp not per-day | `analytics.service.ts:103` | Chart shows empty or one-point-per-conversation |
| `ai_resolved`/`handoffs` are fake 85%/15% multipliers | `analytics.service.ts:111-112` | Chart data is fabricated |
| `KpiCard` has `change`/`trend` props but never receives them | `overview/page.tsx` + missing endpoint | All delta rows show "Sem dados" |
| Data loads once, never refreshes | `overview/page.tsx:44` | "Atualizado em tempo real" is a lie |
| Setup banner always visible | `overview/page.tsx:106` | Shown even for fully-configured tenants |
| Chart period is hardcoded 30d | `ConversationsChart.tsx` | No user control |
| Funnel + handoff-reasons endpoints exist but not rendered | `analytics.service.ts:116,157` | Analytics data wasted |
| "Precisao NLP" / "Uptime API" have no data key | `overview/page.tsx:32-33` | Always shows "—" |

---

## File Map

| File | Change |
|------|--------|
| `apps/api/src/modules/analytics/analytics.service.ts` | Fix chart groupBy; add `getKpiTrends`; add `getSetupStatus` |
| `apps/api/src/modules/analytics/analytics.controller.ts` | Add `GET /analytics/kpi-trends`; add `GET /analytics/setup-status` |
| `apps/web/src/app/(dashboard)/overview/page.tsx` | Fetch trends + setup-status; wire change/trend to KpiCard; add polling; conditional banner; period selector state |
| `apps/web/src/components/analytics/ConversationsChart.tsx` | Accept `days`/`onDaysChange` props; render period buttons |
| `apps/web/src/components/analytics/FunnelChart.tsx` | **Create** — horizontal funnel bar chart |
| `apps/web/src/components/analytics/HandoffReasonsChart.tsx` | **Create** — horizontal bar chart of handoff reason counts |

---

## Task 1 — Fix Chart Daily Grouping + Real ai_resolved/handoffs

**Files:**
- Modify: `apps/api/src/modules/analytics/analytics.service.ts:101-113`

The current `groupBy: ["startedAt"]` produces one row per unique DateTime (i.e. one row per conversation). Replace with raw SQL using `DATE_TRUNC` to bucket by calendar day. At the same time, compute real `ai_resolved` (closed, had AI messages, no HandoffEvent) and real `handoffs` (had at least one HandoffEvent).

- [ ] **Step 1: Replace `getConversationsChart` in analytics.service.ts**

```typescript
async getConversationsChart(tenantId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400000);

  type Row = { day: Date; total: bigint; ai_resolved: bigint; handoffs: bigint };
  const rows = await this.prisma.$queryRaw<Row[]>`
    SELECT
      DATE_TRUNC('day', c."startedAt") AS day,
      COUNT(c.id)                       AS total,
      COUNT(CASE
        WHEN c.status = 'CLOSED'
         AND NOT EXISTS (
           SELECT 1 FROM "HandoffEvent" h WHERE h."conversationId" = c.id
         )
        THEN 1
      END)                              AS ai_resolved,
      COUNT(CASE
        WHEN EXISTS (
          SELECT 1 FROM "HandoffEvent" h WHERE h."conversationId" = c.id
        )
        THEN 1
      END)                              AS handoffs
    FROM "Conversation" c
    WHERE c."tenantId" = ${tenantId}
      AND c."startedAt" >= ${since}
    GROUP BY DATE_TRUNC('day', c."startedAt")
    ORDER BY day ASC
  `;

  return rows.map((r) => ({
    date: new Date(r.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    total:       Number(r.total),
    ai_resolved: Number(r.ai_resolved),
    handoffs:    Number(r.handoffs),
  }));
}
```

- [ ] **Step 2: Restart API and verify endpoint**

```bash
pnpm --filter @whatsagent/api dev
curl -s "http://localhost:3002/analytics/conversations-chart?days=30" -H "Authorization: Bearer <token>"
# Expect: array of { date, total, ai_resolved, handoffs } with integer values, one entry per calendar day
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/analytics/analytics.service.ts
git commit -m "fix(analytics): group conversations chart by calendar day using DATE_TRUNC"
```

---

## Task 2 — Add KPI Trends Endpoint (backend)

**Files:**
- Modify: `apps/api/src/modules/analytics/analytics.service.ts` (add method)
- Modify: `apps/api/src/modules/analytics/analytics.controller.ts` (add route)

Returns `{ [metricKey]: { change: number; trend: "up" | "down" | "neutral" } }` comparing today vs same metric yesterday.

- [ ] **Step 1: Add `getKpiTrends` to analytics.service.ts**

Add this method after `getKpis`:

```typescript
async getKpiTrends(tenantId: string): Promise<Record<string, { change: number; trend: "up" | "down" | "neutral" }>> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const [todayKpis, yesterdayKpis] = await Promise.all([
    this.getKpis(tenantId),
    this._getKpisForRange(tenantId, yesterdayStart, todayStart),
  ]);

  const result: Record<string, { change: number; trend: "up" | "down" | "neutral" }> = {};
  for (const key of Object.keys(todayKpis)) {
    const today = todayKpis[key] ?? 0;
    const yesterday = yesterdayKpis[key] ?? 0;
    if (yesterday === 0) {
      result[key] = { change: 0, trend: "neutral" };
    } else {
      const pct = Math.round(((today - yesterday) / yesterday) * 100);
      result[key] = {
        change: pct,
        trend: pct > 0 ? "up" : pct < 0 ? "down" : "neutral",
      };
    }
  }
  return result;
}

private async _getKpisForRange(
  tenantId: string,
  from: Date,
  to: Date,
): Promise<Record<string, number | null>> {
  const sevenDaysAgo = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    conversationsToday,
    ordersToday,
    revenueToday,
    pendingHandoffs,
    newContactsToday,
    closedToday,
    closedByAiToday,
    latencyResult,
    csatResult,
    tokensResult,
  ] = await Promise.all([
    this.prisma.conversation.count({ where: { tenantId, startedAt: { gte: from, lt: to } } }),
    this.prisma.order.count({ where: { tenantId, createdAt: { gte: from, lt: to } } }),
    this.prisma.payment.aggregate({
      where: { tenantId, status: "APPROVED", paidAt: { gte: from, lt: to } },
      _sum: { amountCents: true },
    }),
    this.prisma.conversation.count({ where: { tenantId, status: "HUMAN_HANDOFF" } }),
    this.prisma.contact.count({ where: { tenantId, firstSeenAt: { gte: from, lt: to } } }),
    this.prisma.conversation.count({
      where: { tenantId, status: "CLOSED", closedAt: { gte: from, lt: to } },
    }),
    this.prisma.conversation.count({
      where: {
        tenantId, status: "CLOSED", closedAt: { gte: from, lt: to },
        messages: { some: { isFromAi: true } },
        handoffEvents: { none: {} },
      },
    }),
    this.prisma.message.aggregate({
      where: { tenantId, isFromAi: true, aiLatencyMs: { not: null }, sentAt: { gte: from, lt: to } },
      _avg: { aiLatencyMs: true },
    }),
    this.prisma.conversation.aggregate({
      where: { tenantId, csatScore: { not: null }, closedAt: { gte: sevenDaysAgo, lt: to } },
      _avg: { csatScore: true },
    }),
    this.prisma.message.aggregate({
      where: { tenantId, isFromAi: true, aiTokensUsed: { not: null }, sentAt: { gte: from, lt: to } },
      _sum: { aiTokensUsed: true },
    }),
  ]);

  const ai_resolution_rate = closedToday > 0 ? Math.round((closedByAiToday / closedToday) * 100) : 0;
  const avg_response_time_sec = latencyResult._avg.aiLatencyMs
    ? Math.round(latencyResult._avg.aiLatencyMs / 1000) : 0;
  const avg_csat_score = csatResult._avg.csatScore
    ? Number(csatResult._avg.csatScore.toFixed(1)) : null;

  return {
    conversations_today: conversationsToday,
    ai_resolution_rate,
    revenue_today: revenueToday._sum.amountCents ?? 0,
    pending_handoffs: pendingHandoffs,
    avg_response_time_sec,
    new_contacts_today: newContactsToday,
    orders_today: ordersToday,
    conversion_rate: conversationsToday > 0 ? Math.round((ordersToday / conversationsToday) * 100) : 0,
    avg_csat_score,
    ai_tokens_today: tokensResult._sum.aiTokensUsed ?? 0,
  };
}
```

- [ ] **Step 2: Add GET /analytics/kpi-trends to analytics.controller.ts**

```typescript
@Get("kpi-trends")
getKpiTrends(@CurrentTenantId() tenantId: string) {
  return this.analyticsService.getKpiTrends(tenantId);
}
```

- [ ] **Step 3: Test the endpoint**

```bash
curl -s "http://localhost:3002/analytics/kpi-trends" -H "Authorization: Bearer <token>"
# Expect: { conversations_today: { change: 0, trend: "neutral" }, ... }
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/analytics/analytics.service.ts \
        apps/api/src/modules/analytics/analytics.controller.ts
git commit -m "feat(analytics): add kpi-trends endpoint with yesterday comparison"
```

---

## Task 3 — Add Setup Status Endpoint (backend)

**Files:**
- Modify: `apps/api/src/modules/analytics/analytics.service.ts`
- Modify: `apps/api/src/modules/analytics/analytics.controller.ts`

The setup banner in the Overview page is always shown. `Tenant.whatsappStatus` (enum: DISCONNECTED by default) and `AgentConfig` presence are the two signals.

- [ ] **Step 1: Add `getSetupStatus` method to analytics.service.ts**

```typescript
async getSetupStatus(tenantId: string): Promise<{
  whatsappConnected: boolean;
  agentConfigured: boolean;
  setupComplete: boolean;
}> {
  const [tenant, agentConfig] = await Promise.all([
    this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { whatsappStatus: true, whatsappPhoneId: true },
    }),
    this.prisma.agentConfig.findUnique({
      where: { tenantId },
      select: { id: true },
    }),
  ]);

  const whatsappConnected =
    tenant?.whatsappStatus !== "DISCONNECTED" && tenant?.whatsappPhoneId != null;
  const agentConfigured = agentConfig != null;

  return {
    whatsappConnected,
    agentConfigured,
    setupComplete: whatsappConnected && agentConfigured,
  };
}
```

- [ ] **Step 2: Add GET /analytics/setup-status to analytics.controller.ts**

```typescript
@Get("setup-status")
getSetupStatus(@CurrentTenantId() tenantId: string) {
  return this.analyticsService.getSetupStatus(tenantId);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/analytics/analytics.service.ts \
        apps/api/src/modules/analytics/analytics.controller.ts
git commit -m "feat(analytics): add setup-status endpoint for conditional banner"
```

---

## Task 4 — Wire Trends, Auto-refresh, and Setup Banner (frontend)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/overview/page.tsx`

Three improvements in one page-level change: fetch `kpi-trends` and `setup-status` in parallel with existing calls; wire `change`/`trend` to each `KpiCard`; replace one-shot `useEffect` with a polling loop (30s); hide banner when `setupComplete`.

- [ ] **Step 1: Update overview/page.tsx**

Replace the state declarations and `useEffect` + return JSX for the banner:

```typescript
// State — add these alongside existing state
const [trends, setTrends] = useState<Record<string, { change: number; trend: "up" | "down" | "neutral" }>>({});
const [setupComplete, setSetupComplete] = useState(false);
const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
const [chartDays, setChartDays] = useState(30);
```

Replace the `useEffect` block (lines 44-58):

```typescript
useEffect(() => {
  async function load() {
    try {
      const [kpiRes, chartRes, trendsRes, setupRes] = await Promise.all([
        apiFetch("/analytics/kpis"),
        apiFetch(`/analytics/conversations-chart?days=${chartDays}`),
        apiFetch("/analytics/kpi-trends"),
        apiFetch("/analytics/setup-status"),
      ]);
      if (kpiRes.ok)    setKpis(await kpiRes.json());
      if (chartRes.ok)  setChart(await chartRes.json());
      if (trendsRes.ok) setTrends(await trendsRes.json());
      if (setupRes.ok) {
        const s = await setupRes.json();
        setSetupComplete(s.setupComplete);
      }
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }

  void load();
  const id = setInterval(() => void load(), 30_000);
  return () => clearInterval(id);
}, [chartDays]); // eslint-disable-line react-hooks/exhaustive-deps
```

Update "Atualizado em tempo real" label to show timestamp:

```tsx
<span className="text-[10px] text-[#475569]">
  {lastUpdated
    ? `Atualizado ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : "Atualizando..."}
</span>
```

Update the KpiCard render to pass trend data:

```tsx
<KpiCard
  key={card.title}
  {...cardProps}
  value={formatCard(card)}
  loading={loading}
  empty={!loading && isCardEmpty(card)}
  change={trends[card.key]?.change}
  trend={trends[card.key]?.trend}
/>
```

Update the setup banner to be conditional:

```tsx
{!setupComplete && (
  <div className="dashboard-setup-banner">
    {/* ... existing banner content unchanged ... */}
  </div>
)}
```

Pass `chartDays` and `setChartDays` to `ConversationsChart`:

```tsx
<ConversationsChart data={chart} days={chartDays} onDaysChange={setChartDays} />
```

- [ ] **Step 2: Verify in browser**
  - KPI cards now show "+X% vs. ontem" delta pill
  - Refreshes every 30s (watch "Atualizado HH:MM" tick forward)
  - Banner hidden when setup is complete

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/overview/page.tsx
git commit -m "feat(overview): wire kpi trends, auto-refresh polling, and conditional setup banner"
```

---

## Task 5 — Period Selector on Conversations Chart (frontend)

**Files:**
- Modify: `apps/web/src/components/analytics/ConversationsChart.tsx`

Accept `days` and `onDaysChange` props; render 3 toggle buttons (7d / 30d / 90d) in the chart header.

- [ ] **Step 1: Update ConversationsChart.tsx**

Change the component signature and add period buttons:

```typescript
export function ConversationsChart({
  data,
  days = 30,
  onDaysChange,
}: {
  data: any[];
  days?: number;
  onDaysChange?: (d: number) => void;
}) {
```

Replace the static title section (lines 71-82) with:

```tsx
<div className="flex items-start justify-between mb-4 relative z-10">
  <div>
    <p className="text-[13px] font-semibold text-[#e2e8f0] leading-none">Conversas</p>
    <p className="text-[11px] text-[#64748b] mt-1">Volume e resolução por IA</p>
  </div>
  <div className="flex items-center gap-3 flex-shrink-0">
    {[7, 30, 90].map((d) => (
      <button
        key={d}
        onClick={() => onDaysChange?.(d)}
        className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
          days === d
            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
            : "text-[#475569] hover:text-[#94a3b8]"
        }`}
      >
        {d}d
      </button>
    ))}
    {SERIES.map((s) => (
      <div key={s.key} className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
        <span className="text-[11px] text-[#64748b]">{s.name}</span>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Verify period selector works**

Click 7d → chart refetches and shows 7 days of data. Click 90d → shows 90 days.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/analytics/ConversationsChart.tsx
git commit -m "feat(overview): add 7d/30d/90d period selector to conversations chart"
```

---

## Task 6 — FunnelChart Component (frontend)

**Files:**
- Create: `apps/web/src/components/analytics/FunnelChart.tsx`

The `/analytics/funnel` endpoint already returns `{ conversations, catalog_viewed, cart_started, payment_generated, payment_confirmed }`. This component renders a horizontal step-down funnel.

- [ ] **Step 1: Create FunnelChart.tsx**

```typescript
"use client";

interface FunnelData {
  conversations: number;
  catalog_viewed: number;
  cart_started: number;
  payment_generated: number;
  payment_confirmed: number;
}

const STEPS = [
  { key: "conversations",      label: "Conversas",            color: "#6366f1" },
  { key: "catalog_viewed",     label: "Catálogo visto",       color: "#8b5cf6" },
  { key: "cart_started",       label: "Carrinho aberto",      color: "#a78bfa" },
  { key: "payment_generated",  label: "Pagamento gerado",     color: "#22c55e" },
  { key: "payment_confirmed",  label: "Pagamento confirmado", color: "#16a34a" },
] as const;

export function FunnelChart({ data }: { data: FunnelData | null }) {
  const top = data?.conversations ?? 0;

  return (
    <div className="chart-panel">
      <div className="mb-4">
        <p className="text-[13px] font-semibold text-[#e2e8f0] leading-none">Funil de Conversão</p>
        <p className="text-[11px] text-[#64748b] mt-1">Conversas → pagamentos confirmados</p>
      </div>

      {!data || top === 0 ? (
        <div className="flex items-center justify-center h-32 text-[12px] text-[#475569]">
          Nenhum dado ainda
        </div>
      ) : (
        <div className="space-y-2">
          {STEPS.map(({ key, label, color }) => {
            const value = data[key] ?? 0;
            const pct = top > 0 ? Math.round((value / top) * 100) : 0;
            return (
              <div key={key}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color: "#94a3b8" }}>{label}</span>
                  <span style={{ color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>
                    {value.toLocaleString("pt-BR")}
                    <span style={{ color: "#475569" }}> ({pct}%)</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${pct}%`, background: color, opacity: 0.75 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/analytics/FunnelChart.tsx
git commit -m "feat(overview): add FunnelChart component"
```

---

## Task 7 — HandoffReasonsChart Component (frontend)

**Files:**
- Create: `apps/web/src/components/analytics/HandoffReasonsChart.tsx`

The `/analytics/handoff-reasons` endpoint returns `Record<string, number>` (reason → count). Renders a horizontal bar list sorted by count descending.

- [ ] **Step 1: Create HandoffReasonsChart.tsx**

```typescript
"use client";

const REASON_LABELS: Record<string, string> = {
  KEYWORD_TRIGGER:        "Palavra-chave",
  LOW_CONFIDENCE:         "Baixa confiança IA",
  ORDER_VALUE_THRESHOLD:  "Valor alto do pedido",
  TIMEOUT:                "Timeout",
  CUSTOMER_REQUEST:       "Pedido do cliente",
};

export function HandoffReasonsChart({ data }: { data: Record<string, number> | null }) {
  if (!data) return null;

  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const maxVal = entries[0]?.[1] ?? 1;

  return (
    <div className="chart-panel">
      <div className="mb-4">
        <p className="text-[13px] font-semibold text-[#e2e8f0] leading-none">Motivos de Handoff</p>
        <p className="text-[11px] text-[#64748b] mt-1">Por que o agente transfere para humano</p>
      </div>

      {entries.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-[12px] text-[#475569]">
          Nenhum handoff registrado
        </div>
      ) : (
        <div className="space-y-2.5">
          {entries.map(([reason, count]) => (
            <div key={reason}>
              <div className="flex justify-between text-[11px] mb-1">
                <span style={{ color: "#94a3b8" }}>
                  {REASON_LABELS[reason] ?? reason}
                </span>
                <span style={{ color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>{count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${Math.round((count / maxVal) * 100)}%`,
                    background: "#ef4444",
                    opacity: 0.6,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/analytics/HandoffReasonsChart.tsx
git commit -m "feat(overview): add HandoffReasonsChart component"
```

---

## Task 8 — Wire Funnel + Handoff Charts to Overview Page (frontend)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/overview/page.tsx`

Add funnel and handoff-reasons state, fetch them in the `load()` call, and render the new charts below the existing bento grid.

- [ ] **Step 1: Add imports and state**

Add imports at the top:

```typescript
import { FunnelChart } from "@/components/analytics/FunnelChart";
import { HandoffReasonsChart } from "@/components/analytics/HandoffReasonsChart";
```

Add state:

```typescript
const [funnel, setFunnel] = useState<Record<string, number> | null>(null);
const [handoffReasons, setHandoffReasons] = useState<Record<string, number> | null>(null);
```

- [ ] **Step 2: Add funnel + handoff fetches to `load()`**

Inside the existing `Promise.all` in `load()`, add two more fetches:

```typescript
const [kpiRes, chartRes, trendsRes, setupRes, funnelRes, handoffRes] = await Promise.all([
  apiFetch("/analytics/kpis"),
  apiFetch(`/analytics/conversations-chart?days=${chartDays}`),
  apiFetch("/analytics/kpi-trends"),
  apiFetch("/analytics/setup-status"),
  apiFetch("/analytics/funnel?days=30"),
  apiFetch("/analytics/handoff-reasons?days=30"),
]);
// ...existing setters...
if (funnelRes.ok)   setFunnel(await funnelRes.json());
if (handoffRes.ok)  setHandoffReasons(await handoffRes.json());
```

- [ ] **Step 3: Render the new charts below dashboard-bento**

Add after the closing `</div>` of `dashboard-bento`:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
  <FunnelChart data={funnel} />
  <HandoffReasonsChart data={handoffReasons} />
</div>
```

- [ ] **Step 4: Remove the two fake Agent Status metrics**

In the `AGENT_STATUS` constant, remove the entries without a `key` property (they always show "—"):

```typescript
const AGENT_STATUS = [
  { label: "Resolucao IA",    icon: CheckCircle2, color: "#6366f1", key: "ai_resolution_rate" },
  { label: "Satisfacao CSAT", icon: Star,         color: "#22c55e", key: "avg_csat_score", csat: true },
];
```

- [ ] **Step 5: Verify in browser**

- FunnelChart and HandoffReasonsChart render below the bento grid
- Agent Status panel shows only 2 metrics (no more "—" for NLP/Uptime)
- All 6 API calls fire in parallel on load and every 30s

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(dashboard)/overview/page.tsx
git commit -m "feat(overview): add funnel and handoff-reasons charts; remove fake agent status metrics"
```

---

## Verification

End-to-end test checklist:

1. **Chart grouping**: With real DB data, the conversations chart shows one data point per calendar day (not per conversation).
2. **Chart period selector**: Clicking 7d/30d/90d triggers a new API call and re-renders the chart.
3. **KPI trend deltas**: Each metric card shows "+X% vs. ontem" or "–X% vs. ontem" below the value.
4. **Auto-refresh**: The timestamp "Atualizado HH:MM" advances every 30 seconds.
5. **Setup banner**: Visible when `whatsappStatus = DISCONNECTED` or no AgentConfig; hidden for fully configured tenants.
6. **FunnelChart**: Renders 5 steps with proportional width bars; shows "Nenhum dado ainda" when funnel is empty.
7. **HandoffReasonsChart**: Renders Portuguese-labeled reason bars sorted by count; shows "Nenhum handoff registrado" when empty.
8. **Agent Status panel**: Shows only Resolução IA e Satisfação CSAT (no more hardcoded "—" rows).

Run:

```bash
pnpm --filter @whatsagent/api test            # backend unit tests
pnpm --filter @whatsagent/web lint            # frontend lint
```
