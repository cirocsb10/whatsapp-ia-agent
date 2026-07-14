# Backoffice Light Theme — Phase 2.4: Support

## Goal

Continue the backoffice light-theme retheme. Fourth sub-phase of Phase 2 (CRM → Orders → Catalog → **Support** → Admin → Settings). CRM, Orders, and Catalog are done and committed. This covers the Support page and its entire `.support-*` CSS block. Support and Admin were originally grouped as one phase in the plan; per user decision they are now split into two sub-phases — Admin (tenants + email/SMTP pages) will be brainstormed separately after this one ships.

## Why this phase is (mostly) self-contained

Support has no modal components — everything lives inline in one file, `apps/web/src/app/(dashboard)/support/page.tsx`. The `.support-stat-card` and `.support-info-card` families (plus their supporting classes `.support-stats-grid`, `.support-stat-icon`, `.support-stat-label`, `.support-stat-glow`, `.support-info-row`, `.support-info-card-header`, `.support-info-card-glow--indigo/--green`) were already retheme'd during the Orders shared-prep step and need no further work. Everything else in the `.support-*` CSS block (globals.css:3734-4489) is still dark and is not shared with any other page — safe to retheme without cross-phase impact.

## Scope

### A. Already light — confirmed, no work needed

`.support-stats-grid`, `.support-stat-card` (+ `::before`, `:hover`), `.support-stat-glow`, `.support-stat-icon`, `.support-stat-body`, `.support-stat-value` (`#0f172a`), `.support-stat-label` (`#64748b`), `.support-info-row`, `.support-info-card` (+ `:hover`), `.support-info-card-glow`, `.support-info-card-glow--indigo/--green`, `.support-info-card-header`, `.support-info-step` (`#64748b`), `.support-info-desc` (`#64748b`) — all already token-driven or already at target light values from the Orders shared-prep.

Also already light (no change): `.support-hero-sub` (`#64748b`), `.support-alert-sub` (`#64748b`), `.support-panel-title-meta` (`#64748b`), `.support-tab` base (`#64748b`), `.support-conv-preview` (`#64748b`), `.support-conv-time` (`#64748b`), `.support-live-pill` base (`#64748b`), `.support-live-dot` base (`#64748b`), `.support-refresh-btn` base (`#64748b`), `Bot`/indigo icon at page.tsx:402 (already `text-indigo-600`).

### B. Hero + live pill + refresh button (globals.css:3755-3845)

- `.support-hero-badge` color `#a5b4fc` → `#4f46e5`.
- `.support-hero-title` color `#f1f5f9` → `#0f172a`.
- `.support-live-pill` background `rgba(0,0,0,0.2)` → light surface tint.
- `.support-live-pill--on` color `#86efac` → `#15803d`.
- `.support-refresh-btn` background `rgba(0,0,0,0.2)` → light surface tint.
- `.support-refresh-btn:hover` color `#e2e8f0` → `#0f172a`.
- Not touched: `.support-hero` background gradient / border (decorative rgba tints on `var(--c-s1)`, same pattern as `.catalog-hero`'s accepted decorative gradient — fine on light); `.support-hero::before` gradient line (decorative); `.support-live-pill--on .support-live-dot` / `::after` (green `#22c55e`/`rgba(34,197,94,X)`, already `--c-green` family); `.support-refresh-btn:hover` border-color/background (`var(--c-s3)`/`var(--c-s2)`, tokenized).

### C. Alert banner (globals.css:3848-3915, page.tsx:155-156)

- `.support-alert-title` color `#f1f5f9` → `#0f172a`.
- `text-amber-400` (page.tsx:155, 156) → `text-amber-700` (×2, the `Zap`/`AlertCircle` icons).
- Not touched: `.support-alert`/`.support-alert--urgent` background gradients and borders (decorative rgba tints on `var(--c-s1)`, fine on light); `.support-alert-icon` background/border (amber tint, decorative); `.support-alert-cta` color `#052e16` (dark text on solid `var(--c-green)` button — accepted "dark text on solid color chip" precedent, matches `.filter-badge`); `.support-alert-cta:hover` background `#4ade80`/box-shadow (hover highlight on a solid button, decorative, not a text-legibility issue).

### D. Stats grid — already light (section A covers this fully, no additional work).

### E. Queue panel shell (globals.css:4001-4052)

- `.support-panel` background `rgba(12,21,38,0.7)` → light surface (`#ffffff`).
- `.support-panel-header` border-bottom `rgba(26,45,71,0.8)` → `var(--c-border)`-equivalent.
- `.support-panel-title-text` color `#f1f5f9` → `#0f172a`.
- `text-amber-400` (page.tsx:213, the `LifeBuoy` icon) → `text-amber-700`.
- Not touched: `.support-panel-header` background gradient (decorative amber tint, fine); `.support-panel-title-icon` background/border (amber tint, decorative).

### F. Search + tabs (globals.css:4067-4152)

- `.support-search-input` color `#e2e8f0` → `#0f172a`; background `rgba(0,0,0,0.25)` → light surface.
- `.support-search-input:focus` background `rgba(0,0,0,0.35)` → light surface (darker tint than resting state, same relative relationship).
- `.support-tabs` background `rgba(0,0,0,0.25)` → light surface tint.
- `.support-tab:hover` color `#cbd5e1` → `#0f172a`; background `rgba(255,255,255,0.04)` → dark-tint-on-light (`rgba(15,23,42,0.04)`).
- `.support-tab-active` color `#f1f5f9` → `#0f172a`; box-shadow `rgba(0,0,0,0.2)` → lighter (`rgba(15,23,42,0.12)`, matching the established dropdown/card shadow recipe).
- `.support-tab-count` background `rgba(255,255,255,0.06)` → light tint (`rgba(15,23,42,0.06)`); color `#94a3b8` → `#64748b`.
- `.support-tab-count-active` color `#fbbf24` → `#a16207`.
- Not touched: `.support-search-icon`/`::placeholder` (`#475569`, already legible on light); `.support-search-input:hover`/`:focus` border-color (`var(--c-s3)`/`rgba(99,102,241,0.45)`, tokenized/accent); `.support-tab-count-active` background (`rgba(245,158,11,0.2)`, amber tint, decorative).

### G. Empty state (globals.css:4155-4212, page.tsx:274-277)

- `.support-empty-icon` box-shadow `rgba(0,0,0,0.15)` → lighter (`rgba(15,23,42,0.1)`).
- `.support-empty-title` color `#e2e8f0` → `#0f172a`.
- `.support-empty-link` color `#818cf8` → `#4f46e5`; `:hover` color `#a5b4fc` → `#4f46e5` (same target — hover no longer needs a distinct lighter shade since the base is already the target indigo).
- `text-slate-500` (page.tsx:274, 276, 277 — `PhoneCall`/`CheckCircle2`/`MessageSquare` icons) — already the correct muted value, **no change needed**.
- Not touched: `.support-empty-glow` (decorative radial gradient, fine); `.support-empty-icon` background/border (`var(--c-s2)`/`var(--c-border)`, tokenized).

### H. Skeleton + conversation rows (globals.css:4220-4382)

- `.support-skeleton-row` border-bottom `rgba(26,45,71,0.5)` → `var(--c-border)`-equivalent.
- `.support-conv-row` border-bottom `rgba(26,45,71,0.55)` → `var(--c-border)`-equivalent.
- `.support-conv-row:hover` background `rgba(255,255,255,0.025)` → dark-tint-on-light (`rgba(15,23,42,0.025)`).
- `.support-conv-row--clickable:hover .support-conv-chevron` color `#a5b4fc` → `#4f46e5`.
- `.support-conv-row--urgent:hover` background gradient stop `rgba(255,255,255,0.02)` → dark-tint-on-light (`rgba(15,23,42,0.02)`).
- `.support-conv-name` color `#f1f5f9` → `#0f172a`.
- `.support-urgency-tag` color `#fbbf24` → `#a16207`.
- `.support-conv-aside--action` border-left `rgba(26,45,71,0.65)` → `var(--c-border)`-equivalent.
- Not touched: `.support-conv-row--clickable:hover` background (`rgba(99,102,241,0.04)`, indigo tint, decorative); `.support-conv-row--urgent` background gradient (amber tint, decorative); `.support-conv-accent` (no literal, inline `style` uses semantic `accent`/`#f59e0b` — see below); `.support-urgency-tag` background/border (amber tint, decorative); `.support-conv-phone`/`.support-conv-chevron` (`#475569`, already legible on light).
- **page.tsx:328** — `style={{ background: isUrgent ? "#f59e0b" : accent }}` on `.support-conv-accent`: `accent` comes from a per-conversation hash-based palette (`accentFor()`), not a dark-theme literal — decorative-fine, no change. `#f59e0b` (amber, urgent state) is a saturated accent-bar color at full opacity, not body text — matches the precedent of leaving `STATS_CARDS[].color`-style accent values alone; **no change needed**.

### I. Attend button (globals.css:4384-4411)

- `.support-attend-btn` color `#052e16` — dark text on solid `var(--c-green)` button, same accepted precedent as `.support-alert-cta` — **no change needed**.
- Not touched: `:hover` background `#4ade80`/box-shadow, `:focus-visible` outline — hover/focus highlight on a solid button, decorative.

### J. Info cards — already light (section A covers all color-bearing rules).

- `text-green-400` (page.tsx:417, the `User` icon) → `text-green-600`.

## Explicitly out of scope

- Admin (tenants, email/SMTP pages, `.super-admin-*` CSS, shared `.settings-input` cross-dependency with Settings) — its own future sub-phase.
- Settings — future sub-phase.
- `loading.tsx` — uses the shared `.shimmer` class only, no page-specific dark literals; no work needed.
- `KpiCard`/`.kpi` CSS — not used by Support; out of scope entirely for this phase.
- Refactoring any inline styles into `.form-*` classes — value-only swaps only, consistent with every prior sub-phase.
- Agent, Onboarding, Analytics, Overview, Inbox — untouched, still dark.

## Verification

- `pnpm --filter @whatsagent/web build` and `pnpm --filter @whatsagent/web lint` after each task.
- Manual check (deferred to the user — no browser tool available to the controller): open `/support`, confirm hero, live pill, refresh button, alert banner (both normal and urgent states — may need to simulate pending handoffs), stats grid (already light, just visually confirm), queue panel (search, tabs, tab counts), empty state (all three tab variants), conversation rows (normal, urgent, clickable/hover states), attend button, and info cards all read light and legible.
