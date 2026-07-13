# Backoffice Light Theme — Phase 1: Tokens & Shell

## Goal

Replace the dark OLED theme of the authenticated backoffice (`apps/web`, route groups `(dashboard)` and `(admin)`) with a light theme matching the visual language of `D:\Projetos\clit\prevconsulta\apps\backoffice`: white surfaces, `slate-200` borders, flat cards with soft shadows instead of glassmorphism/glow, `Outfit` typography. Keep the existing green (`#22c55e`) / indigo (`#6366f1`) accent colors — no blue re-theme.

The public landing page (`lp-*` classes in `globals.css`) is explicitly **out of scope** and stays on the current dark theme.

This is Phase 1 of a multi-phase effort. It covers the design-token layer and shared shell/primitive components that every other page depends on. Feature-specific pages (KPI/analytics cards, catalog product cards, CRM Kanban, inbox/chat, agent/settings widgets) are deliberately deferred to later phases so each phase stays reviewable and independently committable.

## Why this scope split

`apps/web/src/app/globals.css` is ~10,300 lines of hand-written `@layer components` classes (not Tailwind utility soup) — nearly every screen is styled through named classes like `.nav-item`, `.modal-*`, `.form-input`, `.kpi`, `.product-card`, `.lp-*`. Retheming everything in one pass would be unreviewable and risks inconsistency. Phase 1 targets only the classes shared by the app shell (sidebar, header, generic modal, buttons, form primitives, tags) because:
- They're used on literally every screen, so fixing them first has the highest visual leverage per line changed.
- They're a small, self-contained slice (~500 CSS rules across a few marked sections) that can be fully read, reasoned about, and verified in one sitting.
- Later phases (catalog, CRM, analytics, chat) can reuse the same color-mapping recipe established here.

## Color token remap

In `:root` (`apps/web/src/app/globals.css`):

| Token | Old (dark) | New (light) | Use |
|---|---|---|---|
| `--c-base` | `#070d1a` | `#f8fafc` | page background |
| `--c-s1` | `#0c1526` | `#ffffff` | card/surface background |
| `--c-s2` | `#111e32` | `#f8fafc` | hover surface |
| `--c-s3` | `#1a2d47` | `#cbd5e1` | stronger border/divider |
| `--c-border` | `#1a2d47` | `#e2e8f0` | default border |
| `--c-text` | `#e2e8f0` | `#0f172a` | primary text |
| `--c-muted` | `#64748b` | `#64748b` (unchanged) | secondary text, works on both |
| `--c-subtle` | `#334155` | `#94a3b8` | uppercase labels/section titles |
| `--c-green` | `#22c55e` | unchanged | accent (CTA, success) |
| `--c-indigo` | `#6366f1` | unchanged | accent (AI/brand) |

`html { color-scheme: dark; }` becomes `color-scheme: light;`.

### Literal-value mapping recipe (applied wherever hardcoded, not via a var)

- Dark panel backgrounds `rgba(12,21,38,X)` / `rgba(17,30,50,X)` → `#ffffff` (or `rgba(255,255,255,X)`) with a `1px solid var(--c-border)`.
- Light-on-dark heading colors `#f1f5f9` / `#e2e8f0` (used as literal, e.g. `.modal-title`, `.dashboard-topbar-heading`) → `#0f172a` / `#1e293b`.
- Hover overlays `rgba(255,255,255,0.04–0.08)` (white-tint-on-dark) → `rgba(15,23,42,0.04–0.06)` (dark-tint-on-light).
- Modal/dropdown overlay backdrop `rgba(7,13,26,0.75)` → `rgba(15,23,42,0.35)` (matches `ConfirmModal`'s `bg-black/45` pattern already used in PrevConsulta).
- Heavy dark shadows/`inset` glow rings → flat `box-shadow: 0 1px 2px rgba(15,23,42,0.04)` for resting cards, `0 20px 48px rgba(15,23,42,0.16)` for elevated modals/dropdowns — no `backdrop-filter: blur` glass effect.
- Accent rgba tints (`rgba(99,102,241,X)` indigo, `rgba(34,197,94,X)` green) stay as-is; they already read fine on a light background at the same opacities used for badges/active states in PrevConsulta.

## Font

- `apps/web/src/app/layout.tsx`: replace the `Plus_Jakarta_Sans` import/usage from `next/font/google` with `Outfit` (keep `Fraunces` untouched — it's landing-page-only, out of scope).
- `apps/web/tailwind.config.ts`: `fontFamily.sans` → `["Outfit", "sans-serif"]`.
- `apps/web/src/app/globals.css`: remove the stale, currently-unused `@import url(...Inter...)` and the `body { font-family: 'Inter' }` rule in `@layer base` (dead weight — `font-sans` utility from Tailwind already wins in the cascade; CLAUDE.md's own convention list should also get the "Inter" mention corrected to Outfit for the backoffice, left as a follow-up doc note, not part of this code change).

## Components in scope

1. **`Sidebar.tsx`** (`apps/web/src/components/layout/Sidebar.tsx`) — drop hardcoded `bg-[#070d1a]`, `border-[#1a2d47]` inline classes; sidebar becomes white with `border-r border-slate-200`. Active nav item gets a tinted background (indigo-50-style) instead of `rgba(255,255,255,0.07)` + green left-bar; keep the left accent bar (green) since that's a nice existing affordance, just recolor the background tint to something like `rgba(99,102,241,0.08)` on light. Status footer dot/text stays, colors adjusted for light bg.
2. **`Header.tsx`** (`apps/web/src/components/layout/Header.tsx`) — no structural change; relies entirely on the CSS classes below, so recoloring those classes is sufficient.
3. **CSS classes** in `globals.css`, restyled to light per the recipe above:
   - Shell chrome: `.nav-item`, `.nav-item-admin`, `.section-title`, `.app-shell-topbar`, `.brand-logo`, `.brand-name`, `.brand-name-accent`, `.sidebar-brand*`, `.dashboard-topbar*`
   - Header widgets: `.header-icon-btn*`, `.header-user-btn`, `.header-user-avatar`, `.header-user-dropdown*`, `.header-search-btn`, `.header-search-kbd`
   - Generic modal system: `.modal-overlay`, `.modal-panel*`, `.modal-header*`, `.modal-title`, `.modal-subtitle`, `.modal-close`, `.modal-body`, `.modal-footer` (`Modal.tsx` itself needs no structural change)
   - Buttons: `.btn-primary`, `.btn-ghost`
   - Form primitives: `.form-field`, `.form-label`, `.form-label-hint`, `.form-input`, `.form-input-mono`, `.form-error`, `.form-select*`, `.form-time*`
   - Misc shared: `.tag*`, `.prog-track`, `.prog-fill`, `.hr`

No changes to component *markup/structure* in this phase — only class names' CSS definitions and the two hardcoded-hex spots in `Sidebar.tsx`. `Modal.tsx`, `Header.tsx` need zero code changes since they're pure class consumers.

## Explicitly out of scope (future phases)

- Phase 2 (tentative): table/list pages — catalog product cards/list rows, orders, CRM list views, settings, users/support pages, import/filter panel modals.
- Phase 3 (tentative): visual/data-heavy areas — KPI cards & analytics charts, CRM Kanban board, inbox/chat bubbles, agent persona/rules/knowledge widgets, onboarding stepper.
- Landing page (`lp-*`) — stays dark, not touched in any phase per user decision.

## Verification

- `pnpm --filter @whatsagent/web dev`, visually check: login → dashboard shell (sidebar, header, any modal e.g. logout confirm or a settings modal), confirm white/light shell, Outfit font loads, no leftover dark hex bleeding through on shell chrome.
- `pnpm --filter @whatsagent/web lint` and `pnpm --filter @whatsagent/web build` (or `tsc`) to catch any broken class refs.
- Spot-check a feature page not yet migrated (e.g. `/catalog`) to confirm it still renders (dark-styled feature content sitting inside a now-light shell is expected and acceptable for this phase — it will look mixed until Phase 2/3 land).
