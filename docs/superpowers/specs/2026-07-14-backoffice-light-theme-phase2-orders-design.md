# Backoffice Light Theme — Phase 2.2: Orders

## Goal

Continue the backoffice light-theme retheme, second sub-phase of Phase 2 (CRM → **Orders** → Catalog → Support/Admin → Settings). CRM (Phase 2.0/2.1) is done and merged. This covers the Orders list page and its four modals (Create, Detail, Update Status, Cancel).

## Why this is bigger than CRM

Orders has two things CRM didn't:
1. A genuine cross-phase CSS dependency: the page's "como os pedidos funcionam" info section renders through `.support-stat-*`/`.support-info-*` classes — shared with the (not-yet-started) Support page — which are still dark.
2. `CreateOrderModal.tsx` is almost entirely inline `style={{}}` with hardcoded dark-theme hex/rgba (no reuse of the `.form-*` primitives Phase 1 built). Per the previously approved approach, this phase does **value-only swaps** on those inline styles — no refactor into `.form-*` classes, even though the component is a good future refactor candidate.

## Scope

### A. Shared prep: `.support-stat-*` / `.support-info-*` (color-bearing rules only)

Retheme now (small, ~10 rules, most already token-driven) so the Support page inherits it for free later, matching the `.catalog-hero` precedent from Phase 2.0:
- `.support-stat-card` (globals.css:3927): background `rgba(12,21,38,0.85)` → light surface; `:hover` shadow `rgba(0,0,0,0.15)` → lighter.
- `.support-stat-value` (globals.css:3986): `#f1f5f9` → dark text.
- `.support-info-card` (globals.css:4424): background `rgba(12,21,38,0.75)` → light surface; `:hover` shadow `rgba(0,0,0,0.1)` → lighter.

Not touched: `.support-stats-grid`, `.support-stat-icon` (no literal color, just layout + `border: 1px solid` with color supplied inline per-card), `.support-stat-label` (`#64748b`, already fine), `.support-info-row`, `.support-info-card-header`, `.support-info-card-glow--indigo/--green` (decorative blur tints, fine on light), `.support-stat-glow` (decorative, fine). These are the only ones the Orders info-cards actually render with a structural dark literal.

### B. `.orders-*` CSS (globals.css:5206-5528)

Already partly token-driven (`.orders-panel`, `.orders-th`, `.orders-td`, `.orders-empty-icon`, most of `.orders-ghost-btn`/`.orders-tab`/`.orders-tool-btn` base states already use `var(--c-*)`). Literal fixes needed:
- `.orders-hero-badge` text `#a5b4fc` → `#4f46e5` (matches the Phase 1 header-chip fix).
- `.orders-hero-title` `#f1f5f9` → dark text (near-white text was invisible on the light hero).
- `.orders-table-head` background `rgba(255,255,255,0.02)` → dark-tint (matches Phase 1/2 hover-overlay recipe).
- `.orders-tr` border `rgba(26,45,71,0.5)` → `var(--c-border)`-equivalent; `:hover` background `rgba(255,255,255,0.025)` → dark-tint.
- `.orders-empty-ring` border `rgba(26,45,71,0.6)` → light equivalent.
- `.orders-btn-secondary` text `#94a3b8` → `#64748b`; background `rgba(255,255,255,0.02)` → light; `:hover` background `rgba(255,255,255,0.04)` → dark-tint.
- `.orders-tool-btn` text `#94a3b8` → `#64748b`; background `rgba(255,255,255,0.02)` → light; `:hover` background `rgba(255,255,255,0.04)` → dark-tint.
- `.orders-ghost-btn:hover` background `rgba(255,255,255,0.04)` → dark-tint (note: this class isn't currently used by Orders' own markup — grep confirms only `.orders-btn`/`.orders-btn-primary`/`.orders-btn-secondary` are referenced — fixed anyway since it's in the same block and cheap, avoids leaving dead-but-wrong CSS).
- `.orders-btn-primary` text `#4ade80` → `#15803d` (contrast, matches the CRM/tag precedent); `.orders-tab-active` text `#4ade80` → `#15803d` (both states, resting + hover).

Not touched: `.orders-tool-btn--active` (globals.css:10271, physically lives in the catalog CSS block, already correctly green/semantic with no dark literal, and used only by Catalog's filter panel — not by Orders at all).

### C. `orders/page.tsx`

- Row action dropdown menu (inline style, ~L240-262): background `#0f172a` → white; border `rgba(51,65,85,0.8)` → `var(--c-border)`-equivalent; shadow `rgba(0,0,0,0.5)` → matches established dropdown shadow (`rgba(15,23,42,0.16)`); item text `#94a3b8` → `#64748b`; hover background `rgba(255,255,255,0.05)` → dark-tint.
- Two `text-[#e2e8f0]` occurrences (empty-state heading, info-row labels) → dark text.
- `STATUS_CONFIG` (L20-25) text colors darkened per your confirmation: `#fbbf24`→`#a16207`, `#818cf8`→`#4f46e5`, `#4ade80`→`#15803d`, `#f87171`→`#dc2626`. Backgrounds/borders (rgba tints) unchanged.
- `text-green-400` (Truck icon) → `text-green-600`, same pattern as the earlier `text-indigo-400`→`600` fix, scoped to this file only.
- `stats` KPI array (L100-104, indigo/green/amber/rose icon-accent colors): left unchanged — these are icon-glyph tints inside a colored circle, not small body text, matching the precedent set in CRM's `STAT_CARDS` where icon tint colors were left as-is and only the surrounding card surface/value text were fixed.
- Stat-card surface (if it follows the same `rgba(15,23,42,0.8)` background / `#e2e8f0` value-text pattern as CRM's stat cards — to be confirmed against the live file during planning): same treatment as CRM Task 5 (background → white, value text → dark).

### D. `CreateOrderModal.tsx` — value-only swaps (no `.form-*` refactor)

- Every input/textarea: background `rgba(15,23,42,0.8)` → white; border `rgba(51,65,85,0.6)` → `var(--c-border)`-equivalent; text `#e2e8f0` → dark text.
- Product-search dropdown: background `#0f172a` → white; border `rgba(51,65,85,0.8)` → light; shadow `rgba(0,0,0,0.5)` → light; result-row text `#94a3b8`/`#e2e8f0` → dark/muted; hover `rgba(255,255,255,0.05)` → dark-tint.
- Cart entry rows: background `rgba(15,23,42,0.6)` → light chip (`#f8fafc`); border `rgba(51,65,85,0.5)` → `var(--c-border)`; text `#e2e8f0` → dark text; qty-button background `rgba(51,65,85,0.5)` → `#f1f5f9`; qty-button text `#94a3b8` → `#475569`.
- Footer submit button (success green): text `#4ade80` → `#15803d`.
- `text-green-400` icon → `text-green-600`.
- Error text `#f87171` → `#dc2626`.
- Neutral labels/icons already at `#64748b`/`#475569` left unchanged (legible on light).

### E. `OrderDetailModal.tsx` — value-only swaps

- `#e2e8f0` occurrences (client name, item text, total row, payment row) → dark text.
- `#94a3b8` occurrences (subtotal, notes) → `#64748b`.
- Divider border `rgba(51,65,85,0.6)` → `var(--c-border)`-equivalent.
- Neutral `#64748b` text left unchanged.

### F. `UpdateStatusModal.tsx` — value-only swaps

- Save button: text `#818cf8` → `#4f46e5`.
- Radio option selected-state text `#a5b4fc` → `#4f46e5`; unselected text `#94a3b8` → `#64748b`.
- `accentColor: #6366f1` on the native radio input left unchanged (already a solid, sufficiently-saturated indigo).
- Error text `#f87171` → `#dc2626` (already the established value elsewhere — confirm it's not already fixed here before editing).

### G. `CancelOrderModal.tsx` — value-only swaps

- `text-red-400` icon → `text-red-600` (same pattern as the green/indigo darkening elsewhere).
- Confirm button text `#f87171` → `#dc2626`.
- Body text `#94a3b8` → `#64748b`.
- `<strong>` order number `#e2e8f0` → dark text.
- Remaining `#f87171` (error banner) → `#dc2626`.

## Explicitly out of scope

- Catalog, Support/Admin, Settings — future sub-phases.
- Any `.support-*` class not listed in section A — those wait for Support's own phase.
- Refactoring any of the four modals' inline styles into `.form-*` classes — explicitly rejected in favor of value-only swaps, consistent with the approach approved for CRM.
- Agent, Onboarding, Analytics, Overview — untouched, still dark.

## Verification

- `pnpm --filter @whatsagent/web build` and `pnpm --filter @whatsagent/web lint` after each task.
- Manual check (deferred to the user — no browser tool available to the controller): open `/orders`, confirm hero, table, status badges, empty state, and the "como funciona" info cards all read light and legible; open each of the four modals (create, detail, update status, cancel) and confirm inputs/dropdowns/cart rows/buttons are legible on white.
