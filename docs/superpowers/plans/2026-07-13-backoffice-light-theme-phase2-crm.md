# Backoffice Light Theme Phase 2.0 + 2.1 (CRM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme the shared "page hero" chrome, toast, and one hardcoded icon color used across multiple upcoming Phase 2 areas (Phase 2.0), then retheme the CRM Kanban board and deal modal (Phase 2.1) — the smallest of the five Phase 2 feature areas (CRM → Orders → Catalog → Support/Admin → Settings).

**Architecture:** Same as Phase 1 — almost all styling lives in named CSS classes in `apps/web/src/app/globals.css` (`@layer components`), consumed by React components that reference class names. This phase also touches a handful of inline `style={{}}` color literals in page/component files (per the approved "value-only swap" approach — no refactor to CSS classes) and one repeated Tailwind utility (`text-indigo-400`) hardcoded across several files.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS v4, no test suite for visual/CSS changes — verification is `grep` + `pnpm --filter @whatsagent/web build`/`lint`.

## Global Constraints

- Keep the existing green (`#22c55e`), indigo (`#6366f1`), and the Phase-1-established darkened variants (`#15803d` green-text, `#b91c1c`/`#dc2626` red-text, `#4f46e5`/`#4338ca` indigo-text) — reuse these exact values rather than inventing new shades.
- The `text-indigo-400` → `text-indigo-600` swap applies ONLY to the 9 files listed in Task 1 (all belonging to already-approved Phase 2 areas: CRM, Orders, Catalog, Settings, Support, Admin). Do NOT touch `text-indigo-400` in `analytics/*`, `agent/*`, `overview/*`, or `(onboarding)/*` — those areas are still dark-themed and the fix would reduce contrast there.
- `.catalog-hero*` family retheme (Task 2) is a shared component also rendered by the (out-of-scope, still-dark) Agent pages. This is an accepted, known side effect per the design doc — do not attempt to avoid it or scope the CSS change down to "only when used by CRM/Catalog."
- All CSS edits are exact-string replacements in `apps/web/src/app/globals.css`; reproduce whitespace/indentation exactly as shown in each step.
- Inline `style={{}}` color literals in `.tsx` files are value-only swaps — do not refactor them into CSS classes or extract shared constants; that is out of scope per the approved approach.
- Do not touch `.lp-*`, `AuthShell.tsx`, or any class/page belonging to a not-yet-started Phase 2 sub-area (Orders, Catalog beyond the shared hero, Support, Admin beyond the two `text-indigo-400` lines, Settings beyond the two `text-indigo-400` lines).

---

### Task 1: Icon color fix — `text-indigo-400` → `text-indigo-600`

**Files:**
- Modify: `apps/web/src/components/catalog/ProductFormModal.tsx:127`
- Modify: `apps/web/src/components/orders/OrderDetailModal.tsx:36`
- Modify: `apps/web/src/components/orders/UpdateStatusModal.tsx:56`
- Modify: `apps/web/src/components/crm/DealFormModal.tsx:129`
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx:285`
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx:411,792`
- Modify: `apps/web/src/app/(dashboard)/support/page.tsx:402`
- Modify: `apps/web/src/app/(admin)/tenants/page.tsx:47`
- Modify: `apps/web/src/app/(admin)/email/page.tsx:179,288`

**Interfaces:** No new interfaces — a pure Tailwind class-name swap, 11 occurrences across 9 files.

- [ ] **Step 1: Apply the 11 exact-string replacements**

In `apps/web/src/components/catalog/ProductFormModal.tsx`, replace:
```tsx
      headerLeading={<Package className="w-5 h-5 text-indigo-400" />}
```
with:
```tsx
      headerLeading={<Package className="w-5 h-5 text-indigo-600" />}
```

In `apps/web/src/components/orders/OrderDetailModal.tsx`, replace:
```tsx
      headerLeading={<ShoppingCart className="w-5 h-5 text-indigo-400" />}
```
with:
```tsx
      headerLeading={<ShoppingCart className="w-5 h-5 text-indigo-600" />}
```

In `apps/web/src/components/orders/UpdateStatusModal.tsx`, replace:
```tsx
      headerLeading={<RefreshCw className="w-5 h-5 text-indigo-400" />}
```
with:
```tsx
      headerLeading={<RefreshCw className="w-5 h-5 text-indigo-600" />}
```

In `apps/web/src/components/crm/DealFormModal.tsx`, replace:
```tsx
      headerLeading={<Kanban className="w-5 h-5 text-indigo-400" />}
```
with:
```tsx
      headerLeading={<Kanban className="w-5 h-5 text-indigo-600" />}
```

In `apps/web/src/app/(dashboard)/orders/page.tsx`, replace:
```tsx
                <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
```
with:
```tsx
                <ShoppingCart className="w-3.5 h-3.5 text-indigo-600" strokeWidth={1.8} />
```

In `apps/web/src/app/(dashboard)/settings/page.tsx`, replace:
```tsx
            <Shield className="w-5 h-5 text-indigo-400" strokeWidth={1.6} />
```
with:
```tsx
            <Shield className="w-5 h-5 text-indigo-600" strokeWidth={1.6} />
```

Also in `apps/web/src/app/(dashboard)/settings/page.tsx`, replace:
```tsx
                  <CreditCard className="w-3.5 h-3.5 text-indigo-400 shrink-0" strokeWidth={1.8} />
```
with:
```tsx
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600 shrink-0" strokeWidth={1.8} />
```

In `apps/web/src/app/(dashboard)/support/page.tsx`, replace:
```tsx
                <Bot className="w-4 h-4 text-indigo-400" strokeWidth={1.8} />
```
with:
```tsx
                <Bot className="w-4 h-4 text-indigo-600" strokeWidth={1.8} />
```

In `apps/web/src/app/(admin)/tenants/page.tsx`, replace:
```tsx
    iconColor: "text-indigo-400",
```
with:
```tsx
    iconColor: "text-indigo-600",
```

In `apps/web/src/app/(admin)/email/page.tsx`, replace:
```tsx
            <Server className="w-4 h-4 text-indigo-400" aria-hidden />
```
with:
```tsx
            <Server className="w-4 h-4 text-indigo-600" aria-hidden />
```

Also in `apps/web/src/app/(admin)/email/page.tsx`, replace:
```tsx
            <Mail className="w-4 h-4 text-indigo-400" aria-hidden />
```
with:
```tsx
            <Mail className="w-4 h-4 text-indigo-600" aria-hidden />
```

- [ ] **Step 2: Verify no `text-indigo-400` remains in the 9 target files**

Run:
```bash
grep -n "text-indigo-400" apps/web/src/components/catalog/ProductFormModal.tsx apps/web/src/components/orders/OrderDetailModal.tsx apps/web/src/components/orders/UpdateStatusModal.tsx "apps/web/src/components/crm/DealFormModal.tsx" "apps/web/src/app/(dashboard)/orders/page.tsx" "apps/web/src/app/(dashboard)/settings/page.tsx" "apps/web/src/app/(dashboard)/support/page.tsx" "apps/web/src/app/(admin)/tenants/page.tsx" "apps/web/src/app/(admin)/email/page.tsx"
```
Expected: no output.

Run this second grep to confirm out-of-scope files were NOT touched (should still show their original `text-indigo-400`/`text-indigo-300`):
```bash
grep -rn "text-indigo-400\|text-indigo-300" apps/web/src/app/\(dashboard\)/agent apps/web/src/app/\(dashboard\)/analytics apps/web/src/app/\(dashboard\)/overview "apps/web/src/app/(onboarding)" apps/web/src/components/agent apps/web/src/components/analytics
```
Expected: several matches (these files are untouched, out of scope for this phase).

- [ ] **Step 3: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/catalog/ProductFormModal.tsx apps/web/src/components/orders/OrderDetailModal.tsx apps/web/src/components/orders/UpdateStatusModal.tsx "apps/web/src/components/crm/DealFormModal.tsx" "apps/web/src/app/(dashboard)/orders/page.tsx" "apps/web/src/app/(dashboard)/settings/page.tsx" "apps/web/src/app/(dashboard)/support/page.tsx" "apps/web/src/app/(admin)/tenants/page.tsx" "apps/web/src/app/(admin)/email/page.tsx"
git commit -m "fix(web): darken indigo icon color for light-theme contrast in phase 2 areas"
```

---

### Task 2: Shared page-hero component → light

**Files:**
- Modify: `apps/web/src/app/globals.css` (the `.catalog-hero*`/`.catalog-toolbar`/`.catalog-search-*`/`.catalog-view-*`/`.catalog-add-btn`/`.catalog-btn-secondary`/`.catalog-panel`/`.catalog-empty*` block)

**Interfaces:**
- Consumes: `var(--c-*)` tokens from Phase 1 (already light).
- Produces: light-themed hero/toolbar chrome consumed by CRM (this phase), and later Catalog. Also incidentally affects Agent pages — accepted per Global Constraints.

- [ ] **Step 1: Replace the full block**

Replace:
```css
  /* ── Catalog page ────────────────────────────────────────── */
  .catalog-hero {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
    min-height: 134px;
    padding: 20px 22px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(34,197,94,0.04) 45%, var(--c-s1) 100%);
    border: 1px solid rgba(99,102,241,0.15);
    overflow: hidden;
  }
  .catalog-hero::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(99,102,241,0.5), rgba(34,197,94,0.2), transparent);
    pointer-events: none;
  }
  .catalog-hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
  }
  .catalog-hero-badge {
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
  .catalog-hero-title {
    font-size: 20px;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.025em;
    line-height: 1.2;
  }
  .catalog-hero-sub {
    font-size: 13px;
    color: #64748b;
    margin-top: 6px;
    line-height: 1.5;
    max-width: 560px;
  }
  .catalog-hero-actions {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .catalog-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .catalog-search-wrap {
    position: relative;
    flex: 1;
    min-width: 200px;
    max-width: 340px;
  }
  .catalog-search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 13px;
    height: 13px;
    color: #475569;
    pointer-events: none;
  }
  .catalog-search-input {
    width: 100%;
    height: 34px;
    background: var(--c-s1);
    border: 1px solid var(--c-border);
    border-radius: 8px;
    padding: 0 12px 0 30px;
    font-size: 12px;
    color: var(--c-text);
    outline: none;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }
  .catalog-search-input::placeholder { color: #475569; }
  .catalog-search-input:hover { border-color: var(--c-s3); }
  .catalog-search-input:focus {
    border-color: rgba(99,102,241,0.4);
    box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
  }
  .catalog-filter-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .catalog-view-toggle {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 8px;
    background: var(--c-s1);
    border: 1px solid var(--c-border);
  }
  .catalog-view-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #475569;
    cursor: pointer;
    background: transparent;
    border: none;
    transition: color 140ms ease, background 140ms ease;
  }
  .catalog-view-btn:hover { color: var(--c-text); background: rgba(255,255,255,0.05); }
  .catalog-view-btn-active {
    color: #4ade80;
    background: rgba(34,197,94,0.08);
    box-shadow: inset 0 0 0 1px rgba(34,197,94,0.2);
  }
  .catalog-add-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    color: #4ade80;
    background: rgba(34,197,94,0.08);
    border: 1px solid rgba(34,197,94,0.2);
    cursor: pointer;
    white-space: nowrap;
    transition: background 160ms ease, border-color 160ms ease;
  }
  .catalog-add-btn:hover:not(:disabled) {
    background: rgba(34,197,94,0.14);
    border-color: rgba(34,197,94,0.35);
  }
  .catalog-add-btn:disabled { opacity: 0.7; cursor: default; }
  .catalog-btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    color: #94a3b8;
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--c-border);
    cursor: pointer;
    white-space: nowrap;
    transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
  }
  .catalog-btn-secondary:hover:not(:disabled) {
    color: var(--c-text);
    background: rgba(255,255,255,0.04);
    border-color: var(--c-s3);
  }
  .catalog-panel {
    background: var(--c-s1);
    border: 1px solid var(--c-border);
    border-radius: 12px;
    overflow: hidden;
    min-height: 320px;
    display: flex;
    flex-direction: column;
  }
  .catalog-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 56px 24px;
    flex: 1;
  }
  .catalog-empty-icon {
    width: 60px;
    height: 60px;
    border-radius: 18px;
    background: var(--c-s2);
    border: 1px solid var(--c-border);
    display: flex;
    align-items: center;
    justify-content: center;
  }
```

with:
```css
  /* ── Catalog page ────────────────────────────────────────── */
  .catalog-hero {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
    min-height: 134px;
    padding: 20px 22px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(34,197,94,0.04) 45%, var(--c-s1) 100%);
    border: 1px solid rgba(99,102,241,0.15);
    overflow: hidden;
  }
  .catalog-hero::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(99,102,241,0.4), rgba(34,197,94,0.2), transparent);
    pointer-events: none;
  }
  .catalog-hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
  }
  .catalog-hero-badge {
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
  .catalog-hero-title {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.025em;
    line-height: 1.2;
  }
  .catalog-hero-sub {
    font-size: 13px;
    color: #64748b;
    margin-top: 6px;
    line-height: 1.5;
    max-width: 560px;
  }
  .catalog-hero-actions {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .catalog-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .catalog-search-wrap {
    position: relative;
    flex: 1;
    min-width: 200px;
    max-width: 340px;
  }
  .catalog-search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 13px;
    height: 13px;
    color: #94a3b8;
    pointer-events: none;
  }
  .catalog-search-input {
    width: 100%;
    height: 34px;
    background: var(--c-s1);
    border: 1px solid var(--c-border);
    border-radius: 8px;
    padding: 0 12px 0 30px;
    font-size: 12px;
    color: var(--c-text);
    outline: none;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }
  .catalog-search-input::placeholder { color: #94a3b8; }
  .catalog-search-input:hover { border-color: var(--c-s3); }
  .catalog-search-input:focus {
    border-color: rgba(99,102,241,0.4);
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
  }
  .catalog-filter-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .catalog-view-toggle {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 8px;
    background: var(--c-s1);
    border: 1px solid var(--c-border);
  }
  .catalog-view-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    cursor: pointer;
    background: transparent;
    border: none;
    transition: color 140ms ease, background 140ms ease;
  }
  .catalog-view-btn:hover { color: var(--c-text); background: rgba(15,23,42,0.05); }
  .catalog-view-btn-active {
    color: #15803d;
    background: rgba(34,197,94,0.1);
    box-shadow: inset 0 0 0 1px rgba(34,197,94,0.25);
  }
  .catalog-add-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    color: #15803d;
    background: rgba(34,197,94,0.1);
    border: 1px solid rgba(34,197,94,0.25);
    cursor: pointer;
    white-space: nowrap;
    transition: background 160ms ease, border-color 160ms ease;
  }
  .catalog-add-btn:hover:not(:disabled) {
    background: rgba(34,197,94,0.16);
    border-color: rgba(34,197,94,0.4);
  }
  .catalog-add-btn:disabled { opacity: 0.7; cursor: default; }
  .catalog-btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    color: #64748b;
    background: #f8fafc;
    border: 1px solid var(--c-border);
    cursor: pointer;
    white-space: nowrap;
    transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
  }
  .catalog-btn-secondary:hover:not(:disabled) {
    color: var(--c-text);
    background: #f1f5f9;
    border-color: var(--c-s3);
  }
  .catalog-panel {
    background: var(--c-s1);
    border: 1px solid var(--c-border);
    border-radius: 12px;
    overflow: hidden;
    min-height: 320px;
    display: flex;
    flex-direction: column;
  }
  .catalog-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 56px 24px;
    flex: 1;
  }
  .catalog-empty-icon {
    width: 60px;
    height: 60px;
    border-radius: 18px;
    background: var(--c-s2);
    border: 1px solid var(--c-border);
    display: flex;
    align-items: center;
    justify-content: center;
  }
```

- [ ] **Step 2: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): light-theme shared page-hero/toolbar component"
```

---

### Task 3: Toast → light

**Files:**
- Modify: `apps/web/src/app/globals.css` (`.kb-toast*`)

- [ ] **Step 1: Replace the toast block**

Replace:
```css
  .kb-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
    animation: modal-slide-up 240ms ease-out;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }
  .kb-toast--success {
    color: #4ade80;
    background: rgba(12,21,38,0.95);
    border: 1px solid rgba(34,197,94,0.3);
  }
  .kb-toast--error {
    color: #f87171;
    background: rgba(12,21,38,0.95);
    border: 1px solid rgba(239,68,68,0.3);
  }
```

with:
```css
  .kb-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
    animation: modal-slide-up 240ms ease-out;
    box-shadow: 0 8px 24px rgba(15,23,42,0.16);
  }
  .kb-toast--success {
    color: #15803d;
    background: #ffffff;
    border: 1px solid rgba(34,197,94,0.3);
  }
  .kb-toast--error {
    color: #b91c1c;
    background: #ffffff;
    border: 1px solid rgba(239,68,68,0.3);
  }
```

- [ ] **Step 2: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): light-theme kb-toast"
```

---

### Task 4: CRM CSS literals

**Files:**
- Modify: `apps/web/src/app/globals.css` (`.crm-deal-card:hover`, `.crm-deal-drag:hover`, `.crm-deal-btn:hover`, `.crm-deal-btn--danger:hover`)

**Interfaces:**
- Consumes: `var(--c-*)` tokens (already light) — the rest of `.crm-*` needs no edit, it's already token-driven.

- [ ] **Step 1: Replace the four literal hover/shadow values**

Replace:
```css
  .crm-deal-card:hover { border-color: var(--c-s3); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
```
with:
```css
  .crm-deal-card:hover { border-color: var(--c-s3); box-shadow: 0 2px 8px rgba(15,23,42,0.12); }
```

Replace:
```css
  .crm-deal-drag:hover { color: var(--c-text); background: rgba(255,255,255,0.06); }
```
with:
```css
  .crm-deal-drag:hover { color: var(--c-text); background: rgba(15,23,42,0.05); }
```

Replace:
```css
  .crm-deal-btn:hover { color: var(--c-text); background: rgba(255,255,255,0.07); }
  .crm-deal-btn--danger:hover { color: #f87171; background: rgba(239,68,68,0.1); }
```
with:
```css
  .crm-deal-btn:hover { color: var(--c-text); background: rgba(15,23,42,0.05); }
  .crm-deal-btn--danger:hover { color: #dc2626; background: rgba(239,68,68,0.1); }
```

- [ ] **Step 2: Verify**

Run:
```bash
grep -n "crm-deal-card:hover\|crm-deal-drag:hover\|crm-deal-btn:hover\|crm-deal-btn--danger:hover" apps/web/src/app/globals.css
```
Expected: 4 lines shown, matching the "with:" text above (no `rgba(255,255,255` or `rgba(0,0,0` or `#f87171` remaining on these 4 lines).

- [ ] **Step 3: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): light-theme CRM deal-card hover/shadow literals"
```

---

### Task 5: CRM page and DealFormModal inline styles

**Files:**
- Modify: `apps/web/src/app/(dashboard)/crm/page.tsx`
- Modify: `apps/web/src/components/crm/DealFormModal.tsx`

**Interfaces:**
- Consumes: Task 1-4 CSS/class changes (this task's components render inside the already-retheme'd hero/toolbar/toast/CRM chrome).

- [ ] **Step 1: Fix the stat-card inline styles in `crm/page.tsx`**

Replace:
```tsx
            <div key={s.label} style={{
              background: "rgba(15,23,42,0.8)", border: "1px solid var(--c-border)",
              borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
            }}>
```
with:
```tsx
            <div key={s.label} style={{
              background: "#ffffff", border: "1px solid var(--c-border)",
              borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
            }}>
```

Replace:
```tsx
                <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>{s.value}</div>
```
with:
```tsx
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{s.value}</div>
```

(The label text `color: "#64748b"` on the next line, the loading text `color: "#64748b"`, and the delete-confirm button's `background: "#ef4444", color: "#fff"` are unchanged — already legible on light background, and the delete button is a semantic danger action, not a theme-dependent surface.)

- [ ] **Step 2: Fix the error banner in `DealFormModal.tsx`**

Replace:
```tsx
        {error && (
          <div style={{
            marginTop: 12, padding: "8px 12px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8, color: "#fca5a5", fontSize: 12,
          }}>
            {error}
          </div>
        )}
```
with:
```tsx
        {error && (
          <div style={{
            marginTop: 12, padding: "8px 12px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8, color: "#dc2626", fontSize: 12,
          }}>
            {error}
          </div>
        )}
```

- [ ] **Step 3: Verify**

Run:
```bash
grep -n "rgba(15,23,42,0.8)\|#e2e8f0\|#fca5a5" "apps/web/src/app/(dashboard)/crm/page.tsx" "apps/web/src/components/crm/DealFormModal.tsx"
```
Expected: no output.

- [ ] **Step 4: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(dashboard)/crm/page.tsx" "apps/web/src/components/crm/DealFormModal.tsx"
git commit -m "fix(web): light-theme CRM page stat cards and deal-form error banner"
```

---

### Task 6: Final verification pass

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
grep -n "#a5b4fc\|#f1f5f9\|rgba(255,255,255,0.0" apps/web/src/app/globals.css | sed -n '1,40p'
```
Manually confirm any remaining hits belong to sections NOT touched by this phase (e.g. `.form-select-option:hover` uses `rgba(99,102,241,0.08)` not `rgba(255,255,255,...)`, so should be clean; any genuine `.catalog-*`/`.kb-toast*`/`.crm-*` hit here would indicate a missed edit — investigate before proceeding).

- [ ] **Step 3: Manual visual QA (user)**

Note for whoever runs this: the controller has no browser tool. Run `pnpm --filter @whatsagent/web dev` and check:
1. `/crm` — hero banner, toolbar (if any), stat cards, Kanban columns/cards, "novo negócio" modal, and the delete-confirmation modal all read as light theme with legible text and icons.
2. `/catalog` — hero banner only (rest of the page is still dark, expected) — confirm the hero banner itself looks correct and doesn't visually clash too badly with the dark grid below it (some mismatch is expected/accepted until Catalog's own phase).
3. Briefly open `/orders`, `/settings`, `/support`, `/tenants` (admin), `/email` (admin) — confirm only the specific indigo icon touched in Task 1 changed color, nothing else shifted.

Fix anything genuinely broken by re-checking the relevant task's diff; do not patch with new ad-hoc colors outside the established palette.

- [ ] **Step 4: Final commit (only if Step 3 required fixes)**

```bash
git add -A
git commit -m "fix(web): address visual QA findings from light-theme phase 2.0/2.1"
```
