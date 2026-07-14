# Backoffice Light Theme — Phase 2.0 + 2.1: Shared Prep & CRM

## Goal

Continue the backoffice light-theme retheme (Phase 1 covered the shell: tokens, Sidebar, Header, Modal, buttons, form primitives, tags — all merged and reviewed clean). Phase 2 covers the "table/list" feature pages, broken into sub-phases smallest-to-largest: **CRM → Orders → Catalog → Support/Admin → Settings**.

This document covers the first two sub-phases:
- **Phase 2.0**: a small shared prep step for chrome/utility classes reused across multiple future sub-phases, so later sub-phases don't each re-fix the same shared class.
- **Phase 2.1**: CRM (Kanban board + deal modal) — the smallest remaining area, since Phase 1's token work already left most of `.crm-*` token-driven.

Orders, Catalog, Support/Admin, and Settings each get their own design doc later, following the same pattern.

## Why a shared prep step

Surveying the CRM page surfaced two classes of shared, cross-cutting problem that would otherwise be fixed piecemeal (and inconsistently) in every subsequent sub-phase:

1. **`text-indigo-400`** — a light indigo Tailwind shade meant for icons on a dark background — is hardcoded in ~30 files across the whole app, including files that belong to every remaining Phase 2 area (Orders, Catalog, Settings, Support, Admin). Left as-is, every icon using it renders low-contrast on the new light backgrounds (the same defect the Phase 1 final review caught and fixed for the header user-chip).
2. **`.catalog-hero*` / `.catalog-toolbar` / `.catalog-search-*` / `.catalog-view-*` / `.catalog-add-btn` / `.catalog-btn-secondary` / `.catalog-panel` / `.catalog-empty*`** (globals.css:2269-2482) — despite the name, this is a shared "page hero + toolbar" component reused by CRM, Catalog, and the (out-of-scope, dark-for-now) Agent pages. `.kb-toast*` (success/error toast) is similarly shared by CRM and, later, Catalog.

Fixing these once, now, means CRM/Orders/Catalog/Settings/Support/Admin all inherit correct chrome without repeat work.

## Phase 2.0 scope

### A. Icon color fix — `text-indigo-400` → `text-indigo-600`

Applied only in files that belong to an **already-approved Phase 2 area** (CRM, Orders, Catalog, Settings, Support, Admin). Explicitly NOT applied in files belonging to areas not yet rethemed (Agent, Onboarding, Analytics, Overview) — those pages' surrounding cards/backgrounds are still dark, so darkening just the icon there would reduce contrast rather than improve it; they'll get the correct fix when their own phase runs.

Files in scope for this replacement (exact string `text-indigo-400` → `text-indigo-600`; the one `text-indigo-400/40` occurrence, if present in an in-scope file, becomes `text-indigo-600/40` — same opacity modifier, just the base shade darkened):

- `apps/web/src/components/catalog/ProductFormModal.tsx`
- `apps/web/src/components/orders/OrderDetailModal.tsx`
- `apps/web/src/components/orders/UpdateStatusModal.tsx`
- `apps/web/src/components/crm/DealFormModal.tsx`
- `apps/web/src/app/(dashboard)/orders/page.tsx`
- `apps/web/src/app/(dashboard)/settings/page.tsx`
- `apps/web/src/app/(dashboard)/support/page.tsx`
- `apps/web/src/app/(admin)/tenants/page.tsx`
- `apps/web/src/app/(admin)/email/page.tsx`

Not in scope for this pass (left dark, future phase): `analytics/*`, `agent/*`, `overview/*`, `(onboarding)/*`.

### B. Shared page-hero component → light

Retheme the full block at `apps/web/src/app/globals.css:2269-2482` (`.catalog-hero`, `.catalog-hero::before`, `.catalog-hero-content`, `.catalog-hero-badge`, `.catalog-hero-title`, `.catalog-hero-sub`, `.catalog-hero-actions`, `.catalog-toolbar`, `.catalog-search-wrap`, `.catalog-search-icon`, `.catalog-search-input` (+ `::placeholder`/`:hover`/`:focus`), `.catalog-filter-tabs`, `.catalog-view-toggle`, `.catalog-view-btn` (+ `:hover`/`-active`), `.catalog-add-btn` (+ `:hover`/`:disabled`), `.catalog-btn-secondary` (+ `:hover`), `.catalog-panel`, `.catalog-empty`, `.catalog-empty-icon`) using the established Phase 1 recipe: dark surface literals → white/light-gray, light-on-dark text literals → dark text, `rgba(255,255,255,X)` hover overlays → `rgba(15,23,42,X)`, semantic accent tints (green/indigo at low opacity) stay.

Known accepted side effect: the Agent pages (`agent/page.tsx`, `agent/persona/page.tsx`) also render `.catalog-hero`/`.catalog-add-btn`. Their hero banner will turn light while the rest of that page stays dark until Agent's own future phase — the same kind of transitional mixed state Phase 1 already left everywhere (light shell wrapping still-dark feature bodies). Not a regression, just the same pattern one layer deeper; no action needed now.

### C. Toast → light

Retheme `.kb-toast`, `.kb-toast--success`, `.kb-toast--error` (globals.css:8699-8723): white background, softened shadow, darkened green/red text for contrast (matching the `.tag-green`/`.tag-red` values already established in Phase 1: `#15803d` / `#b91c1c` — reusing those exact values here for consistency rather than inventing new ones).

## Phase 2.1 scope — CRM

### CSS (`apps/web/src/app/globals.css:9506-9573`, `.crm-*` block)

Already ~95% token-driven from Phase 1 (`var(--c-text)`, `var(--c-muted)`, `var(--c-s1/s2/s3)`, `var(--c-border)`, `var(--c-green)`, `var(--c-indigo)` throughout). Only these literals need adjusting:
- `.crm-deal-card:hover` shadow `rgba(0,0,0,0.3)` → `rgba(15,23,42,0.12)`
- `.crm-deal-drag:hover` background `rgba(255,255,255,0.06)` → `rgba(15,23,42,0.05)`
- `.crm-deal-btn:hover` background `rgba(255,255,255,0.07)` → `rgba(15,23,42,0.05)`
- `.crm-deal-btn--danger:hover` color `#f87171` → `#dc2626`

`.crm-column-dot` sets `background: stage.color` inline from DB-configured funnel-stage colors — user data, not a theme literal, left untouched.

### `apps/web/src/app/(dashboard)/crm/page.tsx`

Inline-styled stat cards (lines ~100-113): background `rgba(15,23,42,0.8)` → `#ffffff` (border already `var(--c-border)`, untouched); value text `#e2e8f0` → `#0f172a`. Label text `#64748b` and loading text `#64748b` are unchanged (already legible on both themes). The delete-confirmation button (`background:#ef4444; color:#fff`, line ~164) is a semantic danger button — left as-is, works identically on light or dark.

### `apps/web/src/components/crm/DealFormModal.tsx`

Error banner (lines ~210-218): text color `#fca5a5` → `#dc2626` (background `rgba(239,68,68,0.08)` unchanged). The `headerLeading` icon's `text-indigo-400` is covered by Phase 2.0.A above (this file is in that list).

`KanbanBoard.tsx`, `KanbanColumn.tsx`, `DealCard.tsx` need no changes — they only consume already-covered `.crm-*` classes, no literals of their own.

## Explicitly out of scope (this document)

- Orders, Catalog, Support/Admin, Settings feature pages — each gets its own design doc + plan in its turn.
- Agent, Onboarding, Analytics, Overview pages — future phases, stay dark for now (aside from the incidental `.catalog-hero` side effect noted above).
- The public landing page and `AuthShell.tsx` — permanently out of scope per the original Phase 1 decision.

## Verification

- `pnpm --filter @whatsagent/web build` and `pnpm --filter @whatsagent/web lint` after each task.
- Manual check (deferred to the user — no browser tool available to the controller): open `/crm`, confirm the hero banner, toolbar, stat cards, Kanban columns/cards, and the "new deal" modal all read as light theme with legible text/icons; open `/catalog` briefly just to confirm its hero banner (still otherwise dark body) didn't break.
