# Backoffice Light Theme — Phase 2.3 Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme the Catalog (products) page, its CSS (product card/list, pagination, import modal, filter panel), and its five React components from dark to light, completing Phase 2.3 of the backoffice light-theme migration.

**Architecture:** Value-only color swaps in existing CSS rules and inline `style={{}}` objects — no structural changes, no new classes, no refactor into `.form-*` primitives. Every change is confirmed against the design spec at `docs/superpowers/specs/2026-07-14-backoffice-light-theme-phase2-catalog-design.md`.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS v4, hand-written CSS in `apps/web/src/app/globals.css`.

## Global Constraints

- Value-only swaps only — never refactor inline styles into `.form-*` CSS classes, even where structurally tempting.
- Established color mappings (copy exactly):
  - Green accent/success text: `#4ade80`/`#86efac` → `#15803d`
  - Indigo accent text: `#818cf8`/`#a5b4fc` → `#4f46e5`
  - Red/danger text: `#f87171`/`#fca5a5` → `#dc2626`
  - Amber/warning text: `#f59e0b` → `#a16207`
  - Muted body text: `#94a3b8` → `#64748b`
  - Near-white heading/value text: `#e2e8f0`/`#f1f5f9`/`#cbd5e1` → `#0f172a`
  - Dark surfaces: `rgba(15,23,42,X)`/`rgba(12,21,38,X)`/`rgba(30,41,59,X)`/`rgba(2,6,23,X)`/`#0f172a` → light equivalents (white/`var(--c-s1)`/light tint per context)
  - Dark borders: `rgba(51,65,85,X)`/`rgba(148,163,184,X)` → `var(--c-border)`-equivalent
  - Dark-theme hover overlays (`rgba(255,255,255,X)` lighten-on-dark) → `rgba(15,23,42,X)` darken-on-light equivalent
  - Tailwind `text-{color}-400` → `text-{color}-600`
- Decision: product-card hover action-overlay and filter-panel scrim both **lighten** (do not keep dark, diverging intentionally from `.modal-overlay`'s dark-scrim precedent — user-approved).
- Decision: `STATUS_COLOR.INACTIVE` (shared constant) updates `#94a3b8` → `#64748b`.
- Decision: `ProductCard.tsx` placeholder icon `#334155` → `#94a3b8`.
- Decision: `.orders-tool-btn--active` straggler fix `#4ade80` → `#15803d` included in this phase.
- Verify with `pnpm --filter @whatsagent/web build` and `pnpm --filter @whatsagent/web lint` after each task.

---

### Task 1: Product Card CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:9843-9939`

**Interfaces:**
- Consumes: none (pure CSS value edit).
- Produces: light-themed `.product-card*` rules consumed by `ProductCard.tsx` (Task 6).

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:9843-9939):
```css
.product-card {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid var(--c-border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.product-card:hover {
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.15);
}
.product-card-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}
.product-card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  transition: transform 0.25s ease, filter 0.25s ease;
}
.product-card:hover .product-card-image img {
  transform: scale(1.03);
  filter: brightness(0.85);
}
.product-card-action-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.72);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(148, 163, 184, 0.15);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
  z-index: 2;
}
.product-card:hover .product-card-action-overlay,
.product-card:focus-within .product-card-action-overlay {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}
.product-card-action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #cbd5e1;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}
.product-card-action-icon:hover {
  background: rgba(99, 102, 241, 0.2);
  color: #a5b4fc;
  transform: scale(1.08);
}
.product-card-action-icon.danger:hover {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}
.product-card-action-divider {
  width: 1px;
  height: 16px;
  background: rgba(148, 163, 184, 0.2);
  flex-shrink: 0;
}
.product-card-body { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.product-card-name { font-size: 13px; font-weight: 600; color: #e2e8f0; line-height: 1.3; }
.product-card-sku { font-size: 10px; color: #64748b; font-family: monospace; }
.product-card-price { font-size: 14px; font-weight: 700; color: #22c55e; }
.product-card-compare { font-size: 11px; color: #64748b; text-decoration: line-through; margin-left: 4px; }
.product-card-stock { font-size: 11px; color: #94a3b8; }
.product-card-stock.low { color: #f59e0b; }
```

After:
```css
.product-card {
  background: #ffffff;
  border: 1px solid var(--c-border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.product-card:hover {
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.15);
}
.product-card-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}
.product-card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  transition: transform 0.25s ease, filter 0.25s ease;
}
.product-card:hover .product-card-image img {
  transform: scale(1.03);
  filter: brightness(0.85);
}
.product-card-action-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border: 1px solid var(--c-border);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
  z-index: 2;
}
.product-card:hover .product-card-action-overlay,
.product-card:focus-within .product-card-action-overlay {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}
.product-card-action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}
.product-card-action-icon:hover {
  background: rgba(99, 102, 241, 0.2);
  color: #4f46e5;
  transform: scale(1.08);
}
.product-card-action-icon.danger:hover {
  background: rgba(239, 68, 68, 0.18);
  color: #dc2626;
}
.product-card-action-divider {
  width: 1px;
  height: 16px;
  background: rgba(148, 163, 184, 0.3);
  flex-shrink: 0;
}
.product-card-body { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.product-card-name { font-size: 13px; font-weight: 600; color: #0f172a; line-height: 1.3; }
.product-card-sku { font-size: 10px; color: #64748b; font-family: monospace; }
.product-card-price { font-size: 14px; font-weight: 700; color: #22c55e; }
.product-card-compare { font-size: 11px; color: #64748b; text-decoration: line-through; margin-left: 4px; }
.product-card-stock { font-size: 11px; color: #64748b; }
.product-card-stock.low { color: #a16207; }
```

- [ ] **Step 2: Verify**

Run: `grep -n "rgba(15, 23, 42, 0.8)\|rgba(30, 41, 59, 0.6)\|rgba(2, 6, 23, 0.72)\|#e2e8f0\|#cbd5e1\|#a5b4fc\|#fca5a5\|#f59e0b" apps/web/src/app/globals.css | sed -n '1,5p'` restricted to the 9843-9939 range (or open the file at those lines) — confirm none of the old dark literals remain in `.product-card*` rules.

- [ ] **Step 3: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme product card CSS for light theme"
```

---

### Task 2: Product List Row CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:9950-9998`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.product-list-*` rules consumed by `ProductListRow.tsx` (Task 7).

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:9950-9998):
```css
/* ── Product List Row ─────────────────────────────────── */
.product-list-row {
  display: grid;
  grid-template-columns: 40px 1fr 120px 100px 80px 100px 80px;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--c-border);
  transition: background 0.1s;
}
.product-list-row:hover { background: rgba(15, 23, 42, 0.5); }
.product-list-header {
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.product-list-thumb {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: rgba(30, 41, 59, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}
.product-list-thumb img { object-fit: cover; border-radius: 6px; }
.product-list-name { font-size: 13px; font-weight: 500; color: #e2e8f0; }
.product-list-sku { font-size: 10px; color: #64748b; font-family: monospace; margin-top: 2px; }
.product-list-actions { display: flex; gap: 4px; }
.product-list-action-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid var(--c-border);
  background: transparent;
  color: #64748b;
  transition: all 0.15s;
}
.product-list-action-btn:hover { background: rgba(99,102,241,0.1); color: #818cf8; border-color: rgba(99,102,241,0.3); }
.product-list-action-btn.danger:hover { background: rgba(239,68,68,0.1); color: #f87171; border-color: rgba(239,68,68,0.3); }
```

After:
```css
/* ── Product List Row ─────────────────────────────────── */
.product-list-row {
  display: grid;
  grid-template-columns: 40px 1fr 120px 100px 80px 100px 80px;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--c-border);
  transition: background 0.1s;
}
.product-list-row:hover { background: rgba(15, 23, 42, 0.03); }
.product-list-header {
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.product-list-thumb {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}
.product-list-thumb img { object-fit: cover; border-radius: 6px; }
.product-list-name { font-size: 13px; font-weight: 500; color: #0f172a; }
.product-list-sku { font-size: 10px; color: #64748b; font-family: monospace; margin-top: 2px; }
.product-list-actions { display: flex; gap: 4px; }
.product-list-action-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid var(--c-border);
  background: transparent;
  color: #64748b;
  transition: all 0.15s;
}
.product-list-action-btn:hover { background: rgba(99,102,241,0.1); color: #4f46e5; border-color: rgba(99,102,241,0.3); }
.product-list-action-btn.danger:hover { background: rgba(239,68,68,0.1); color: #dc2626; border-color: rgba(239,68,68,0.3); }
```

- [ ] **Step 2: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme product list row CSS for light theme"
```

---

### Task 3: Catalog Grid / Pagination CSS + `.orders-tool-btn--active` straggler fix

**Files:**
- Modify: `apps/web/src/app/globals.css:10021-10044` (pagination)
- Modify: `apps/web/src/app/globals.css:10269-10272` (`.orders-tool-btn--active` straggler)

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.catalog-page-btn*` and corrected `.orders-tool-btn--active`.

- [ ] **Step 1: Apply the pagination CSS edits**

Before (globals.css:10021-10044):
```css
.catalog-page-btn {
  height: 28px;
  min-width: 28px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--c-border);
  background: transparent;
  color: #94a3b8;
  transition: all 0.15s;
}
.catalog-page-btn:hover {
  background: rgba(34,197,94,0.08);
  color: #4ade80;
  border-color: rgba(34,197,94,0.2);
}
.catalog-page-btn.active {
  background: rgba(34,197,94,0.1);
  color: #4ade80;
  border-color: rgba(34,197,94,0.35);
}
.catalog-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
```

After:
```css
.catalog-page-btn {
  height: 28px;
  min-width: 28px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--c-border);
  background: transparent;
  color: #64748b;
  transition: all 0.15s;
}
.catalog-page-btn:hover {
  background: rgba(34,197,94,0.08);
  color: #15803d;
  border-color: rgba(34,197,94,0.2);
}
.catalog-page-btn.active {
  background: rgba(34,197,94,0.1);
  color: #15803d;
  border-color: rgba(34,197,94,0.35);
}
.catalog-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 2: Apply the `.orders-tool-btn--active` straggler fix**

Before (globals.css:10269-10272):
```css
.orders-tool-btn--active {
  border-color: rgba(34, 197, 94, 0.35) !important;
  color: #4ade80 !important;
}
```

After:
```css
.orders-tool-btn--active {
  border-color: rgba(34, 197, 94, 0.35) !important;
  color: #15803d !important;
}
```

- [ ] **Step 3: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme catalog pagination CSS and fix orders-tool-btn--active straggler"
```

---

### Task 4: Import Products Modal CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:10059-10182`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.import-*` rules consumed by `ImportProductsModal.tsx` (Task 9).

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:10059-10182):
```css
.import-drop-zone-icon { margin-bottom: 8px; color: #64748b; }
.import-drop-zone-title { font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 4px; }
.import-drop-zone-subtitle { font-size: 11px; color: #64748b; }
.import-file-selected {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(34, 197, 94, 0.07);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 8px;
  font-size: 12px;
  color: #86efac;
}
.import-result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
}
.import-result-row.success { background: rgba(34,197,94,0.07); color: #86efac; }
.import-result-row.error { background: rgba(239,68,68,0.07); color: #fca5a5; }
.import-file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.import-file-remove {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  font-size: 16px;
  line-height: 1;
}
.import-file-remove:disabled { opacity: 0.4; cursor: not-allowed; }
.import-preview-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #94a3b8;
}
.import-preview-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 12px;
  color: #94a3b8;
}
.import-preview-summary-valid { color: #86efac; font-weight: 600; }
.import-preview-summary-invalid { color: #fca5a5; font-weight: 600; }
.import-preview-table-wrap {
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--c-border);
  border-radius: 8px;
}
.import-preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.import-preview-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: left;
  padding: 8px 10px;
  background: rgba(15, 23, 42, 0.95);
  color: #64748b;
  font-weight: 600;
  border-bottom: 1px solid var(--c-border);
  white-space: nowrap;
}
.import-preview-table td {
  padding: 7px 10px;
  color: #cbd5e1;
  border-bottom: 1px solid rgba(51, 65, 85, 0.35);
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.import-preview-table tr.invalid td { background: rgba(239, 68, 68, 0.05); }
.import-preview-table tr:last-child td { border-bottom: none; }
.import-preview-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}
.import-preview-badge.valid {
  background: rgba(34, 197, 94, 0.12);
  color: #86efac;
}
.import-preview-badge.invalid {
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
  cursor: help;
}
.import-preview-errors {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.import-preview-error-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11px;
  color: #fca5a5;
}
.import-preview-error-more {
  font-size: 11px;
  color: #94a3b8;
  padding-left: 20px;
}
```

After:
```css
.import-drop-zone-icon { margin-bottom: 8px; color: #64748b; }
.import-drop-zone-title { font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 4px; }
.import-drop-zone-subtitle { font-size: 11px; color: #64748b; }
.import-file-selected {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(34, 197, 94, 0.07);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 8px;
  font-size: 12px;
  color: #15803d;
}
.import-result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
}
.import-result-row.success { background: rgba(34,197,94,0.07); color: #15803d; }
.import-result-row.error { background: rgba(239,68,68,0.07); color: #dc2626; }
.import-file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.import-file-remove {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  font-size: 16px;
  line-height: 1;
}
.import-file-remove:disabled { opacity: 0.4; cursor: not-allowed; }
.import-preview-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
}
.import-preview-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 12px;
  color: #64748b;
}
.import-preview-summary-valid { color: #15803d; font-weight: 600; }
.import-preview-summary-invalid { color: #dc2626; font-weight: 600; }
.import-preview-table-wrap {
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--c-border);
  border-radius: 8px;
}
.import-preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.import-preview-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: left;
  padding: 8px 10px;
  background: #f8fafc;
  color: #64748b;
  font-weight: 600;
  border-bottom: 1px solid var(--c-border);
  white-space: nowrap;
}
.import-preview-table td {
  padding: 7px 10px;
  color: #0f172a;
  border-bottom: 1px solid var(--c-border);
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.import-preview-table tr.invalid td { background: rgba(239, 68, 68, 0.05); }
.import-preview-table tr:last-child td { border-bottom: none; }
.import-preview-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}
.import-preview-badge.valid {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}
.import-preview-badge.invalid {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  cursor: help;
}
.import-preview-errors {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.import-preview-error-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11px;
  color: #dc2626;
}
.import-preview-error-more {
  font-size: 11px;
  color: #64748b;
  padding-left: 20px;
}
```

- [ ] **Step 2: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme import products modal CSS for light theme"
```

---

### Task 5: Advanced Filter Panel CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:10185-10242`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.filter-panel*` rules consumed by `AdvancedFilterPanel.tsx` (no TSX changes needed for that component per spec section F).

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:10185-10242):
```css
.filter-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(2, 6, 23, 0.55);
  backdrop-filter: blur(4px);
  animation: filter-panel-overlay-in 200ms ease-out both;
}
@keyframes filter-panel-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.filter-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(320px, 100vw);
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.98);
  border-left: 1px solid var(--c-border);
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.35);
  animation: filter-panel-slide-in 240ms ease-out both;
}
@keyframes filter-panel-slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
.filter-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--c-border);
}
.filter-panel-title {
  font-size: 15px;
  font-weight: 700;
  color: #e2e8f0;
}
.filter-panel-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--c-border);
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
}
.filter-panel-close:hover {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.05);
}
```

After:
```css
.filter-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(15, 23, 42, 0.25);
  backdrop-filter: blur(4px);
  animation: filter-panel-overlay-in 200ms ease-out both;
}
@keyframes filter-panel-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.filter-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(320px, 100vw);
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-left: 1px solid var(--c-border);
  box-shadow: -8px 0 32px rgba(15, 23, 42, 0.16);
  animation: filter-panel-slide-in 240ms ease-out both;
}
@keyframes filter-panel-slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
.filter-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--c-border);
}
.filter-panel-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}
.filter-panel-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--c-border);
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
}
.filter-panel-close:hover {
  color: #0f172a;
  background: rgba(15, 23, 42, 0.05);
}
```

- [ ] **Step 2: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme advanced filter panel CSS for light theme"
```

---

### Task 6: `catalog/page.tsx` — stat cards and empty state

**Files:**
- Modify: `apps/web/src/app/(dashboard)/catalog/page.tsx:218,242,245,319`

**Interfaces:**
- Consumes: `.product-card*` CSS from Task 1 not directly used here — this task only touches inline styles and Tailwind arbitrary classes local to `page.tsx`.
- Produces: no new interfaces.

- [ ] **Step 1: Apply the stat card background fix**

Before (page.tsx, stat card container, line 218):
```tsx
              style={{
                background: "rgba(15,23,42,0.8)",
                border: "1px solid var(--c-border)",
                borderRadius: 10,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
```

After:
```tsx
              style={{
                background: "#ffffff",
                border: "1px solid var(--c-border)",
                borderRadius: 10,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
```

- [ ] **Step 2: Apply the stat value text fix**

Before (page.tsx, line 242):
```tsx
                <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>
```

After:
```tsx
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
```

- [ ] **Step 3: Apply the empty-state heading fix**

Before (page.tsx, line 319):
```tsx
              <p className="text-[15px] font-semibold text-[#e2e8f0]">
```

After:
```tsx
              <p className="text-[15px] font-semibold text-[#0f172a]">
```

- [ ] **Step 4: Confirm no change needed at lines 245, 312, 317, 324**

These already hold `#64748b` (stat label, loading text) and `#475569` (empty-state icon/subtitle) — both are already legible on light and are explicitly out of scope per the design spec. Do not edit them.

- [ ] **Step 5: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(dashboard)/catalog/page.tsx"
git commit -m "fix(web): retheme catalog page stat cards and empty state for light theme"
```

---

### Task 7: `ProductFormModal.tsx` and `DeleteProductModal.tsx`

**Files:**
- Modify: `apps/web/src/components/catalog/ProductFormModal.tsx:251`
- Modify: `apps/web/src/components/catalog/DeleteProductModal.tsx` (full file, 5 changes)

**Interfaces:**
- Consumes: `Product` type from `@/types/product` (unchanged).
- Produces: no new interfaces.

- [ ] **Step 1: Fix `ProductFormModal.tsx` error banner text**

Before (ProductFormModal.tsx:243-257):
```tsx
        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8,
              color: "#fca5a5",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
```

After:
```tsx
        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8,
              color: "#dc2626",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
```

- [ ] **Step 2: Replace `DeleteProductModal.tsx` return statement**

Before (DeleteProductModal.tsx:34-78, full return statement):
```tsx
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Excluir produto"
      subtitle="Esta ação não pode ser desfeita"
      size="sm"
      headerLeading={<Trash2 className="w-5 h-5 text-red-400" />}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" type="button">
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
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
              cursor: "pointer",
            }}
          >
            {deleting ? "Excluindo…" : "Excluir"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
        Tem certeza que deseja excluir{" "}
        <strong style={{ color: "#e2e8f0" }}>{product?.name}</strong>?
        Todos os dados do produto serão removidos permanentemente.
      </p>
      {error && (
        <p style={{ marginTop: 10, fontSize: 12, color: "#f87171" }}>{error}</p>
      )}
    </Modal>
  );
}
```

After:
```tsx
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Excluir produto"
      subtitle="Esta ação não pode ser desfeita"
      size="sm"
      headerLeading={<Trash2 className="w-5 h-5 text-red-600" />}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" type="button">
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
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
              cursor: "pointer",
            }}
          >
            {deleting ? "Excluindo…" : "Excluir"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
        Tem certeza que deseja excluir{" "}
        <strong style={{ color: "#0f172a" }}>{product?.name}</strong>?
        Todos os dados do produto serão removidos permanentemente.
      </p>
      {error && (
        <p style={{ marginTop: 10, fontSize: 12, color: "#dc2626" }}>{error}</p>
      )}
    </Modal>
  );
}
```

- [ ] **Step 3: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/catalog/ProductFormModal.tsx apps/web/src/components/catalog/DeleteProductModal.tsx
git commit -m "fix(web): retheme ProductFormModal and DeleteProductModal for light theme"
```

---

### Task 8: `ImportProductsModal.tsx`

**Files:**
- Modify: `apps/web/src/components/catalog/ImportProductsModal.tsx:202,239,257`

**Interfaces:**
- Consumes: `.import-*` CSS classes from Task 4.
- Produces: no new interfaces.

- [ ] **Step 1: Fix the header icon class**

Before (ImportProductsModal.tsx:202):
```tsx
      headerLeading={<FileSpreadsheet className="w-5 h-5 text-green-400" />}
```

After:
```tsx
      headerLeading={<FileSpreadsheet className="w-5 h-5 text-green-600" />}
```

- [ ] **Step 2: Fix the "Template Excel" label text color**

Before (ImportProductsModal.tsx:239):
```tsx
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Template Excel</div>
```

After:
```tsx
            <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>Template Excel</div>
```

- [ ] **Step 3: Fix the "Baixar template" button text color**

Before (ImportProductsModal.tsx:244-264):
```tsx
          <button
            onClick={downloadTemplate}
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 30,
              padding: "0 12px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              background: "rgba(99,102,241,0.12)",
              color: "#818cf8",
              border: "1px solid rgba(99,102,241,0.25)",
              cursor: "pointer",
            }}
          >
            <Download className="w-3.5 h-3.5" />
            Baixar template
          </button>
```

After:
```tsx
          <button
            onClick={downloadTemplate}
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 30,
              padding: "0 12px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              background: "rgba(99,102,241,0.12)",
              color: "#4f46e5",
              border: "1px solid rgba(99,102,241,0.25)",
              cursor: "pointer",
            }}
          >
            <Download className="w-3.5 h-3.5" />
            Baixar template
          </button>
```

- [ ] **Step 4: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/catalog/ImportProductsModal.tsx
git commit -m "fix(web): retheme ImportProductsModal for light theme"
```

---

### Task 9: `ProductCard.tsx`, `ProductListRow.tsx`, and shared `STATUS_COLOR`

**Files:**
- Modify: `apps/web/src/types/product.ts:60`
- Modify: `apps/web/src/components/catalog/ProductCard.tsx:36`
- Modify: `apps/web/src/components/catalog/ProductListRow.tsx:35,53`

**Interfaces:**
- Consumes: `.product-card*`/`.product-list-*` CSS from Tasks 1-2.
- Produces: updated `STATUS_COLOR.INACTIVE` value consumed by both components (already consumed via the existing import — no signature change).

- [ ] **Step 1: Fix the shared `STATUS_COLOR` constant**

Before (types/product.ts:58-63):
```ts
export const STATUS_COLOR: Record<ProductStatus, string> = {
  ACTIVE: "#22c55e",
  INACTIVE: "#94a3b8",
  OUT_OF_STOCK: "#f59e0b",
  DISCONTINUED: "#ef4444",
};
```

After:
```ts
export const STATUS_COLOR: Record<ProductStatus, string> = {
  ACTIVE: "#22c55e",
  INACTIVE: "#64748b",
  OUT_OF_STOCK: "#f59e0b",
  DISCONTINUED: "#ef4444",
};
```

- [ ] **Step 2: Fix `ProductCard.tsx` placeholder icon**

Before (ProductCard.tsx:36):
```tsx
          <Package className="w-8 h-8" style={{ color: "#334155" }} />
```

After:
```tsx
          <Package className="w-8 h-8" style={{ color: "#94a3b8" }} />
```

- [ ] **Step 3: Fix `ProductListRow.tsx` stock text color**

Before (ProductListRow.tsx:50-55):
```tsx
      <div
        style={{
          fontSize: 12,
          color: isLowStock ? "#f59e0b" : "#94a3b8",
        }}
      >
```

After:
```tsx
      <div
        style={{
          fontSize: 12,
          color: isLowStock ? "#a16207" : "#64748b",
        }}
      >
```

- [ ] **Step 4: Confirm no change needed at `ProductListRow.tsx:35`**

`style={{ color: "#475569" }}` on the placeholder icon is already legible on light and is explicitly out of scope per the design spec — do not edit it.

- [ ] **Step 5: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/types/product.ts apps/web/src/components/catalog/ProductCard.tsx apps/web/src/components/catalog/ProductListRow.tsx
git commit -m "fix(web): retheme ProductCard, ProductListRow, and shared STATUS_COLOR for light theme"
```

---

### Task 10: Verification sweep

**Files:** none modified — read-only verification task.

- [ ] **Step 1: Grep for remaining dark literals in the Catalog scope**

Run:
```bash
grep -n "rgba(15, 23, 42\|rgba(30, 41, 59\|rgba(2, 6, 23\|#e2e8f0\|#cbd5e1\|#a5b4fc\|#fca5a5\|#818cf8\|#86efac\|#4ade80\|#f59e0b\|#94a3b8\|#334155" apps/web/src/app/globals.css | grep -E "98[4-9][0-9]|99[0-9][0-9]|100[0-9][0-9]|101[0-9][0-9]"
```
Expected: no matches within the `.product-*`/`.catalog-page-btn`/`.import-*`/`.filter-panel*` line ranges (9843-10272). Some matches outside this range (other still-dark pages) are expected and fine.

Run:
```bash
grep -n "#e2e8f0\|#f87171\|#fca5a5\|#818cf8\|#334155\|text-green-400\|text-red-400\|text-indigo-400" "apps/web/src/app/(dashboard)/catalog/page.tsx" apps/web/src/components/catalog/*.tsx apps/web/src/types/product.ts
```
Expected: no matches.

- [ ] **Step 2: Full build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed cleanly.

- [ ] **Step 3: Update the progress ledger**

Append to `.superpowers/sdd/progress.md`:
```
Phase 2.3 (Catalog): Tasks 1-9 complete, verification sweep clean (grep + build + lint).
```

- [ ] **Step 4: No commit for this task**

This is a verification-only task; nothing to commit unless Step 1 finds a gap, in which case fix it under the relevant earlier task's commit message pattern before re-running Steps 1-2.
