# Backoffice Light Theme — Phase 2.5 Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme the `(admin)` route group (tenants + email pages, `.super-admin-*` CSS) from dark to light, plus two shared-prep steps (`.settings-input` family, `KpiCard`/`.kpi` CSS), completing Phase 2.5 of the backoffice light-theme migration.

**Architecture:** Value-only color swaps in existing CSS rules, inline `style={{}}` objects, and Tailwind classes — no structural changes, no new classes, no refactor into `.form-*` primitives. Every change is confirmed against the design spec at `docs/superpowers/specs/2026-07-14-backoffice-light-theme-phase2-admin-design.md`.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS v4, hand-written CSS in `apps/web/src/app/globals.css`.

## Global Constraints

- Value-only swaps only — never refactor inline styles into `.form-*` CSS classes.
- Established color mappings (copy exactly):
  - Green accent/success text: `#4ade80` → `#15803d`; Tailwind `text-green-400` → `text-green-600`; Tailwind `text-green-300` → `text-green-600`
  - Indigo accent text: `#818cf8` → `#4f46e5`; Tailwind `text-indigo-300` → `text-indigo-600`
  - Red/danger text: `#f87171` → `#dc2626`; `#fecaca` → `#dc2626`; Tailwind `text-red-400` → `text-red-600`; Tailwind `text-red-300` → `text-red-600`
  - Amber/warning text: Tailwind `text-amber-400` → `text-amber-700` (established in the Support sub-phase)
  - New this phase: Tailwind `text-orange-400` → `text-orange-600`; `text-violet-400` → `text-violet-600`; `text-rose-400` → `text-rose-600`; hex `#fdba74` → `#ea580c` (orange-600 equivalent)
  - Muted body text: `#94a3b8` → `#64748b`; Tailwind `text-slate-400` → `text-slate-500`
  - Near-white / primary heading text: `#e2e8f0`/`#f1f5f9` → `#0f172a`; Tailwind `text-white` → `text-slate-900`; Tailwind `text-slate-200`/`text-slate-300` (when used as primary label/heading text, not muted caption) → `text-slate-900`
  - Dark surfaces: `rgba(7,13,26,X)`/`rgba(12,21,38,X)`/`rgba(15,23,42,X)`/`rgba(2,6,23,X)` → light equivalents (white or light tint per context)
  - Dark borders: `rgba(26,45,71,X)`/`rgba(30,41,59,X)`/`rgba(148,163,184,X)` → `var(--c-border)`-equivalent
  - Dark-theme hover overlays (`rgba(255,255,255,X)` lighten-on-dark) → `rgba(15,23,42,X)` darken-on-light equivalent
  - Tailwind `bg-slate-800`/`border-slate-600` (as a dark chip background/border) → `bg-slate-100`/`border-slate-300`
- Decision: `.super-admin-confirm-backdrop` scrim lightens (does NOT stay dark like `.modal-overlay`) — matches the Catalog `.filter-panel-overlay` divergence.
- Decision: `usageBarColor()` hex triplet (`#ef4444`/`#f59e0b`/`#22c55e`) stays **unchanged** — semantic status-threshold accent colors driving a progress-bar fill, not body text.
- Decision: KPI/accent hex arrays (`#f97316`, `#22c55e`, `#6366f1`, `#8b5cf6`) passed as the `accent` prop stay **unchanged** — decorative accent tints for hover glows, not text.
- Decision: `accent-[#22c55e]` on the SMTP checkbox stays **unchanged** — accent color, decorative.
- Verify with `pnpm --filter @whatsagent/web build` and `pnpm --filter @whatsagent/web lint` after each task. If `pnpm` isn't on PATH or the build fails with a Node-version error, prefix with `export PATH="/c/Users/Login/AppData/Roaming/nvm/v20.11.1:$PATH"` and use `corepack pnpm ...` instead. If the build fails with a `.tsbuildinfo` path-separator "Debug Failure" (a stale-cache issue, unrelated to any of these changes), run `rm -rf apps/web/.next/cache` once and retry.

---

### Task 1: Shared prep — `.settings-input` family CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:5822-5921`

**Interfaces:**
- Consumes: none (pure CSS value edit).
- Produces: light-themed `.settings-field-label`, `.settings-field-hint`, `.settings-input*`, `.settings-divider`, `.settings-link-btn*`, `.settings-avatar-btn` rules — consumed by `email/page.tsx` (Task 5, 7 usages of `.settings-input`) and, in a future sub-phase, `(dashboard)/settings/page.tsx`.

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:5822-5921):
```css
  .settings-field-label-wrap {}
  .settings-field-label {
    font-size: 12px;
    font-weight: 500;
    color: #94a3b8;
    line-height: 1.3;
    display: block;
  }
  .settings-field-hint {
    font-size: 11px;
    color: #475569;
    margin-top: 4px;
    line-height: 1.4;
  }
  .settings-field-control {
    min-width: 0;
  }

  .settings-input {
    width: 100%;
    height: 38px;
    background: rgba(7,13,26,0.65);
    border: 1px solid var(--c-border);
    border-radius: 9px;
    padding: 0 13px;
    font-size: 13px;
    color: var(--c-text);
    outline: none;
    font-family: inherit;
    transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
    appearance: none;
  }
  .settings-input::placeholder { color: #475569; }
  .settings-input:hover:not(:disabled) {
    border-color: var(--c-s3);
    background: rgba(7,13,26,0.85);
  }
  .settings-input:focus {
    border-color: rgba(99,102,241,0.45);
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
    background: rgba(7,13,26,0.95);
  }

  .settings-divider {
    border: none;
    border-top: 1px solid rgba(26,45,71,0.6);
    margin: 0 18px;
  }

  .settings-link-btn {
    font-size: 12px;
    font-weight: 500;
    color: #818cf8;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: color 140ms ease;
  }
  .settings-link-btn:hover { color: #a5b4fc; }

  /* Avatar */
  .settings-avatar-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 18px;
  }
  .settings-avatar {
    width: 60px;
    height: 60px;
    border-radius: 16px;
    background: linear-gradient(145deg, rgba(99,102,241,0.22), rgba(99,102,241,0.06));
    border: 1px solid rgba(99,102,241,0.28);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
    box-shadow: 0 0 24px rgba(99,102,241,0.12);
  }
  .settings-avatar-btn {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background: var(--c-s2);
    border: 1px solid var(--c-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    cursor: pointer;
    transition: color 140ms ease, border-color 140ms ease;
  }
  .settings-avatar-btn:hover { color: var(--c-text); border-color: var(--c-s3); }
```

After:
```css
  .settings-field-label-wrap {}
  .settings-field-label {
    font-size: 12px;
    font-weight: 500;
    color: #64748b;
    line-height: 1.3;
    display: block;
  }
  .settings-field-hint {
    font-size: 11px;
    color: #64748b;
    margin-top: 4px;
    line-height: 1.4;
  }
  .settings-field-control {
    min-width: 0;
  }

  .settings-input {
    width: 100%;
    height: 38px;
    background: #ffffff;
    border: 1px solid var(--c-border);
    border-radius: 9px;
    padding: 0 13px;
    font-size: 13px;
    color: var(--c-text);
    outline: none;
    font-family: inherit;
    transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
    appearance: none;
  }
  .settings-input::placeholder { color: #94a3b8; }
  .settings-input:hover:not(:disabled) {
    border-color: var(--c-s3);
    background: #f8fafc;
  }
  .settings-input:focus {
    border-color: rgba(99,102,241,0.45);
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
    background: #ffffff;
  }

  .settings-divider {
    border: none;
    border-top: 1px solid var(--c-border);
    margin: 0 18px;
  }

  .settings-link-btn {
    font-size: 12px;
    font-weight: 500;
    color: #4f46e5;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: color 140ms ease;
  }
  .settings-link-btn:hover { color: #4f46e5; }

  /* Avatar */
  .settings-avatar-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 18px;
  }
  .settings-avatar {
    width: 60px;
    height: 60px;
    border-radius: 16px;
    background: linear-gradient(145deg, rgba(99,102,241,0.22), rgba(99,102,241,0.06));
    border: 1px solid rgba(99,102,241,0.28);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
    box-shadow: 0 0 24px rgba(99,102,241,0.12);
  }
  .settings-avatar-btn {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background: var(--c-s2);
    border: 1px solid var(--c-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    cursor: pointer;
    transition: color 140ms ease, border-color 140ms ease;
  }
  .settings-avatar-btn:hover { color: var(--c-text); border-color: var(--c-s3); }
```

- [ ] **Step 2: Confirm no change needed for `.settings-slug-prefix`**

`.settings-slug-prefix` color `#64748b` (globals.css around line 5937) is already the target muted value — do not edit it.

- [ ] **Step 3: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme settings-input shared CSS for light theme (admin/settings shared prep)"
```

---

### Task 2: Shared prep — `KpiCard`/`.kpi` CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:45,100`
- Modify: `apps/web/src/components/analytics/KpiCard.tsx:66-69`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.kpi`/`.kpi-icon-wrap` base backgrounds — consumed by `tenants/page.tsx` (Task 4) and, incidentally, by the not-yet-migrated Overview/Analytics pages (accepted transitional state per the design spec).

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:44-57):
```css
  .kpi {
    background: rgba(12,21,38,0.75);
    border: 1px solid var(--c-border);
    border-radius: 12px;
    padding: 16px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease, transform 200ms ease;
    position: relative;
    overflow: hidden;
    cursor: default;
    backdrop-filter: blur(8px);
  }
```

After:
```css
  .kpi {
    background: #ffffff;
    border: 1px solid var(--c-border);
    border-radius: 12px;
    padding: 16px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease, transform 200ms ease;
    position: relative;
    overflow: hidden;
    cursor: default;
    backdrop-filter: blur(8px);
  }
```

Before (globals.css:93-103):
```css
  .kpi-icon-wrap {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15,23,42,0.5);
    border: 1px solid var(--c-border);
    transition: border-color 200ms ease, box-shadow 200ms ease, background 200ms ease;
  }
```

After:
```css
  .kpi-icon-wrap {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8fafc;
    border: 1px solid var(--c-border);
    transition: border-color 200ms ease, box-shadow 200ms ease, background 200ms ease;
  }
```

- [ ] **Step 2: Apply the `KpiCard.tsx` edit**

Before (KpiCard.tsx:65-69):
```tsx
      <div className="flex items-center justify-between relative z-10">
        <span
          className="text-[10px] font-600 uppercase tracking-widest"
          style={{ color: "#475569", letterSpacing: "0.08em" }}
        >
```

After:
```tsx
      <div className="flex items-center justify-between relative z-10">
        <span
          className="text-[10px] font-600 uppercase tracking-widest"
          style={{ color: "#64748b", letterSpacing: "0.08em" }}
        >
```

- [ ] **Step 3: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/analytics/KpiCard.tsx
git commit -m "fix(web): retheme KpiCard/.kpi shared CSS for light theme (admin/overview/analytics shared prep)"
```

---

### Task 3: `.super-admin-*` CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:3343-3496`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.super-admin-*` rules consumed by `tenants/page.tsx` (Task 4) and `email/page.tsx` (Task 5).

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:3343-3356):
```css
  .super-admin-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #fdba74;
    border: 1px solid rgba(249, 115, 22, 0.25);
    background: rgba(249, 115, 22, 0.08);
  }
```

After:
```css
  .super-admin-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #ea580c;
    border: 1px solid rgba(249, 115, 22, 0.25);
    background: rgba(249, 115, 22, 0.08);
  }
```

Before (globals.css:3381-3396):
```css
  .super-admin-table-head th {
    padding: 10px 16px;
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #64748b;
    background: rgba(15, 23, 42, 0.5);
    border-bottom: 1px solid var(--c-border);
  }
  .super-admin-table-row {
    border-bottom: 1px solid rgba(30, 41, 59, 0.6);
    transition: background 150ms ease;
  }
  .super-admin-table-row:hover { background: rgba(15, 23, 42, 0.45); }
```

After:
```css
  .super-admin-table-head th {
    padding: 10px 16px;
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #64748b;
    background: #f8fafc;
    border-bottom: 1px solid var(--c-border);
  }
  .super-admin-table-row {
    border-bottom: 1px solid var(--c-border);
    transition: background 150ms ease;
  }
  .super-admin-table-row:hover { background: rgba(15, 23, 42, 0.03); }
```

Before (globals.css:3428-3445):
```css
  .super-admin-action-suspend {
    color: #f87171;
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.2);
  }
  .super-admin-action-suspend:hover:not(:disabled) {
    color: #fecaca;
    background: rgba(239, 68, 68, 0.14);
  }
  .super-admin-action-activate {
    color: #4ade80;
    background: rgba(34, 197, 94, 0.08);
    border-color: rgba(34, 197, 94, 0.2);
  }
  .super-admin-action-activate:hover:not(:disabled) {
    color: #bbf7d0;
    background: rgba(34, 197, 94, 0.14);
  }
```

After:
```css
  .super-admin-action-suspend {
    color: #dc2626;
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.2);
  }
  .super-admin-action-suspend:hover:not(:disabled) {
    color: #dc2626;
    background: rgba(239, 68, 68, 0.14);
  }
  .super-admin-action-activate {
    color: #15803d;
    background: rgba(34, 197, 94, 0.08);
    border-color: rgba(34, 197, 94, 0.2);
  }
  .super-admin-action-activate:hover:not(:disabled) {
    color: #15803d;
    background: rgba(34, 197, 94, 0.14);
  }
```

Before (globals.css:3446-3496):
```css
  .super-admin-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid var(--c-border);
    background: rgba(15, 23, 42, 0.35);
  }
  .super-admin-page-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: #94a3b8;
    border: 1px solid var(--c-border);
    background: transparent;
    cursor: pointer;
    transition: color 150ms ease, background 150ms ease, border-color 150ms ease;
  }
  .super-admin-page-btn:hover:not(:disabled) {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(148, 163, 184, 0.35);
  }
  .super-admin-page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .super-admin-page-btn:focus-visible {
    outline: 2px solid rgba(99, 102, 241, 0.6);
    outline-offset: 2px;
  }
  .super-admin-confirm-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(2, 6, 23, 0.72);
    backdrop-filter: blur(8px);
  }
  .super-admin-confirm-dialog {
    width: 100%;
    max-width: 400px;
    padding: 20px;
    border-radius: 14px;
    border: 1px solid var(--c-border);
    background: var(--c-s1);
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.45);
  }
```

After:
```css
  .super-admin-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid var(--c-border);
    background: #f8fafc;
  }
  .super-admin-page-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: #64748b;
    border: 1px solid var(--c-border);
    background: transparent;
    cursor: pointer;
    transition: color 150ms ease, background 150ms ease, border-color 150ms ease;
  }
  .super-admin-page-btn:hover:not(:disabled) {
    color: #0f172a;
    background: rgba(15, 23, 42, 0.06);
    border-color: var(--c-border);
  }
  .super-admin-page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .super-admin-page-btn:focus-visible {
    outline: 2px solid rgba(99, 102, 241, 0.6);
    outline-offset: 2px;
  }
  .super-admin-confirm-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(15, 23, 42, 0.25);
    backdrop-filter: blur(8px);
  }
  .super-admin-confirm-dialog {
    width: 100%;
    max-width: 400px;
    padding: 20px;
    border-radius: 14px;
    border: 1px solid var(--c-border);
    background: var(--c-s1);
    box-shadow: 0 24px 48px rgba(15, 23, 42, 0.16);
  }
```

- [ ] **Step 2: Confirm no change needed for decorative rules**

`.super-admin-hero` background gradients/border (orange/indigo tints on `var(--c-s1)`), `.super-admin-hero::after` (near-invisible sheen), `.super-admin-table-wrap`/`::before`, `.super-admin-usage-track` (`var(--c-s3)`, already tokenized), `.super-admin-action-btn:focus-visible`, `.super-admin-action-suspend`/`.super-admin-action-activate` background/border (translucent tints) — all stay unchanged. Do not edit them.

- [ ] **Step 3: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme super-admin CSS for light theme"
```

---

### Task 4: `tenants/page.tsx`

**Files:**
- Modify: `apps/web/src/app/(admin)/tenants/page.tsx`

**Interfaces:**
- Consumes: `.super-admin-*` CSS (Task 3), `KpiCard`/`.kpi` CSS (Task 2).
- Produces: no new interfaces.

- [ ] **Step 1: Fix KPI_CONFIG icon colors**

Before (tenants/page.tsx:28-50):
```tsx
const KPI_CONFIG = [
  {
    label: "Total Tenants",
    key: "total_tenants" as const,
    icon: Building2,
    iconColor: "text-orange-400",
    accent: "#f97316",
  },
  {
    label: "Tenants Ativos",
    key: "active_tenants" as const,
    icon: Users,
    iconColor: "text-green-400",
    accent: "#22c55e",
  },
  {
    label: "Conversas Total",
    key: "total_conversations" as const,
    icon: MessageSquare,
    iconColor: "text-indigo-600",
    accent: "#6366f1",
  },
];
```

After:
```tsx
const KPI_CONFIG = [
  {
    label: "Total Tenants",
    key: "total_tenants" as const,
    icon: Building2,
    iconColor: "text-orange-600",
    accent: "#f97316",
  },
  {
    label: "Tenants Ativos",
    key: "active_tenants" as const,
    icon: Users,
    iconColor: "text-green-600",
    accent: "#22c55e",
  },
  {
    label: "Conversas Total",
    key: "total_conversations" as const,
    icon: MessageSquare,
    iconColor: "text-indigo-600",
    accent: "#6366f1",
  },
];
```

- [ ] **Step 2: Fix StatusBadge styles map**

Before (tenants/page.tsx:52-58):
```tsx
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-green-500/10 text-green-400 border-green-500/25",
    TRIAL: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    SUSPENDED: "bg-red-500/10 text-red-400 border-red-500/25",
    CANCELLED: "bg-slate-800/80 text-slate-500 border-slate-600/50",
  };
```

After:
```tsx
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-green-500/10 text-green-600 border-green-500/25",
    TRIAL: "bg-amber-500/10 text-amber-700 border-amber-500/25",
    SUSPENDED: "bg-red-500/10 text-red-600 border-red-500/25",
    CANCELLED: "bg-slate-100 text-slate-500 border-slate-300",
  };
```

- [ ] **Step 3: Fix hero percentage stat and 4th KPI icon**

Before (tenants/page.tsx:151-194):
```tsx
          {!loading && total > 0 && (
            <div className="relative z-10 text-right hidden sm:block">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                Taxa de ativação
              </p>
              <p className="text-2xl font-bold text-white tabular-nums">
                {kpis.total_tenants > 0
                  ? Math.round((kpis.active_tenants / kpis.total_tenants) * 100)
                  : 0}
                %
              </p>
            </div>
          )}
        </section>

        <div className="super-admin-kpi-grid">
          {KPI_CONFIG.map((card) => {
            const raw = kpis[card.key];
            const value =
              card.key === "total_conversations"
                ? raw.toLocaleString("pt-BR")
                : String(raw);
            return (
              <KpiCard
                key={card.key}
                title={card.label}
                value={value}
                icon={card.icon}
                iconColor={card.iconColor}
                accent={card.accent}
                loading={loading}
                empty={!loading && raw === 0}
              />
            );
          })}
          <KpiCard
            title="Nesta Página"
            value={pageLabel}
            icon={Building2}
            iconColor="text-violet-400"
            accent="#8b5cf6"
            loading={loading}
          />
        </div>
```

After:
```tsx
          {!loading && total > 0 && (
            <div className="relative z-10 text-right hidden sm:block">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                Taxa de ativação
              </p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {kpis.total_tenants > 0
                  ? Math.round((kpis.active_tenants / kpis.total_tenants) * 100)
                  : 0}
                %
              </p>
            </div>
          )}
        </section>

        <div className="super-admin-kpi-grid">
          {KPI_CONFIG.map((card) => {
            const raw = kpis[card.key];
            const value =
              card.key === "total_conversations"
                ? raw.toLocaleString("pt-BR")
                : String(raw);
            return (
              <KpiCard
                key={card.key}
                title={card.label}
                value={value}
                icon={card.icon}
                iconColor={card.iconColor}
                accent={card.accent}
                loading={loading}
                empty={!loading && raw === 0}
              />
            );
          })}
          <KpiCard
            title="Nesta Página"
            value={pageLabel}
            icon={Building2}
            iconColor="text-violet-600"
            accent="#8b5cf6"
            loading={loading}
          />
        </div>
```

- [ ] **Step 4: Fix table header and empty state**

Before (tenants/page.tsx:196-226):
```tsx
        <div className="super-admin-table-wrap">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]">
            <div>
              <h3 className="text-sm font-semibold text-white">Todos os Tenants</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Ordenados por data de criação (mais recentes primeiro)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="super-admin-table-head">
                  {["Tenant", "Plano", "WhatsApp", "Conversas / Limite", "Status", "Ações"].map(
                    (h) => (
                      <th key={h}>{h}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton />
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Nenhum tenant cadastrado</p>
                    </td>
                  </tr>
                ) : (
```

After:
```tsx
        <div className="super-admin-table-wrap">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Todos os Tenants</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Ordenados por data de criação (mais recentes primeiro)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="super-admin-table-head">
                  {["Tenant", "Plano", "WhatsApp", "Conversas / Limite", "Status", "Ações"].map(
                    (h) => (
                      <th key={h}>{h}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton />
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Nenhum tenant cadastrado</p>
                    </td>
                  </tr>
                ) : (
```

- [ ] **Step 5: Fix table body row text**

Before (tenants/page.tsx:236-270):
```tsx
                      <tr key={t.id} className="super-admin-table-row">
                        <td>
                          <p className="font-medium text-white">{t.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {t.slug}.whatsagent.com.br
                          </p>
                          <p className="text-[10px] text-slate-600 mt-1">
                            {t._count.conversations.toLocaleString("pt-BR")} conversas totais
                          </p>
                        </td>
                        <td>
                          <span className="text-[11px] px-2.5 py-1 bg-indigo-500/10 text-indigo-300 rounded-full border border-indigo-500/20 font-medium">
                            {t.planType}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                              t.whatsappStatus === "CONNECTED"
                                ? "text-green-400"
                                : "text-slate-500"
                            }`}
                          >
                            {t.whatsappStatus === "CONNECTED" ? (
                              <CheckCircle className="w-3.5 h-3.5" aria-hidden />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" aria-hidden />
                            )}
                            {t.whatsappStatus === "CONNECTED" ? "Conectado" : "Desconectado"}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-slate-300 tabular-nums">
                            {msgs.toLocaleString("pt-BR")} / {limit.toLocaleString("pt-BR")}
                          </span>
```

After:
```tsx
                      <tr key={t.id} className="super-admin-table-row">
                        <td>
                          <p className="font-medium text-slate-900">{t.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {t.slug}.whatsagent.com.br
                          </p>
                          <p className="text-[10px] text-slate-600 mt-1">
                            {t._count.conversations.toLocaleString("pt-BR")} conversas totais
                          </p>
                        </td>
                        <td>
                          <span className="text-[11px] px-2.5 py-1 bg-indigo-500/10 text-indigo-600 rounded-full border border-indigo-500/20 font-medium">
                            {t.planType}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                              t.whatsappStatus === "CONNECTED"
                                ? "text-green-600"
                                : "text-slate-500"
                            }`}
                          >
                            {t.whatsappStatus === "CONNECTED" ? (
                              <CheckCircle className="w-3.5 h-3.5" aria-hidden />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" aria-hidden />
                            )}
                            {t.whatsappStatus === "CONNECTED" ? "Conectado" : "Desconectado"}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-slate-900 tabular-nums">
                            {msgs.toLocaleString("pt-BR")} / {limit.toLocaleString("pt-BR")}
                          </span>
```

- [ ] **Step 6: Confirm no change needed for the CANCELLED dash and pagination label**

`text-[11px] text-slate-600` (tenants/page.tsx:317, the "—" placeholder for CANCELLED tenants) and `text-xs text-slate-500` (tenants/page.tsx:330, pagination label) are already correct — do not edit them.

- [ ] **Step 7: Fix confirm dialog text and buttons**

Before (tenants/page.tsx:358-404):
```tsx
          <div className="super-admin-confirm-dialog">
            <h2 id="confirm-title" className="text-base font-semibold text-white">
              {pending.action === "suspend" ? "Suspender tenant" : "Reativar tenant"}
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              {pending.action === "suspend" ? (
                <>
                  O tenant <strong className="text-slate-200">{pending.tenantName}</strong>{" "}
                  perderá acesso ao painel e ao envio via WhatsApp até ser reativado.
                </>
              ) : (
                <>
                  O tenant <strong className="text-slate-200">{pending.tenantName}</strong>{" "}
                  voltará ao status ativo e poderá operar normalmente.
                </>
              )}
            </p>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg border border-[var(--c-border)] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmAction()}
                className={`px-3 py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                  pending.action === "suspend"
                    ? "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
                    : "bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30"
                }`}
              >
                {pending.action === "suspend" ? "Confirmar suspensão" : "Confirmar reativação"}
              </button>
            </div>
          </div>
```

After:
```tsx
          <div className="super-admin-confirm-dialog">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-900">
              {pending.action === "suspend" ? "Suspender tenant" : "Reativar tenant"}
            </h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              {pending.action === "suspend" ? (
                <>
                  O tenant <strong className="text-slate-900">{pending.tenantName}</strong>{" "}
                  perderá acesso ao painel e ao envio via WhatsApp até ser reativado.
                </>
              ) : (
                <>
                  O tenant <strong className="text-slate-900">{pending.tenantName}</strong>{" "}
                  voltará ao status ativo e poderá operar normalmente.
                </>
              )}
            </p>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 rounded-lg border border-[var(--c-border)] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmAction()}
                className={`px-3 py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                  pending.action === "suspend"
                    ? "bg-red-500/20 text-red-600 border border-red-500/30 hover:bg-red-500/30"
                    : "bg-green-500/20 text-green-600 border border-green-500/30 hover:bg-green-500/30"
                }`}
              >
                {pending.action === "suspend" ? "Confirmar suspensão" : "Confirmar reativação"}
              </button>
            </div>
          </div>
```

- [ ] **Step 8: Confirm no change needed for `usageBarColor()` and accent hex values**

`usageBarColor()` (tenants/page.tsx:74-78, returns `#ef4444`/`#f59e0b`/`#22c55e`) and the `accent`/`iconColor` hex values in `KPI_CONFIG` (`#f97316`, `#22c55e`, `#6366f1`, `#8b5cf6`) stay unchanged — do not edit them.

- [ ] **Step 9: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 10: Commit**

```bash
git add "apps/web/src/app/(admin)/tenants/page.tsx"
git commit -m "fix(web): retheme tenants page for light theme"
```

---

### Task 5: `email/page.tsx`

**Files:**
- Modify: `apps/web/src/app/(admin)/email/page.tsx`

**Interfaces:**
- Consumes: `.super-admin-*` CSS (Task 3), `.settings-input` CSS (Task 1).
- Produces: no new interfaces.

- [ ] **Step 1: Fix hero status indicator**

Before (email/page.tsx:159-174):
```tsx
          <div className="relative z-10 text-right hidden sm:block">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Status</p>
            <p
              className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                configured ? "text-green-400" : "text-slate-400"
              }`}
            >
              {configured ? (
                <CheckCircle className="w-4 h-4" aria-hidden />
              ) : (
                <XCircle className="w-4 h-4" aria-hidden />
              )}
              {configured ? "Configurado" : "Não configurado"}
            </p>
          </div>
        </section>
```

After:
```tsx
          <div className="relative z-10 text-right hidden sm:block">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Status</p>
            <p
              className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                configured ? "text-green-600" : "text-slate-500"
              }`}
            >
              {configured ? (
                <CheckCircle className="w-4 h-4" aria-hidden />
              ) : (
                <XCircle className="w-4 h-4" aria-hidden />
              )}
              {configured ? "Configurado" : "Não configurado"}
            </p>
          </div>
        </section>
```

- [ ] **Step 2: Fix credentials card heading**

Before (email/page.tsx:177-181):
```tsx
        <div className="super-admin-table-wrap p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--c-border)] pb-3">
            <Server className="w-4 h-4 text-indigo-600" aria-hidden />
            <h3 className="text-sm font-semibold text-white">Credenciais do servidor</h3>
          </div>
```

After:
```tsx
        <div className="super-admin-table-wrap p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--c-border)] pb-3">
            <Server className="w-4 h-4 text-indigo-600" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-900">Credenciais do servidor</h3>
          </div>
```

- [ ] **Step 3: Fix checkbox row and feedback text**

Before (email/page.tsx:249-270):
```tsx
          <label className="flex items-center gap-3 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.secure}
              onChange={(e) => update("secure", e.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-[#22c55e]"
            />
            <span className="text-[13px] text-slate-300">
              Conexão segura (TLS/SSL) — ative para porta 465
            </span>
          </label>

          {feedback && (
            <p
              className={`text-[13px] ${
                feedback.type === "success" ? "text-green-400" : "text-rose-400"
              }`}
            >
              {feedback.message}
            </p>
          )}
```

After:
```tsx
          <label className="flex items-center gap-3 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.secure}
              onChange={(e) => update("secure", e.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-slate-300 bg-white accent-[#22c55e]"
            />
            <span className="text-[13px] text-slate-900">
              Conexão segura (TLS/SSL) — ative para porta 465
            </span>
          </label>

          {feedback && (
            <p
              className={`text-[13px] ${
                feedback.type === "success" ? "text-green-600" : "text-rose-600"
              }`}
            >
              {feedback.message}
            </p>
          )}
```

- [ ] **Step 4: Fix save button**

Before (email/page.tsx:272-282):
```tsx
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-3.5 h-3.5" aria-hidden />
              {saving ? "Salvando…" : "Salvar configurações"}
            </button>
          </div>
        </div>
```

After:
```tsx
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-green-500/20 text-green-600 border border-green-500/30 hover:bg-green-500/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-3.5 h-3.5" aria-hidden />
              {saving ? "Salvando…" : "Salvar configurações"}
            </button>
          </div>
        </div>
```

- [ ] **Step 5: Fix test-email card heading, helper text, and test button**

Before (email/page.tsx:286-317):
```tsx
        <div className="super-admin-table-wrap p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--c-border)] pb-3">
            <Mail className="w-4 h-4 text-indigo-600" aria-hidden />
            <h3 className="text-sm font-semibold text-white">Enviar e-mail de teste</h3>
          </div>
          <p className="text-[12px] text-slate-500 -mt-1">
            Usa os valores do formulário acima (salvos ou não) para validar o envio.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <Field label="Destinatário">
                <input
                  className="settings-input"
                  type="email"
                  placeholder="voce@dominio.com"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  disabled={loading}
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing || loading || !testTo}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-[38px]"
            >
              <Send className="w-3.5 h-3.5" aria-hidden />
              {testing ? "Enviando…" : "Enviar teste"}
            </button>
          </div>
```

After:
```tsx
        <div className="super-admin-table-wrap p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--c-border)] pb-3">
            <Mail className="w-4 h-4 text-indigo-600" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-900">Enviar e-mail de teste</h3>
          </div>
          <p className="text-[12px] text-slate-500 -mt-1">
            Usa os valores do formulário acima (salvos ou não) para validar o envio.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <Field label="Destinatário">
                <input
                  className="settings-input"
                  type="email"
                  placeholder="voce@dominio.com"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  disabled={loading}
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing || loading || !testTo}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-indigo-500/20 text-indigo-600 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-[38px]"
            >
              <Send className="w-3.5 h-3.5" aria-hidden />
              {testing ? "Enviando…" : "Enviar teste"}
            </button>
          </div>
```

- [ ] **Step 6: Fix test feedback message and `Field` helper**

Before (email/page.tsx:319-350):
```tsx
          {testFeedback && (
            <p
              className={`text-[13px] ${
                testFeedback.type === "success" ? "text-green-400" : "text-rose-400"
              }`}
            >
              {testFeedback.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-slate-300">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
```

After:
```tsx
          {testFeedback && (
            <p
              className={`text-[13px] ${
                testFeedback.type === "success" ? "text-green-600" : "text-rose-600"
              }`}
            >
              {testFeedback.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-slate-900">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
```

- [ ] **Step 7: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/(admin)/email/page.tsx"
git commit -m "fix(web): retheme email (platform SMTP) page for light theme"
```

---

### Task 6: Verification sweep

**Files:** none modified — read-only verification task.

- [ ] **Step 1: Grep for remaining dark literals in the Admin scope**

Run:
```bash
grep -n "rgba(7,13,26\|rgba(12,21,38\|rgba(15,23,42\|rgba(2,6,23\|rgba(26,45,71\|rgba(30,41,59\|#fdba74\|#f87171\|#fecaca\|#4ade80\|#bbf7d0\|#f1f5f9\|#94a3b8\|#818cf8\|#a5b4fc\|#475569" apps/web/src/app/globals.css | awk -F: '$1 >= 3319 && $1 <= 3496 || $1 >= 5822 && $1 <= 5921 || $1 == 45 || $1 == 100'
```
Expected: no matches within the `.super-admin-*` (3319-3496), `.settings-*` (5822-5921), and `.kpi`/`.kpi-icon-wrap` (45, 100) scope. Matches outside this range (other still-dark pages) are expected and fine.

Run:
```bash
grep -n "text-white\|text-slate-400\b\|text-slate-300\b\|text-slate-200\b\|text-orange-400\|text-green-400\|text-red-400\|text-violet-400\|text-rose-400\|text-indigo-300\|text-green-300\|text-red-300\|bg-slate-800\|border-slate-600" "apps/web/src/app/(admin)/tenants/page.tsx" "apps/web/src/app/(admin)/email/page.tsx"
```
Expected: no matches.

- [ ] **Step 2: Full build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed cleanly.

- [ ] **Step 3: Spot-check the shared-prep transitional state**

Run:
```bash
grep -n "\.kpi {" -A 3 apps/web/src/app/globals.css
```
Expected: confirms `.kpi` background is now `#ffffff` — this is the shared-prep fix that will also apply to Overview/Analytics' still-dark pages (accepted transitional state, not a defect).

- [ ] **Step 4: Update the progress ledger**

Append to `.superpowers/sdd/progress.md`:
```
Phase 2.5 (Admin): Tasks 1-5 complete, verification sweep clean (grep + build + lint).
```

- [ ] **Step 5: No commit for this task**

This is a verification-only task; nothing to commit unless Step 1 or Step 2 finds a gap, in which case fix it under the relevant earlier task's commit message pattern before re-running the sweep.
