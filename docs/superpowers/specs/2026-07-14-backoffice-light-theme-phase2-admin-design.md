# Backoffice Light Theme — Phase 2.5: Admin

## Goal

Continue the backoffice light-theme retheme. Fifth sub-phase of Phase 2 (CRM → Orders → Catalog → Support → **Admin** → Settings). CRM, Orders, Catalog, and Support are done and committed. This covers the `(admin)` route group: `tenants/page.tsx`, `email/page.tsx` (platform SMTP), the `.super-admin-*` CSS block, and two shared-dependency preps (`.settings-input` family, `KpiCard`/`.kpi` CSS).

## Why this phase needs two shared-prep steps

Unlike Catalog/Support (each needed at most one shared-prep step), Admin has two genuine cross-phase dependencies:
1. `email/page.tsx` uses `.settings-input` (7 usages) — the same CSS class `(dashboard)/settings/page.tsx` will need for its own still-future phase. Fixing it now (shared prep) means Settings inherits already-light input styling.
2. `tenants/page.tsx` uses the shared `KpiCard` component, whose `.kpi`/`.kpi-icon-wrap` CSS is also used by the still-dark Overview and Analytics pages (neither in scope for any planned sub-phase yet). Fixing the two dark background rules here is unavoidable — the KPI cards must be light for tenants' own page to work — and it incidentally lightens Overview/Analytics ahead of time. This creates an accepted "transitional mixed state" (light KPI cards on otherwise-dark pages), consistent with every prior shared-prep decision in this project; final reviewers should not flag it as a defect.

`(admin)/layout.tsx` is already fully light (`bg-[#f8fafc]`, matches `--c-base`, delegates to the already-retheme'd shared `Sidebar`) — no work needed there.

## Scope

### A. Shared prep: `.settings-input` family (globals.css:5811-5944, 5873-5921)

- `.settings-field-hint` color `#475569` → keep or lighten to a proper muted tone — **use `#64748b`** (matches the established muted-text target; `#475569` was a dark-theme-specific darker gray, not appropriate as a light-theme muted default).
- `.settings-field-label` color `#94a3b8` → `#64748b` (muted text mapping).
- `.settings-input` background `rgba(7,13,26,0.65)` → light surface (`#ffffff`).
- `.settings-input` `::placeholder` color `#475569` → `#94a3b8` (placeholder gray, matches other placeholder conventions in the codebase, e.g. `.catalog-search-input::placeholder`).
- `.settings-input:hover` background `rgba(7,13,26,0.85)` → light surface tint (slightly darker than resting state, e.g. `#f8fafc`).
- `.settings-input:focus` background `rgba(7,13,26,0.95)` → light surface (`#ffffff`, focus ring/border already handle the visual emphasis).
- `.settings-divider` border-top `rgba(26,45,71,0.6)` → `var(--c-border)`-equivalent.
- `.settings-slug-prefix` color `#64748b` — already the target muted value, **no change needed**.
- `.settings-link-btn` color `#818cf8` → `#4f46e5` (indigo mapping); `:hover` color `#a5b4fc` → `#4f46e5` (same target — hover no longer needs a distinct lighter shade).
- `.settings-avatar-btn` color `#94a3b8` → `#64748b` (muted text mapping).
- Not touched: `.settings-input` border/color/`:focus` border-color/box-shadow (already `var(--c-border)`/`var(--c-text)`/indigo accent tint — tokenized or decorative-fine); `.settings-avatar` gradient/border/shadow (indigo tint, decorative, matches `.catalog-hero-badge`-style accent precedent); `.settings-avatar-btn:hover` (already tokenized `var(--c-text)`/`var(--c-s3)`); `.settings-webhook-input`/`.settings-slug-input` (layout-only overrides, no color).

### B. Shared prep: `KpiCard`/`.kpi` CSS (globals.css:45,68,100; `KpiCard.tsx`:68)

- `.kpi` background `rgba(12,21,38,0.75)` → light surface (`#ffffff`).
- `.kpi-icon-wrap` background `rgba(15,23,42,0.5)` → light surface tint (`#f8fafc` or similar).
- `KpiCard.tsx:68` inline `style={{ color: "#475569" }}` on the title `<span>` → `#64748b` (muted text mapping — same rationale as `.settings-field-hint` above: `#475569` was a dark-theme-appropriate darker gray, `#64748b` is the correct light-theme muted default).
- Not touched: `.kpi::after` (near-invisible white sheen, harmless no-op artifact on light bg, not worth touching); `.kpi:hover`/`.kpi-accent::before`/`.kpi-icon-wrap` hover states (already tokenized or accent-`color-mix`-derived from already-light-safe `--c-green`/`--c-indigo` tokens); `KpiCard.tsx`'s `iconColor`/`accent` prop defaults (component-level, not page-specific — each consuming page controls its own accent values, see sections C/D).

### C. `.super-admin-*` CSS (globals.css:3319-3496)

- `.super-admin-hero::after` background `rgba(255,255,255,0.02)` — near-invisible dark-glass sheen artifact, **remove or leave as harmless no-op** (not worth a value swap; will render as functionally invisible on light bg, same treatment as `.kpi::after`).
- `.super-admin-badge` color `#fdba74` → `#ea580c` (Tailwind `orange-600` hex equivalent — consistent with the `text-orange-400`→`text-orange-600` decision applied elsewhere in this phase).
- `.super-admin-table-head th` background `rgba(15,23,42,0.5)` → light surface (`#f8fafc`).
- `.super-admin-table-row` border-bottom `rgba(30,41,59,0.6)` → `var(--c-border)`-equivalent.
- `.super-admin-table-row:hover` background `rgba(15,23,42,0.45)` → light hover tint (`rgba(15,23,42,0.03)`, matching the established row-hover recipe from Orders/Catalog/Support).
- `.super-admin-action-suspend` color `#f87171` → `#dc2626` (red mapping); `:hover` color `#fecaca` → `#dc2626` (collapses to the same target, matching the `.settings-link-btn:hover` precedent above).
- `.super-admin-action-activate` color `#4ade80` → `#15803d` (green mapping); `:hover` color `#bbf7d0` → `#15803d` (collapses to the same target).
- `.super-admin-pagination` background `rgba(15,23,42,0.35)` → light surface tint (`#f8fafc`).
- `.super-admin-page-btn` color `#94a3b8` → `#64748b` (muted text mapping).
- `.super-admin-page-btn:hover` color `#f1f5f9` → `#0f172a` (near-white text mapping); background `rgba(255,255,255,0.06)` → dark-tint-on-light (`rgba(15,23,42,0.06)`); border-color `rgba(148,163,184,0.35)` → `var(--c-border)`-equivalent.
- `.super-admin-confirm-backdrop` background `rgba(2,6,23,0.72)` → light scrim (per decision: lighten, consistent with Catalog's `.filter-panel-overlay` divergence from `.modal-overlay`) — e.g. `rgba(15,23,42,0.25)`, matching the exact recipe already established for `.filter-panel-overlay`.
- `.super-admin-confirm-dialog` box-shadow `rgba(0,0,0,0.45)` → lighter (`rgba(15,23,42,0.16)`, matching the established dropdown/dialog shadow recipe).
- Not touched: `.super-admin-hero` background gradients/border (orange/indigo tints on `var(--c-s1)`, decorative, same precedent as `.catalog-hero`/`.support-hero`); `.super-admin-badge` background/border (orange tint, decorative); `.super-admin-table-wrap`/`.super-admin-usage-track`/`.super-admin-confirm-dialog` background (already tokenized `var(--c-s1)`/`var(--c-s3)`); `.super-admin-table-head th` text color (`#64748b`, already target); `.super-admin-action-suspend`/`.super-admin-action-activate` background/border (translucent red/green tints, decorative); `.super-admin-table-wrap::before` gradient (orange/indigo accent line, decorative).

### D. `tenants/page.tsx`

- KPI icon colors: `text-orange-400`→`text-orange-600`, `text-green-400`→`text-green-600` (KPI_CONFIG array); standalone 4th card `text-violet-400`→`text-violet-600` ("Nesta Página"). `text-indigo-600` (Conversas KPI) already correct, **no change**.
- `iconColor`/`accent` hex values (`#f97316`, `#22c55e`, `#6366f1`, `#8b5cf6`) passed to `KpiCard` as the `accent` prop — these feed CSS custom properties (`--kpi-accent`) for hover glows, **left unchanged** (decorative accent tints, same precedent as every other KPI/stat-card accent array in this project).
- `StatusBadge` map: `ACTIVE` `text-green-400`→`text-green-600`; `TRIAL` `text-amber-400`→`text-amber-700` (established Support-phase mapping); `SUSPENDED` `text-red-400`→`text-red-600`; `CANCELLED` `bg-slate-800/80 text-slate-500 border-slate-600/50` → `bg-slate-100 text-slate-500 border-slate-300` (light equivalents; `text-slate-500` already correct, only bg/border need to flip).
- `usageBarColor()` helper: `#ef4444`/`#f59e0b`/`#22c55e` — **left unchanged**, these are semantic status-threshold accent colors driving a progress-bar fill, not body text, matching the precedent of leaving `STATUS_CONFIG`-style accent arrays alone throughout this project.
- Hero: `text-slate-500` (label) already correct; `text-white`→`text-slate-900` (percentage stat).
- Table header: `text-white`→`text-slate-900` (h3); `text-slate-500` (subtitle) already correct.
- Empty state: `text-slate-600` (icon) already correct/legible; `text-slate-400`→`text-slate-500` (empty message, muted-text mapping).
- Table body: `text-white`→`text-slate-900` (tenant name); `text-slate-500` (slug line) already correct; `text-slate-600` (micro line) already correct; plan-type pill `bg-indigo-500/10 text-indigo-300 border-indigo-500/20`→`text-indigo-600` (background/border tints unchanged); WhatsApp status ternary `text-green-400`→`text-green-600` (connected branch), `text-slate-500` (disconnected branch) already correct; `text-slate-300`→`text-slate-900` (conversas/limite numeric text); `text-slate-600` (CANCELLED dash placeholder) already correct.
- Pagination: `text-slate-500` (page label) already correct.
- Confirm dialog: `text-white`→`text-slate-900` (title); `text-slate-400`→`text-slate-500` (body); `text-slate-200`→`text-slate-900` (`<strong>` tenant name, both suspend/activate copy variants); `text-slate-400 hover:text-white`→`text-slate-500 hover:text-slate-900` (Cancel button); suspend button `bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30`→`text-red-600` (bg/border/hover-bg tints unchanged); activate button `bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30`→`text-green-600` (bg/border/hover-bg tints unchanged).

### E. `email/page.tsx`

- Hero status: `text-slate-500` (label) already correct; ternary `text-green-400`→`text-green-600` (configured), `text-slate-400`→`text-slate-500` (not configured).
- Credentials/test-email card headers: `text-indigo-600` (×2, Server/Mail icons) already correct; `text-white`→`text-slate-900` (×2, h3 headings).
- Checkbox row: `border-slate-600 bg-slate-800`→`border-slate-300 bg-white`; `accent-[#22c55e]` **left unchanged** (accent color, decorative, matches green family); `text-slate-300`→`text-slate-900` (label span — this is primary label text, not a muted caption, so it maps to the near-white/heading-text target rather than the muted-text target).
- Save-form feedback ternary: `text-green-400`→`text-green-600`, `text-rose-400`→`text-rose-600` (new rose mapping per decision).
- Save button: `bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30`→`text-green-600` (bg/border/hover-bg tints unchanged).
- Helper text: `text-slate-500` already correct.
- Test button: `bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30`→`text-indigo-600` (bg/border/hover-bg tints unchanged).
- Test feedback ternary: `text-green-400`→`text-green-600`, `text-rose-400`→`text-rose-600`.
- `Field` helper component: `text-slate-300`→`text-slate-900` (label — primary field label, same rationale as checkbox label above); `text-slate-500` (hint) already correct.
- Not touched: the 7 `.settings-input` usages (fixed via shared prep in section A, no per-usage change needed in this file).

## Explicitly out of scope

- Settings — future, final sub-phase. Only its shared `.settings-input` dependency is touched here (section A).
- Overview, Analytics — not planned sub-phases; incidentally receive lighter `KpiCard`/`.kpi` backgrounds via the shared-prep in section B, an accepted transitional state, not a defect.
- `.settings-field-row`/`.settings-field-control` layout rules and any `.settings-*` class not listed in section A — out of scope, reserved for Settings' own phase if further work is needed there.
- Refactoring any inline styles into `.form-*` classes — value-only swaps only, consistent with every prior sub-phase.
- Agent, Onboarding, Inbox — untouched, still dark.

## Verification

- `pnpm --filter @whatsagent/web build` and `pnpm --filter @whatsagent/web lint` after each task.
- Manual check (deferred to the user — no browser tool available to the controller): open `/tenants`, confirm hero, KPI cards (all 4, including the standalone violet one), table (header, rows, hover, status badges for all 4 statuses, usage bars, plan pills, WhatsApp status), pagination, and the suspend/activate confirmation dialog (including its backdrop) all read light and legible. Open `/email`, confirm hero status indicator, both credential/test-email cards (headers, inputs, checkbox, buttons, feedback messages). Also spot-check `/overview` and `/analytics` KPI cards to confirm the shared-prep fix renders correctly there too (expected: KPI cards light, everything else on those pages still dark — accepted transitional state).
