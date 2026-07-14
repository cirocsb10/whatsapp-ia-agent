# Backoffice Light Theme Phase 2.2 (Orders) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme the Orders list page and its four modals (Create, Detail, Update Status, Cancel) from dark to light, plus a small shared prep fix for `.support-stat-*`/`.support-info-*` classes the Orders page depends on (CRM → **Orders** → Catalog → Support/Admin → Settings sub-phase order).

**Architecture:** Same as prior phases — CSS lives in named classes in `apps/web/src/app/globals.css`; the Orders page and its four modal components additionally carry a large amount of hardcoded-color inline `style={{}}` (not CSS classes). Per the approved approach, inline styles get **value-only swaps** — no refactor into `.form-*` classes.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS v4, no test suite for visual/CSS changes — verification is `grep` + `pnpm --filter @whatsagent/web build`/`lint`.

## Global Constraints

- Reuse the established palette exactly: primary text `#0f172a`, secondary text `#64748b`/`#94a3b8`→`#64748b` (darkened), hover overlays `rgba(15,23,42,X)`, light surfaces `#ffffff`/`#f8fafc`/`#f1f5f9`, darkened semantics `#15803d` (green), `#dc2626`/`#b91c1c` (red), `#a16207` (amber), `#4f46e5`/`#4338ca` (indigo).
- Inline `style={{}}` color literals are value-only swaps — do not refactor into CSS classes or extract shared constants, even where a component (`CreateOrderModal.tsx`) is a good refactor candidate.
- `.orders-tool-btn--active` (globals.css:10271, physically inside the catalog CSS block) is NOT part of this phase — it's Catalog-only and already uses correct semantic green values with no dark literal.
- Do not touch `.lp-*`, `AuthShell.tsx`, `.crm-*`, `.catalog-*` (beyond what's already fixed), `.kb-toast*`, or any Agent/Onboarding/Analytics/Overview file.
- `.support-stats-grid`, `.support-stat-icon`, `.support-stat-label`, `.support-info-row`, `.support-info-card-header`, `.support-info-card-glow--indigo`, `.support-info-card-glow--green`, `.support-stat-glow` are NOT touched in this phase — they carry no structural dark literal that Orders' usage exposes (confirmed during design).

---

### Task 1: Shared prep — `.support-stat-card` / `.support-stat-value` / `.support-info-card`

**Files:**
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**
- Produces: light-themed surfaces for `.support-stat-card`/`.support-stat-value`/`.support-info-card`, consumed by `orders/page.tsx` (this phase) and, later, the Support page's own phase.

- [ ] **Step 1: Retheme `.support-stat-card`**

Replace:
```css
  .support-stat-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    border-radius: 12px;
    background: rgba(12,21,38,0.85);
    backdrop-filter: blur(12px);
    border: 1px solid var(--c-border);
    overflow: hidden;
    transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease;
    cursor: default;
  }
```
with:
```css
  .support-stat-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    border-radius: 12px;
    background: #ffffff;
    border: 1px solid var(--c-border);
    overflow: hidden;
    transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease;
    cursor: default;
  }
```

- [ ] **Step 2: Retheme `.support-stat-card:hover` shadow**

Replace:
```css
  .support-stat-card:hover {
    border-color: var(--stat-border, var(--c-s3));
    background: var(--c-s2);
    box-shadow: 0 4px 24px rgba(0,0,0,0.15);
  }
```
with:
```css
  .support-stat-card:hover {
    border-color: var(--stat-border, var(--c-s3));
    background: var(--c-s2);
    box-shadow: 0 4px 24px rgba(15,23,42,0.12);
  }
```

- [ ] **Step 3: Retheme `.support-stat-value`**

Replace:
```css
  .support-stat-value {
    font-size: 24px;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.03em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
```
with:
```css
  .support-stat-value {
    font-size: 24px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.03em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
```

- [ ] **Step 4: Retheme `.support-info-card` and its hover shadow**

Replace:
```css
  .support-info-card {
    position: relative;
    padding: 18px 20px;
    border-radius: 14px;
    background: rgba(12,21,38,0.75);
    backdrop-filter: blur(12px);
    border: 1px solid var(--c-border);
    overflow: hidden;
    transition: border-color 200ms ease, box-shadow 200ms ease;
  }
  .support-info-card:hover {
    border-color: var(--c-s3);
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  }
```
with:
```css
  .support-info-card {
    position: relative;
    padding: 18px 20px;
    border-radius: 14px;
    background: #ffffff;
    border: 1px solid var(--c-border);
    overflow: hidden;
    transition: border-color 200ms ease, box-shadow 200ms ease;
  }
  .support-info-card:hover {
    border-color: var(--c-s3);
    box-shadow: 0 4px 20px rgba(15,23,42,0.1);
  }
```

- [ ] **Step 5: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): light-theme shared support-stat-card and support-info-card"
```

---

### Task 2: `.orders-*` CSS block

**Files:**
- Modify: `apps/web/src/app/globals.css` (globals.css:5237-5528)

**Interfaces:**
- Consumes: `var(--c-*)` tokens (already light).

- [ ] **Step 1: Fix hero badge and title text**

Replace:
```css
  .orders-hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 99px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #a5b4fc;
    background: rgba(99,102,241,0.12);
    border: 1px solid rgba(99,102,241,0.2);
    margin-bottom: 28px;
  }
  .orders-hero-title {
    font-size: 20px;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.025em;
    line-height: 1.2;
  }
```
with:
```css
  .orders-hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 99px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #4f46e5;
    background: rgba(99,102,241,0.1);
    border: 1px solid rgba(99,102,241,0.2);
    margin-bottom: 28px;
  }
  .orders-hero-title {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.025em;
    line-height: 1.2;
  }
```

- [ ] **Step 2: Fix table head and row literals**

Replace:
```css
  .orders-table-head {
    display: grid;
    grid-template-columns: 96px 1fr 1fr 100px 130px 110px 48px;
    align-items: center;
    padding: 0 16px;
    height: 38px;
    border-bottom: 1px solid var(--c-border);
    background: rgba(255,255,255,0.02);
    flex-shrink: 0;
  }
  .orders-th {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--c-subtle);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .orders-tr {
    display: grid;
    grid-template-columns: 96px 1fr 1fr 100px 130px 110px 48px;
    align-items: center;
    padding: 0 16px;
    min-height: 52px;
    border-bottom: 1px solid rgba(26,45,71,0.5);
    transition: background 140ms ease;
    cursor: pointer;
  }
  .orders-tr:last-child { border-bottom: none; }
  .orders-tr:hover { background: rgba(255,255,255,0.025); }
```
with:
```css
  .orders-table-head {
    display: grid;
    grid-template-columns: 96px 1fr 1fr 100px 130px 110px 48px;
    align-items: center;
    padding: 0 16px;
    height: 38px;
    border-bottom: 1px solid var(--c-border);
    background: rgba(15,23,42,0.02);
    flex-shrink: 0;
  }
  .orders-th {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--c-subtle);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .orders-tr {
    display: grid;
    grid-template-columns: 96px 1fr 1fr 100px 130px 110px 48px;
    align-items: center;
    padding: 0 16px;
    min-height: 52px;
    border-bottom: 1px solid var(--c-border);
    transition: background 140ms ease;
    cursor: pointer;
  }
  .orders-tr:last-child { border-bottom: none; }
  .orders-tr:hover { background: rgba(15,23,42,0.03); }
```

- [ ] **Step 3: Fix empty-state ring border**

Replace:
```css
  .orders-empty-ring {
    position: absolute;
    inset: -8px;
    border-radius: 26px;
    border: 1px solid rgba(26,45,71,0.6);
    pointer-events: none;
  }
```
with:
```css
  .orders-empty-ring {
    position: absolute;
    inset: -8px;
    border-radius: 26px;
    border: 1px solid var(--c-border);
    pointer-events: none;
  }
```

- [ ] **Step 4: Fix ghost-button hover and primary/secondary/tab/tool-button literals**

Replace:
```css
  .orders-ghost-btn:hover {
    color: var(--c-text);
    border-color: var(--c-s3);
    background: rgba(255,255,255,0.04);
  }

  .orders-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
  }
  .orders-btn:disabled { cursor: default; }
  .orders-btn-primary {
    color: #4ade80;
    background: rgba(34,197,94,0.08);
    border: 1px solid rgba(34,197,94,0.2);
  }
  .orders-btn-primary:hover:not(:disabled) {
    background: rgba(34,197,94,0.14);
    border-color: rgba(34,197,94,0.35);
  }
  .orders-btn-secondary {
    color: #94a3b8;
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--c-border);
  }
  .orders-btn-secondary:hover:not(:disabled) {
    color: var(--c-text);
    background: rgba(255,255,255,0.04);
    border-color: var(--c-s3);
  }

  .orders-filter-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .orders-tab {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 12px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    color: var(--c-muted);
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    transition: color 160ms ease, background 160ms ease, border-color 160ms ease;
  }
  .orders-tab:hover {
    color: var(--c-text);
    background: rgba(255,255,255,0.04);
    border-color: rgba(255,255,255,0.06);
  }
  .orders-tab-active {
    color: #4ade80;
    background: rgba(34,197,94,0.08);
    border-color: rgba(34,197,94,0.2);
  }
  .orders-tab-active:hover {
    color: #4ade80;
    background: rgba(34,197,94,0.14);
    border-color: rgba(34,197,94,0.35);
  }

  .orders-tool-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 7px;
    color: #94a3b8;
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--c-border);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 160ms ease, background 160ms ease, border-color 160ms ease;
  }
  .orders-tool-btn:hover {
    color: var(--c-text);
    background: rgba(255,255,255,0.04);
    border-color: var(--c-s3);
  }
```
with:
```css
  .orders-ghost-btn:hover {
    color: var(--c-text);
    border-color: var(--c-s3);
    background: rgba(15,23,42,0.04);
  }

  .orders-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
  }
  .orders-btn:disabled { cursor: default; }
  .orders-btn-primary {
    color: #15803d;
    background: rgba(34,197,94,0.1);
    border: 1px solid rgba(34,197,94,0.25);
  }
  .orders-btn-primary:hover:not(:disabled) {
    background: rgba(34,197,94,0.16);
    border-color: rgba(34,197,94,0.4);
  }
  .orders-btn-secondary {
    color: #64748b;
    background: #f8fafc;
    border: 1px solid var(--c-border);
  }
  .orders-btn-secondary:hover:not(:disabled) {
    color: var(--c-text);
    background: #f1f5f9;
    border-color: var(--c-s3);
  }

  .orders-filter-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .orders-tab {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 12px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    color: var(--c-muted);
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    transition: color 160ms ease, background 160ms ease, border-color 160ms ease;
  }
  .orders-tab:hover {
    color: var(--c-text);
    background: rgba(15,23,42,0.04);
    border-color: rgba(15,23,42,0.06);
  }
  .orders-tab-active {
    color: #15803d;
    background: rgba(34,197,94,0.1);
    border-color: rgba(34,197,94,0.25);
  }
  .orders-tab-active:hover {
    color: #15803d;
    background: rgba(34,197,94,0.16);
    border-color: rgba(34,197,94,0.4);
  }

  .orders-tool-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 7px;
    color: #64748b;
    background: #f8fafc;
    border: 1px solid var(--c-border);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 160ms ease, background 160ms ease, border-color 160ms ease;
  }
  .orders-tool-btn:hover {
    color: var(--c-text);
    background: #f1f5f9;
    border-color: var(--c-s3);
  }
```

- [ ] **Step 5: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): light-theme orders CSS (hero, table, buttons, tabs)"
```

---

### Task 3: `orders/page.tsx`

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx`

**Interfaces:**
- Consumes: Task 1 (`.support-stat-*`/`.support-info-*`) and Task 2 (`.orders-*`) CSS, both already light.

- [ ] **Step 1: Darken `STATUS_CONFIG` text colors**

Replace:
```tsx
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  pending: { label: "Pendente", color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)", icon: Clock },
  processing: { label: "Em andamento", color: "#818cf8", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)", icon: Loader2 },
  delivered: { label: "Entregue", color: "#4ade80", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "#f87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)", icon: XCircle },
};
```
with:
```tsx
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  pending: { label: "Pendente", color: "#a16207", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)", icon: Clock },
  processing: { label: "Em andamento", color: "#4f46e5", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)", icon: Loader2 },
  delivered: { label: "Entregue", color: "#15803d", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "#dc2626", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)", icon: XCircle },
};
```

- [ ] **Step 2: Fix the empty-state heading text color**

Replace:
```tsx
                <p className="text-[15px] font-semibold text-[#e2e8f0] leading-tight">
```
with:
```tsx
                <p className="text-[15px] font-semibold text-[#0f172a] leading-tight">
```

- [ ] **Step 3: Fix the row-action dropdown menu (dark panel → light)**

Replace:
```tsx
                      {openMenuId === order.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50, background: "#0f172a", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 10, padding: "4px 0", minWidth: 180, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
                        >
                          {[
                            { label: "Ver detalhes", action: () => { setDetailOrderId(order.id); setOpenMenuId(null); }, danger: false },
                            { label: "Atualizar status", action: () => { setUpdateOrder({ id: order.id, status: order.status }); setOpenMenuId(null); }, danger: false },
                            { label: "Cancelar pedido", action: () => { setOpenMenuId(null); setCancelOrder({ id: order.id, orderNumber: order.orderNumber }); }, danger: true },
                          ].map(({ label, action, danger }) => (
                            <button
                              key={label}
                              type="button"
                              onClick={action}
                              style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: danger ? "#f87171" : "#94a3b8", display: "block" }}
                              onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                              onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = "none"; }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
```
with:
```tsx
                      {openMenuId === order.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50, background: "#ffffff", border: "1px solid var(--c-border)", borderRadius: 10, padding: "4px 0", minWidth: 180, boxShadow: "0 8px 32px rgba(15,23,42,0.16)" }}
                        >
                          {[
                            { label: "Ver detalhes", action: () => { setDetailOrderId(order.id); setOpenMenuId(null); }, danger: false },
                            { label: "Atualizar status", action: () => { setUpdateOrder({ id: order.id, status: order.status }); setOpenMenuId(null); }, danger: false },
                            { label: "Cancelar pedido", action: () => { setOpenMenuId(null); setCancelOrder({ id: order.id, orderNumber: order.orderNumber }); }, danger: true },
                          ].map(({ label, action, danger }) => (
                            <button
                              key={label}
                              type="button"
                              onClick={action}
                              style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: danger ? "#dc2626" : "#64748b", display: "block" }}
                              onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = "rgba(15,23,42,0.05)"; }}
                              onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = "none"; }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
```

- [ ] **Step 4: Fix the two info-card label texts**

Replace:
```tsx
              <span className="text-[12px] font-semibold text-[#e2e8f0]">Como os pedidos funcionam</span>
```
with:
```tsx
              <span className="text-[12px] font-semibold text-[#0f172a]">Como os pedidos funcionam</span>
```

Replace:
```tsx
              <span className="text-[12px] font-semibold text-[#e2e8f0]">Rastreamento de status</span>
```
with:
```tsx
              <span className="text-[12px] font-semibold text-[#0f172a]">Rastreamento de status</span>
```

- [ ] **Step 5: Darken the Truck icon**

Replace:
```tsx
                <Truck className="w-3.5 h-3.5 text-green-400" strokeWidth={1.8} />
```
with:
```tsx
                <Truck className="w-3.5 h-3.5 text-green-600" strokeWidth={1.8} />
```

- [ ] **Step 6: Verify**

Run:
```bash
grep -n "#fbbf24\|#818cf8\|#4ade80\|#f87171\|#e2e8f0\|text-green-400\|#0f172a\", \"#0f172a\|background: \"#0f172a\"" "apps/web/src/app/(dashboard)/orders/page.tsx"
```
Expected: no output for `#fbbf24`, `#818cf8` (as a color value, not part of another string), `#4ade80`, `#f87171`, `#e2e8f0`, `text-green-400`, or a literal `background: "#0f172a"` dropdown panel — only the new `#0f172a`/`#a16207`/`#4f46e5`/`#15803d`/`#dc2626`/`#64748b` values should remain where color was needed.

- [ ] **Step 7: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/(dashboard)/orders/page.tsx"
git commit -m "fix(web): light-theme orders page status badges, dropdown menu, and text colors"
```

---

### Task 4: `CreateOrderModal.tsx`

**Files:**
- Modify: `apps/web/src/components/orders/CreateOrderModal.tsx`

**Interfaces:**
- No new interfaces — pure inline-style value swaps in the component's render output.

- [ ] **Step 1: Replace the full return statement**

Replace:
```tsx
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo pedido manual"
      subtitle="Crie um pedido diretamente pelo painel"
      size="lg"
      headerLeading={<ShoppingCart className="w-5 h-5 text-green-400" />}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" type="button">Cancelar</button>
          <button
            onClick={handleCreate}
            disabled={saving}
            type="button"
            style={{ height: 34, padding: "0 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)", cursor: "pointer" }}
          >
            {saving ? "Criando…" : `Criar pedido${total ? ` — ${money(total)}` : ""}`}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
            Telefone do cliente
          </label>
          <input
            type="tel"
            placeholder="+55 11 99999-9999"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(51,65,85,0.6)", borderRadius: 8, fontSize: 13, color: "#e2e8f0", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ position: "relative" }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
            Buscar produto
          </label>
          <div style={{ position: "relative" }}>
            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#475569" }} />
            <input
              type="text"
              placeholder="Nome do produto..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              style={{ width: "100%", padding: "8px 12px 8px 32px", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(51,65,85,0.6)", borderRadius: 8, fontSize: 13, color: "#e2e8f0", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          {productSearch.trim() && results.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, background: "#0f172a", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 10, padding: "4px 0", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, display: "flex", justifyContent: "space-between", color: "#94a3b8" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                >
                  <span style={{ color: "#e2e8f0" }}>{p.name}</span>
                  <span>{money(p.priceCents)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
              Itens do pedido
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cart.map((entry) => (
                <div key={entry.product.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(51,65,85,0.5)", borderRadius: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, color: "#e2e8f0" }}>{entry.product.name}</span>
                  <span style={{ fontSize: 12, color: "#64748b", width: 80, textAlign: "right" }}>{money(entry.product.priceCents * entry.quantity)}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button type="button" onClick={() => setQty(entry.product.id, entry.quantity - 1)} style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(51,65,85,0.5)", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <span style={{ fontSize: 13, color: "#e2e8f0", minWidth: 20, textAlign: "center" }}>{entry.quantity}</span>
                    <button type="button" onClick={() => setQty(entry.product.id, entry.quantity + 1)} style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(51,65,85,0.5)", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                  <button type="button" onClick={() => setQty(entry.product.id, 0)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#475569" }}>
                    <Trash2 style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginTop: 10 }}>
              Total: {money(total)}
            </div>
          </div>
        )}

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
            Observações (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{ width: "100%", padding: "8px 12px", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(51,65,85,0.6)", borderRadius: 8, fontSize: 13, color: "#e2e8f0", outline: "none", resize: "vertical", boxSizing: "border-box" }}
          />
        </div>

        {error && <p style={{ fontSize: 12, color: "#f87171" }}>{error}</p>}
      </div>
    </Modal>
  );
}
```
with:
```tsx
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo pedido manual"
      subtitle="Crie um pedido diretamente pelo painel"
      size="lg"
      headerLeading={<ShoppingCart className="w-5 h-5 text-green-600" />}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" type="button">Cancelar</button>
          <button
            onClick={handleCreate}
            disabled={saving}
            type="button"
            style={{ height: 34, padding: "0 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(34,197,94,0.15)", color: "#15803d", border: "1px solid rgba(34,197,94,0.3)", cursor: "pointer" }}
          >
            {saving ? "Criando…" : `Criar pedido${total ? ` — ${money(total)}` : ""}`}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
            Telefone do cliente
          </label>
          <input
            type="tel"
            placeholder="+55 11 99999-9999"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", background: "#ffffff", border: "1px solid var(--c-border)", borderRadius: 8, fontSize: 13, color: "#0f172a", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ position: "relative" }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
            Buscar produto
          </label>
          <div style={{ position: "relative" }}>
            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#475569" }} />
            <input
              type="text"
              placeholder="Nome do produto..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              style={{ width: "100%", padding: "8px 12px 8px 32px", background: "#ffffff", border: "1px solid var(--c-border)", borderRadius: 8, fontSize: 13, color: "#0f172a", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          {productSearch.trim() && results.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, background: "#ffffff", border: "1px solid var(--c-border)", borderRadius: 10, padding: "4px 0", boxShadow: "0 8px 32px rgba(15,23,42,0.16)" }}>
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, display: "flex", justifyContent: "space-between", color: "#64748b" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(15,23,42,0.05)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                >
                  <span style={{ color: "#0f172a" }}>{p.name}</span>
                  <span>{money(p.priceCents)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
              Itens do pedido
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cart.map((entry) => (
                <div key={entry.product.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f8fafc", border: "1px solid var(--c-border)", borderRadius: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, color: "#0f172a" }}>{entry.product.name}</span>
                  <span style={{ fontSize: 12, color: "#64748b", width: 80, textAlign: "right" }}>{money(entry.product.priceCents * entry.quantity)}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button type="button" onClick={() => setQty(entry.product.id, entry.quantity - 1)} style={{ width: 24, height: 24, borderRadius: 6, background: "#f1f5f9", border: "none", cursor: "pointer", color: "#475569", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <span style={{ fontSize: 13, color: "#0f172a", minWidth: 20, textAlign: "center" }}>{entry.quantity}</span>
                    <button type="button" onClick={() => setQty(entry.product.id, entry.quantity + 1)} style={{ width: 24, height: 24, borderRadius: 6, background: "#f1f5f9", border: "none", cursor: "pointer", color: "#475569", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                  <button type="button" onClick={() => setQty(entry.product.id, 0)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#475569" }}>
                    <Trash2 style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "#0f172a", marginTop: 10 }}>
              Total: {money(total)}
            </div>
          </div>
        )}

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
            Observações (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{ width: "100%", padding: "8px 12px", background: "#ffffff", border: "1px solid var(--c-border)", borderRadius: 8, fontSize: 13, color: "#0f172a", outline: "none", resize: "vertical", boxSizing: "border-box" }}
          />
        </div>

        {error && <p style={{ fontSize: 12, color: "#dc2626" }}>{error}</p>}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/orders/CreateOrderModal.tsx
git commit -m "fix(web): light-theme CreateOrderModal inline styles"
```

---

### Task 5: `OrderDetailModal.tsx`

**Files:**
- Modify: `apps/web/src/components/orders/OrderDetailModal.tsx`

- [ ] **Step 1: Replace the full return statement**

Replace:
```tsx
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={order ? order.orderNumber : "Detalhes do pedido"}
      {...(order ? { subtitle: `Criado em ${new Date(order.createdAt).toLocaleDateString("pt-BR")}` } : {})}
      size="lg"
      headerLeading={<ShoppingCart className="w-5 h-5 text-indigo-600" />}
    >
      {loading && <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: "24px 0" }}>Carregando...</p>}

      {!loading && order && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              <User className="w-3 h-3" style={{ display: "inline", marginRight: 4 }} />
              Cliente
            </p>
            <p style={{ fontSize: 13, color: "#e2e8f0" }}>{order.contact.name ?? "—"}</p>
            <p style={{ fontSize: 12, color: "#64748b" }}>{order.contact.phone}</p>
          </section>

          <section>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              <Package className="w-3 h-3" style={{ display: "inline", marginRight: 4 }} />
              Itens
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {order.items.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#e2e8f0" }}>{item.quantity}× {item.productName}</span>
                  <span style={{ color: "#94a3b8" }}>{money(item.subtotalCents)}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid rgba(51,65,85,0.6)", marginTop: 10, paddingTop: 10 }}>
              {order.discountCents > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                  <span>Desconto</span><span>-{money(order.discountCents)}</span>
                </div>
              )}
              {order.shippingCents > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                  <span>Frete</span><span>{money(order.shippingCents)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                <span>Total</span><span>{money(order.totalCents)}</span>
              </div>
            </div>
          </section>

          {order.payments.length > 0 && (
            <section>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                <CreditCard className="w-3 h-3" style={{ display: "inline", marginRight: 4 }} />
                Pagamento
              </p>
              {order.payments.map((pay) => (
                <div key={pay.id} style={{ fontSize: 13, color: "#e2e8f0", display: "flex", justifyContent: "space-between" }}>
                  <span>{pay.method} — {PAYMENT_STATUS_LABEL[pay.status] ?? pay.status}</span>
                  <span>{money(pay.amountCents)}</span>
                </div>
              ))}
            </section>
          )}

          {order.notes && (
            <section>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Observações</p>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>{order.notes}</p>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
```
with:
```tsx
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={order ? order.orderNumber : "Detalhes do pedido"}
      {...(order ? { subtitle: `Criado em ${new Date(order.createdAt).toLocaleDateString("pt-BR")}` } : {})}
      size="lg"
      headerLeading={<ShoppingCart className="w-5 h-5 text-indigo-600" />}
    >
      {loading && <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: "24px 0" }}>Carregando...</p>}

      {!loading && order && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              <User className="w-3 h-3" style={{ display: "inline", marginRight: 4 }} />
              Cliente
            </p>
            <p style={{ fontSize: 13, color: "#0f172a" }}>{order.contact.name ?? "—"}</p>
            <p style={{ fontSize: 12, color: "#64748b" }}>{order.contact.phone}</p>
          </section>

          <section>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              <Package className="w-3 h-3" style={{ display: "inline", marginRight: 4 }} />
              Itens
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {order.items.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#0f172a" }}>{item.quantity}× {item.productName}</span>
                  <span style={{ color: "#64748b" }}>{money(item.subtotalCents)}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid var(--c-border)", marginTop: 10, paddingTop: 10 }}>
              {order.discountCents > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                  <span>Desconto</span><span>-{money(order.discountCents)}</span>
                </div>
              )}
              {order.shippingCents > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                  <span>Frete</span><span>{money(order.shippingCents)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                <span>Total</span><span>{money(order.totalCents)}</span>
              </div>
            </div>
          </section>

          {order.payments.length > 0 && (
            <section>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                <CreditCard className="w-3 h-3" style={{ display: "inline", marginRight: 4 }} />
                Pagamento
              </p>
              {order.payments.map((pay) => (
                <div key={pay.id} style={{ fontSize: 13, color: "#0f172a", display: "flex", justifyContent: "space-between" }}>
                  <span>{pay.method} — {PAYMENT_STATUS_LABEL[pay.status] ?? pay.status}</span>
                  <span>{money(pay.amountCents)}</span>
                </div>
              ))}
            </section>
          )}

          {order.notes && (
            <section>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Observações</p>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{order.notes}</p>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/orders/OrderDetailModal.tsx
git commit -m "fix(web): light-theme OrderDetailModal inline styles"
```

---

### Task 6: `UpdateStatusModal.tsx`

**Files:**
- Modify: `apps/web/src/components/orders/UpdateStatusModal.tsx`

- [ ] **Step 1: Replace the full return statement**

Replace:
```tsx
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Atualizar status"
      subtitle="Selecione o novo status do pedido"
      size="sm"
      headerLeading={<RefreshCw className="w-5 h-5 text-indigo-600" />}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" type="button">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            type="button"
            style={{ height: 34, padding: "0 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)", cursor: "pointer" }}
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {STATUS_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: selected === opt.value ? "rgba(99,102,241,0.1)" : "transparent", border: `1px solid ${selected === opt.value ? "rgba(99,102,241,0.3)" : "transparent"}`, cursor: "pointer", fontSize: 13, color: selected === opt.value ? "#a5b4fc" : "#94a3b8" }}
          >
            <input type="radio" name="status" value={opt.value} checked={selected === opt.value} onChange={() => setSelected(opt.value)} style={{ accentColor: "#6366f1" }} />
            {opt.label}
          </label>
        ))}
      </div>
      {error && <p style={{ marginTop: 10, fontSize: 12, color: "#f87171" }}>{error}</p>}
    </Modal>
  );
}
```
with:
```tsx
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Atualizar status"
      subtitle="Selecione o novo status do pedido"
      size="sm"
      headerLeading={<RefreshCw className="w-5 h-5 text-indigo-600" />}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" type="button">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            type="button"
            style={{ height: 34, padding: "0 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(99,102,241,0.15)", color: "#4f46e5", border: "1px solid rgba(99,102,241,0.3)", cursor: "pointer" }}
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {STATUS_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: selected === opt.value ? "rgba(99,102,241,0.1)" : "transparent", border: `1px solid ${selected === opt.value ? "rgba(99,102,241,0.3)" : "transparent"}`, cursor: "pointer", fontSize: 13, color: selected === opt.value ? "#4f46e5" : "#64748b" }}
          >
            <input type="radio" name="status" value={opt.value} checked={selected === opt.value} onChange={() => setSelected(opt.value)} style={{ accentColor: "#6366f1" }} />
            {opt.label}
          </label>
        ))}
      </div>
      {error && <p style={{ marginTop: 10, fontSize: 12, color: "#dc2626" }}>{error}</p>}
    </Modal>
  );
}
```

- [ ] **Step 2: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/orders/UpdateStatusModal.tsx
git commit -m "fix(web): light-theme UpdateStatusModal inline styles"
```

---

### Task 7: `CancelOrderModal.tsx`

**Files:**
- Modify: `apps/web/src/components/orders/CancelOrderModal.tsx`

- [ ] **Step 1: Replace the full return statement**

Replace:
```tsx
  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Cancelar pedido"
      subtitle="Esta ação não pode ser desfeita"
      size="sm"
      headerLeading={<XCircle className="w-5 h-5 text-red-400" />}
      footer={
        <>
          <button onClick={handleClose} className="btn-ghost" type="button" disabled={loading}>
            Voltar
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            type="button"
            style={{
              height: 34,
              padding: "0 16px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: "rgba(239,68,68,0.15)",
              color: "#f87171",
              border: "1px solid rgba(239,68,68,0.3)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Cancelando…" : "Confirmar cancelamento"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
        Tem certeza que deseja cancelar o pedido{" "}
        <strong style={{ color: "#e2e8f0" }}>{order?.orderNumber}</strong>?
        O status será alterado para cancelado e esta ação não poderá ser revertida.
      </p>
      {error && (
        <p style={{ marginTop: 10, fontSize: 12, color: "#f87171" }}>{error}</p>
      )}
    </Modal>
  );
}
```
with:
```tsx
  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Cancelar pedido"
      subtitle="Esta ação não pode ser desfeita"
      size="sm"
      headerLeading={<XCircle className="w-5 h-5 text-red-600" />}
      footer={
        <>
          <button onClick={handleClose} className="btn-ghost" type="button" disabled={loading}>
            Voltar
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            type="button"
            style={{
              height: 34,
              padding: "0 16px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: "rgba(239,68,68,0.15)",
              color: "#dc2626",
              border: "1px solid rgba(239,68,68,0.3)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Cancelando…" : "Confirmar cancelamento"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
        Tem certeza que deseja cancelar o pedido{" "}
        <strong style={{ color: "#0f172a" }}>{order?.orderNumber}</strong>?
        O status será alterado para cancelado e esta ação não poderá ser revertida.
      </p>
      {error && (
        <p style={{ marginTop: 10, fontSize: 12, color: "#dc2626" }}>{error}</p>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/orders/CancelOrderModal.tsx
git commit -m "fix(web): light-theme CancelOrderModal inline styles"
```

---

### Task 8: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full lint + build**

Run:
```bash
pnpm --filter @whatsagent/web lint
pnpm --filter @whatsagent/web build
```
Expected: both succeed with no new errors (pre-existing `react-hooks/exhaustive-deps` warnings unrelated to this change are expected and fine).

- [ ] **Step 2: Grep sweep for leftover literals in touched areas**

Run:
```bash
grep -n "#a5b4fc\|#f1f5f9\|rgba(255,255,255,0.0\|rgba(0,0,0,0\|rgba(26,45,71\|rgba(51,65,85" apps/web/src/app/globals.css "apps/web/src/app/(dashboard)/orders/page.tsx" apps/web/src/components/orders/CreateOrderModal.tsx apps/web/src/components/orders/OrderDetailModal.tsx apps/web/src/components/orders/UpdateStatusModal.tsx apps/web/src/components/orders/CancelOrderModal.tsx
```
Manually confirm any remaining hits in `globals.css` belong to sections NOT touched by this phase (e.g. `.support-stat-icon`'s per-instance inline `borderColor`, or unrelated classes elsewhere in the file); confirm zero hits in the 5 Orders/CreateOrderModal/OrderDetailModal/UpdateStatusModal/CancelOrderModal files.

- [ ] **Step 3: Manual visual QA (user)**

Note for whoever runs this: the controller has no browser tool. Run `pnpm --filter @whatsagent/web dev` and check:
1. `/orders` — hero banner, stat cards, table (status badges legible), empty state (if applicable), pagination, and the two "como funciona" info cards all read as light theme with legible text.
2. Open each of the four modals: "Novo pedido" (search a product, add to cart, check qty buttons/cart rows/total), click a row to open detail, use the row's "⋯" menu to open "Atualizar status" and "Cancelar pedido" — confirm all are legible white-background modals.
3. Confirm the row-action dropdown (⋯ menu) opens as a light panel, not a dark one.

Fix anything genuinely broken by re-checking the relevant task's diff; do not patch with new ad-hoc colors outside the established palette.

- [ ] **Step 4: Final commit (only if Step 3 required fixes)**

```bash
git add -A
git commit -m "fix(web): address visual QA findings from light-theme phase 2.2 orders"
```
