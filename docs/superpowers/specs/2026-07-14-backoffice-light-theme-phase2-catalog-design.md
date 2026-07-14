# Backoffice Light Theme — Phase 2.3: Catalog

## Goal

Continue the backoffice light-theme retheme, third sub-phase of Phase 2 (CRM → Orders → **Catalog** → Support/Admin → Settings). CRM (2.0/2.1) and Orders (2.2) are done and committed. This covers the Catalog (products) page, its list/grid/pagination CSS, the Import Products modal, the Advanced Filter Panel, and all catalog-scoped React components.

## Why this phase is self-contained

Research confirmed Catalog's remaining dark CSS (`.product-*`, `.import-*`, `.filter-panel*`, `.catalog-page-btn`, `.orders-tool-btn--active`) is not referenced by any not-yet-migrated route (Support/Admin, Settings). No shared-prep step is needed this time, unlike CRM (`.catalog-hero*` prep) or Orders (`.support-stat-*`/`.support-info-*` prep). The only cross-phase touchpoint is a straggler fix (see section F) inside a block Orders already assumed was clean.

## Scope

### A. `.catalog-*` shell CSS — already light, confirmed, no work needed

`.catalog-hero*`, `.catalog-toolbar`, `.catalog-search-*`, `.catalog-view-*`, `.catalog-add-btn`, `.catalog-btn-secondary`, `.catalog-panel`, `.catalog-empty*` (globals.css:2269-2483) were retheme'd during the CRM shared-prep phase. `kb-toast*` (globals.css:8697-8721) likewise already light.

### B. Product Card CSS (globals.css:9843-9950)

- `.product-card` background `rgba(15,23,42,0.8)` → light surface.
- `.product-card-image` background `rgba(30,41,59,0.6)` → light placeholder tint.
- `.product-card-action-overlay` background `rgba(2,6,23,0.72)` → light frosted chip (per decision: lighten, not keep dark) — e.g. `rgba(255,255,255,0.92)` with a light border/shadow so the edit/delete icon buttons read as a floating chip on white, consistent with how dropdowns/panels render elsewhere.
- `.product-card-action-overlay` border `rgba(148,163,184,0.15)` → `var(--c-border)`-equivalent.
- `.product-card-action-icon` `#cbd5e1` → dark-on-light equivalent (e.g. `#64748b`); `:hover` `#a5b4fc` → `#4f46e5`; `.danger:hover` `#fca5a5` → `#dc2626`.
- `.product-card-action-divider` background `rgba(148,163,184,0.2)` → lighter equivalent.
- `.product-card-name` `#e2e8f0` → `#0f172a`.
- `.product-card-stock` `#94a3b8` → `#64748b`.
- `.product-card-stock.low` `#f59e0b` → `#a16207` (amber mapping, matches STATUS_CONFIG precedent from Orders).
- Not touched: `.product-card-sku`, `.product-card-compare` (`#64748b`, already correct); `.product-card-price` (`#22c55e`, green accent, matches `--c-green` family).

### C. Product List Row CSS (globals.css:9951-9998)

- `:hover` background `rgba(15,23,42,0.5)` → light hover-tint (dark-tint-on-light recipe, e.g. `rgba(15,23,42,0.03)`, matching `.orders-tr:hover`).
- `.product-list-thumb` background `rgba(30,41,59,0.6)` → light placeholder tint.
- `.product-list-name` `#e2e8f0` → `#0f172a`.
- `.product-list-action-btn:hover` `#818cf8` → `#4f46e5` (background tint `rgba(99,102,241,0.1)` kept as-is).
- `.danger:hover` `#f87171` → `#dc2626` (background tint `rgba(239,68,68,0.1)` kept as-is).
- Not touched: `.product-list-header`, `.product-list-sku`, `.product-list-action-btn` base (`#64748b`, already correct).

### D. Catalog Grid / Pagination CSS (globals.css:10001-10044)

- `.catalog-page-btn` `#94a3b8` → `#64748b`; `:hover` `#4ade80` → `#15803d`; `.active` `#4ade80` → `#15803d`.
- Not touched: `.catalog-pagination` (`#64748b`, already correct).

### E. Import Products Modal CSS (globals.css:10046-10182)

Full retheme, none of this was covered by earlier prep:
- `.import-drop-zone-title` `#e2e8f0` → `#0f172a`.
- `.import-file-selected` `#86efac` → `#15803d`.
- `.import-result-row.success` `#86efac` → `#15803d`; `.import-result-row.error` `#fca5a5` → `#dc2626`.
- `.import-preview-status` / `.import-preview-summary` `#94a3b8` → `#64748b`.
- `.import-preview-summary-valid` `#86efac` → `#15803d`; `.import-preview-summary-invalid` `#fca5a5` → `#dc2626`.
- `.import-preview-table th` background `rgba(15,23,42,0.95)` → light surface (e.g. `#f8fafc`).
- `.import-preview-table td` `#cbd5e1` → `#0f172a`; border-bottom `rgba(51,65,85,0.35)` → `var(--c-border)`-equivalent.
- `.import-preview-badge.valid` `#86efac` → `#15803d`; `.import-preview-badge.invalid` `#fca5a5` → `#dc2626`.
- `.import-preview-error-item` `#fca5a5` → `#dc2626`; `.import-preview-error-more` `#94a3b8` → `#64748b`.
- Not touched: `.import-drop-zone-icon`, `.import-drop-zone-subtitle`, `.import-file-remove`, `.import-preview-table th` text color (`#64748b`, already correct).

### F. Advanced Filter Panel CSS (globals.css:10184-10268) + straggler fix

- `.filter-panel-overlay` background `rgba(2,6,23,0.55)` → light scrim (per decision: lighten, an intentional divergence from `.modal-overlay`'s dark-scrim precedent — accepted because the user chose consistency-with-theme over consistency-with-modal here).
- `.filter-panel` background `rgba(15,23,42,0.98)` → light surface (e.g. `#ffffff`).
- `.filter-panel-title` `#e2e8f0` → `#0f172a`.
- `.filter-panel-close` `#94a3b8` → `#64748b`; `:hover` `#e2e8f0` → `#0f172a`, hover background `rgba(255,255,255,0.05)` → dark-tint-on-light (e.g. `rgba(15,23,42,0.05)`, matching `.catalog-view-btn:hover`).
- Not touched: `.filter-panel-sep` (`#64748b`, already correct).
- **Straggler fix**: `.orders-tool-btn--active` (globals.css:10269-10272, physically inside this same CSS block) `color: #4ade80` → `#15803d`. This was incorrectly assumed already-fixed during the Orders phase; `border-color: rgba(34,197,94,0.35)` stays as-is.
- Not touched: `.filter-badge` (`background:#22c55e; color:#020617`) — already the correct light-safe pairing (dark text on solid color chip).

### G. `orders/(dashboard)/catalog/page.tsx`

- Stat-card surface (line ~218): `rgba(15,23,42,0.8)` → light surface (same treatment as CRM/Orders stat cards: background → white, value text → dark).
- Stat value text (line ~242): `#e2e8f0` → `#0f172a`.
- Empty-state heading (line ~319): `text-[#e2e8f0]` → `text-[#0f172a]`.
- Not touched: stat label (`#64748b`), loading text (`#64748b`), empty-state icon/subtitle (`#475569`) — already legible on light.
- Not touched: `STATS_CARDS[].color` accent chip values (`#6366f1`/`#22c55e`/`#f59e0b`/`#06b6d4`) — icon-tint colors in colored circles, same precedent as CRM/Orders KPI icon tints.

### H. `ProductFormModal.tsx`

- Error banner text `#fca5a5` → `#dc2626` (background/border translucent tints unchanged).
- Not touched: `headerLeading` icon, already `text-indigo-600`.

### I. `DeleteProductModal.tsx`

- `headerLeading` icon `text-red-400` → `text-red-600`.
- Delete button text `#f87171` → `#dc2626` (background/border tints unchanged).
- Confirmation body text `#94a3b8` → `#64748b`.
- `<strong>` product name `#e2e8f0` → `#0f172a`.
- Error text `#f87171` → `#dc2626`.

### J. `ImportProductsModal.tsx`

- `headerLeading` icon `text-green-400` → `text-green-600`.
- "Template Excel" label `#e2e8f0` → `#0f172a`.
- "Baixar template" button text `#818cf8` → `#4f46e5`.
- Not touched: subtitle (`#64748b`); translucent indigo tint backgrounds/borders (decorative accent, matches `.catalog-hero-badge` pattern).

### K. `ProductCard.tsx`

- Placeholder icon (no image) `#334155` → `#94a3b8` (per decision: lighten, matches neutral placeholder-icon gray used elsewhere).
- No other inline literals — status pill/stock dot driven by shared `STATUS_COLOR` constant, see section M.

### L. `ProductListRow.tsx`

- Stock text: `isLowStock ? "#f59e0b" : "#94a3b8"` → `isLowStock ? "#a16207" : "#64748b"`.
- Not touched: placeholder icon `#475569` (already legible on light); price `#22c55e` (green accent).

### M. Shared `STATUS_COLOR` constant (`apps/web/src/types/product.ts`)

- `INACTIVE: "#94a3b8"` → `"#64748b"` (per decision: update for consistency with the muted-text mapping used everywhere else).
- Not touched: `ACTIVE` (`#22c55e`), `OUT_OF_STOCK` (`#f59e0b`... consistent with amber accent usage, kept as accent not muted text), `DISCONTINUED` (`#ef4444`) — these are semantic status accent colors, not muted text, and read fine on white already.

## Explicitly out of scope

- Support/Admin, Settings — future sub-phases.
- `AdvancedFilterPanel.tsx` itself has no inline color literals (fully class-driven) — no TSX changes needed, only the CSS in section F.
- Refactoring any inline styles into `.form-*` classes — value-only swaps only, consistent with CRM/Orders.
- Agent, Onboarding, Analytics, Overview, Inbox — untouched, still dark.

## Verification

- `pnpm --filter @whatsagent/web build` and `pnpm --filter @whatsagent/web lint` after each task.
- Manual check (deferred to the user): open `/catalog`, confirm hero (already light), stat cards, grid/list view toggle, product cards (including hover action overlay), product list rows, pagination, and empty state all read light and legible. Open the Import Products modal (drop zone, file preview table, result rows) and the Advanced Filter Panel (slide-in panel + scrim). Open Product Form, Delete Product modals.
