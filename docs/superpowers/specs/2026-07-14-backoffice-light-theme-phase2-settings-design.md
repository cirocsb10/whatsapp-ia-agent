# Backoffice Light Theme — Phase 2.6: Settings (Final Sub-Phase)

## Goal

Complete the backoffice light-theme retheme. Sixth and final sub-phase of Phase 2 (CRM → Orders → Catalog → Support → Admin → **Settings**). CRM, Orders, Catalog, Support, and Admin are done and committed. This covers `(dashboard)/settings/page.tsx` (a single large file containing both its own tabs and two inline modals) plus the remaining `.settings-*` CSS not already fixed by Admin's shared-prep step.

## What Admin's shared prep already covered

The Admin sub-phase (Task 1) already retheme'd: `.settings-field-label`, `.settings-field-hint`, `.settings-input` (base/`::placeholder`/`:hover`/`:focus`), `.settings-divider`, `.settings-link-btn` (+ `:hover`), `.settings-avatar-btn`. None of these need further work. (`.settings-avatar-btn` and `.settings-link-btn` are currently unused/orphaned in `settings/page.tsx`'s JSX — already-fixed but with no visual impact yet; noted for completeness, not a defect.)

## Explicitly out of scope for this phase, and for the whole 6-phase project

- Login/Register pages (`(public)/login/page.tsx`, `(public)/register/page.tsx`) and the shared `AuthShell` component — still fully dark, **out of scope**, matching the Phase 1 precedent that public-facing pages (landing) stay dark. Not part of any of the 6 phases.
- Agent (`agent/persona`, `agent/rules`, `agent/knowledge`), Onboarding (`setup/*` and its layout), Analytics, Overview, Inbox — explicitly deferred from the start of Phase 2, remain dark after this phase ships.
- Two `rgba(15,23,42,X)` values in `orders/page.tsx` and `CreateOrderModal.tsx` flagged during the project-wide sweep are **false positives** — they're already the correct light-theme shadow/hover recipe (matching the established `rgba(15,23,42,0.16)` dropdown-shadow and `rgba(15,23,42,0.05)` hover-tint conventions used throughout this project), not dark remnants. No action.

## Scope

### A. `settings/page.tsx` — inline literals and Tailwind classes

- Line 136: `text-slate-400` (avatar placeholder icon) → `text-slate-500`.
- Line 139: `text-[#e2e8f0]` ("Foto do perfil" label) → `text-[#0f172a]`.
- Line 140: `text-[#64748b]` (hint text) — already correct, no change.
- Line 201: `text-red-400` (AlertTriangle icon, danger zone) → `text-red-600`.
- Line 203: `text-[#f87171]` ("Zona de perigo" heading) → `text-[#dc2626]`.
- Line 204: `text-[#64748b]` (subtitle) — already correct.
- Lines 336-337: `text-[#e2e8f0]`/`text-[#64748b]` (notification row label/description, template applies to all 6 rows) → label `text-[#0f172a]`, description already correct.
- Lines 414-415: `text-[#e2e8f0]`/`text-[#64748b]` (2FA row label/description) → label `text-[#0f172a]`, description already correct.
- Line 476: `text-rose-400` (password-change error) → `text-rose-600`.
- Line 477: `text-green-400` (password-changed success) → `text-green-600`.
- Line 557: `text-green-400` (connected-status check icon) → `text-green-600`.
- Line 559: `border-[#334155]` (disconnected status dot border) → `border-[#cbd5e1]` (matches `--c-s3`).
- Line 580: inline `style={{ color: status === "connected" ? "#4ade80" : status === "pending" ? "#fbbf24" : "#475569" }}` → `"#15803d"` / `"#a16207"` / `"#94a3b8"` (green mapping, amber mapping, and the disconnected-state gray lightened to the standard placeholder/subtle gray since `#475569` reads too dark against the new white card).
- Lines 586-587: `text-[#e2e8f0]`/`text-[#64748b]` (integration card name/description) → name `text-[#0f172a]`, description already correct.
- Line 626 (WhatsApp connect modal): `text-amber-400` (MessageSquare icon) → `text-amber-700`.
- Line 723: `text-green-400` (Sparkles plan icon) → `text-green-600`.
- Line 726: `text-[#4ade80]` ("Plano atual" eyebrow) → `text-[#15803d]`.
- Lines 727, 735: `text-[#f1f5f9]` (plan name heading, price display) → `text-[#0f172a]`.
- Line 736: `text-[#64748b]` ("/mês" suffix) — already correct.
- Line 741: `text-[#94a3b8]` (feature list item text) → `text-[#64748b]`.
- Line 742: `text-green-400` (feature check icon) → `text-green-600`.
- Line 749: `text-[#475569]` ("Próxima renovação:" label) → `text-[#94a3b8]` (this is a de-emphasized secondary label, matching the pattern used for similarly de-emphasized micro-labels elsewhere, e.g. Catalog's SKU text).
- Line 750: `text-[#94a3b8]` (renewal date value) — already correct as the primary value's muted-but-legible tone, no change.
- Line 767: `text-[#94a3b8]` (usage row label) — already correct.
- Line 768: `text-[#475569]` (usage counter) → `text-[#94a3b8]` (same de-emphasis rationale as line 749).
- Line 784: `text-[#334155]` (empty-billing CreditCard icon) → `text-[#94a3b8]` (placeholder-icon gray, matches the Catalog empty-state icon precedent).
- Line 785: `text-[#475569]` (empty billing text) → `text-[#94a3b8]`.
- Line 792: `text-indigo-600` — already correct, no change.
- Line 794: `text-[#e2e8f0]` (invoice date text) → `text-[#0f172a]`.
- Line 797: `text-[#64748b]` (invoice status text) — already correct.
- Line 900: `text-slate-400` (Suspense fallback "Carregando…") → `text-slate-500`.
- TABS array `accent: "#818cf8"` (~line 42, feeds `--nav-accent`/icon colors) → `"#4f46e5"` (indigo mapping, consistent with every other indigo accent darkened in this project).
- Not touched: all other `accent`/icon-color prop values (`#6366f1`, `#22c55e`, `#06b6d4`, `#f59e0b` where used as decorative accent chips, not text) — decorative accent tints, same precedent as every KPI/stat-card accent array in this project.

### B. `.settings-*` CSS not covered by Admin's shared prep (globals.css:5529-6575)

**Nav shell** — `.settings-nav` background `rgba(12,21,38,0.72)`→light surface; border-right `rgba(26,45,71,0.8)`→`var(--c-border)`; `.settings-nav-label` color `#475569`→`#94a3b8`; `.settings-nav-item:hover` background/border-color (`rgba(255,255,255,X)` lighten-on-dark)→`rgba(15,23,42,X)` darken-on-light equivalents; `.settings-nav-item-active` color `#f1f5f9`→`#0f172a`, gradient stops→light equivalents; `.settings-nav-icon` background `rgba(15,23,42,0.55)`→light tint, border `rgba(255,255,255,0.06)`→`var(--c-border)`; `:hover` border-color→light equivalent.

**Hero** — `.settings-hero` gradient stops (`rgba(12,21,38,0.92)`, `rgba(7,13,26,0.98)`)→light equivalents; `.settings-hero-title` color `#f1f5f9`→`#0f172a`. Not touched: `.settings-hero-eyebrow` (`color-mix` with `#94a3b8` fallback, already muted-safe), `.settings-hero-desc` (`#64748b`, already correct).

**Panel** — `.settings-panel` background `rgba(12,21,38,0.78)`→`#ffffff`, border `rgba(26,45,71,0.85)`→`var(--c-border)`; `:hover` box-shadow `rgba(0,0,0,0.18)`→lighter (`rgba(15,23,42,0.1)`); `.settings-panel-head` border-bottom `rgba(26,45,71,0.7)`→`var(--c-border)`, background `rgba(255,255,255,0.02)`→dark-tint-on-light equivalent or remove (near-invisible artifact); `.settings-panel-title` color `#e2e8f0`→`#0f172a`.

**Avatar glass panel** (per decision: value-only swap, keep gradient/tint structure) — `.settings-avatar` background gradient `linear-gradient(145deg, rgba(99,102,241,0.22), rgba(99,102,241,0.06))` — the indigo tint values stay, this reads fine as a light indigo-tinted panel on white; verify visually but no value change needed since the gradient's rgba stops are already translucent indigo (not a base dark color); border `rgba(99,102,241,0.28)`/box-shadow `rgba(99,102,241,0.12)` — decorative indigo accents, no change needed.

**Slug** — `.settings-slug-prefix` (`#64748b`) already correct, no change. `.settings-slug-input` has no color rules.

**Danger zone** (per decision: value-only swap, keep gradient/tint structure) — `.settings-danger-zone` background gradient (`rgba(239,68,68,0.06)`/`rgba(239,68,68,0.02)`) — translucent red tint, already light-safe, no value change needed. `.settings-danger-btn` color `#f87171`→`#dc2626`.

**Save bar / button** — `.settings-save-btn` color `#4ade80`→`#15803d`; `.settings-save-spinner` border `rgba(74,222,128,0.3)`→keep (translucent green tint, decorative), border-top-color `#4ade80`→`#15803d`.

**Toggle** — `.settings-toggle` background (off-state track) `rgba(51,65,85,0.8)`→light track (`var(--c-s3)` or equivalent light gray); `:hover` border-color `rgba(255,255,255,0.12)`→light equivalent. `.settings-toggle-thumb` background `#f8fafc` — already light, no change (this is the thumb color, fine on both on/off track states once the track itself is fixed).

**Notifications** — `.settings-notif-group-icon` background `rgba(255,255,255,0.02)`→dark-tint-on-light equivalent or remove (near-invisible); `.settings-notif-row:hover` background `rgba(255,255,255,0.02)`→dark-tint-on-light equivalent.

**2FA** — `.settings-2fa-icon` background/border/box-shadow (`rgba(99,102,241,X)`) — translucent indigo tint, decorative, no change needed (same rationale as the avatar glass panel).

**Sessions** (CSS exists, not currently rendered — latent, fix anyway per the "cheap to fix in the same block" precedent from Catalog's `.orders-tool-btn--active` straggler) — `.settings-session-row` border-bottom `rgba(26,45,71,0.5)`→`var(--c-border)`; `:hover` background `rgba(255,255,255,0.02)`→dark-tint-on-light equivalent.

**Integrations** (per decision: value-only swap, keep gradient/tint structure) — `.settings-integ-card` background `rgba(7,13,26,0.55)`→`#ffffff`, border `rgba(26,45,71,0.85)`→`var(--c-border)`; `:hover` background `rgba(12,21,38,0.85)`→light hover tint (e.g. `#f8fafc`). `.settings-integ-btn` color `#070d1a` — dark text on solid green gradient button, matches the established "dark text on solid color chip" precedent, **no change**. `.settings-integ-btn-connected` color `#94a3b8`→`#64748b`, background `rgba(17,30,50,0.8)`→light tint.

**Webhook** — `.settings-webhook-input` has no color rules. `.settings-webhook-copy` color `#818cf8`→`#4f46e5`, background `rgba(99,102,241,0.08)` — decorative tint, no change.

**Plan card** (per decision: value-only swap, keep gradient/tint structure) — `.settings-plan-card` gradient stops (`rgba(12,21,38,0.95)`, `rgba(7,13,26,0.98)`)→light equivalents. `.settings-plan-upgrade-btn` color `#4ade80`→`#15803d`.

**Invoices** — `.settings-invoice-amount` color `#e2e8f0`→`#0f172a`; `.settings-invoice-link` color `#818cf8`→`#4f46e5`; `:hover` color `#a5b4fc`→`#4f46e5` (collapses to the same target, matching the established hover-collapse precedent from Support/Admin).

**Modals** — `.settings-modal-overlay` background `rgba(2,6,23,0.72)`→light scrim (per decision: lighten, matching the `rgba(15,23,42,0.25)` recipe established for Catalog's `.filter-panel-overlay` and Admin's `.super-admin-confirm-backdrop`). `.settings-modal` background `rgba(12,21,38,0.96)`→`#ffffff`, border `rgba(99,102,241,0.22)`→keep (decorative indigo accent border) or lighten to `var(--c-border)` — use `var(--c-border)` for consistency with every other modal/dialog border in this project. `.settings-modal-head` border-bottom `rgba(26,45,71,0.8)`→`var(--c-border)`, background `rgba(255,255,255,0.02)`→dark-tint-on-light or remove. `.settings-modal-title` color `#f1f5f9`→`#0f172a`. `.settings-modal-close` color `#64748b` (already correct), background `rgba(255,255,255,0.04)`→dark-tint-on-light, border `rgba(255,255,255,0.06)`→`var(--c-border)`; `:hover` color `#f1f5f9`→`#0f172a`, background `rgba(255,255,255,0.08)`→dark-tint-on-light, border-color `rgba(255,255,255,0.12)`→`var(--c-border)`. `.settings-modal-footer` border-top `rgba(26,45,71,0.8)`→`var(--c-border)`, background `rgba(7,13,26,0.5)`→light equivalent (e.g. `#f8fafc`).

## Explicitly out of scope (recap)

- Login/Register pages, `AuthShell` — out of scope for the whole project, not just this phase.
- Agent, Onboarding, Analytics, Overview, Inbox — deferred from the start of Phase 2.
- The two `rgba(15,23,42,X)` false positives in Orders — already correct, no action.
- Refactoring any inline styles into `.form-*` classes — value-only swaps only, consistent with every prior sub-phase.

## Verification

- `pnpm --filter @whatsagent/web build` and `pnpm --filter @whatsagent/web lint` after each task.
- Manual check (deferred to the user — no browser tool available to the controller): open `/settings`, confirm the nav shell, hero, and every tab (Conta, Notificações, Segurança/2FA, Integrações, Plano) reads light and legible, including the danger zone, save bar, toggles, and invoice history. Open both inline modals (password change, WhatsApp connect) and confirm the modal shell, scrim, and content are all light and legible.
- Once this phase's final review passes, do a final project-wide grep sweep to confirm no unexpected dark literals remain outside the explicitly-out-of-scope routes, and report back to the user with a clear "what's light / what's still dark" summary before declaring the 6-phase backoffice retheme complete.
