# Backoffice Light Theme — Phase 2.6 Settings Implementation Plan (Final Sub-Phase)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme `(dashboard)/settings/page.tsx` and the remaining `.settings-*` CSS (not already fixed by Admin's shared-prep) from dark to light, completing the 6-phase backoffice light-theme migration.

**Architecture:** Value-only color swaps in existing CSS rules, inline `style={{}}` objects, and Tailwind classes — no structural changes, no new classes, no refactor into `.form-*` primitives. Every change is confirmed against the design spec at `docs/superpowers/specs/2026-07-14-backoffice-light-theme-phase2-settings-design.md`.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS v4, hand-written CSS in `apps/web/src/app/globals.css`.

## Global Constraints

- Value-only swaps only — never refactor inline styles into `.form-*` CSS classes.
- Established color mappings (copy exactly):
  - Green accent/success text: `#4ade80` → `#15803d`; Tailwind `text-green-400` → `text-green-600`
  - Indigo accent text: `#818cf8`/`#a5b4fc` → `#4f46e5`
  - Red/danger text: `#f87171` → `#dc2626`; Tailwind `text-red-400` → `text-red-600`; `text-rose-400` → `text-rose-600`
  - Amber/warning: Tailwind `text-amber-400` → `text-amber-700`; hex `#fbbf24` → `#a16207`
  - Muted body text: `#94a3b8` → `#64748b`; `#475569` → `#94a3b8` (de-emphasized secondary labels/values, distinct target from the primary muted mapping — see spec section A for exact line-by-line rationale); Tailwind `text-slate-400` → `text-slate-500`
  - Near-white / primary heading text: `#e2e8f0`/`#f1f5f9` → `#0f172a`
  - Dark surfaces: `rgba(7,13,26,X)`/`rgba(12,21,38,X)`/`rgba(15,23,42,X)`/`rgba(2,6,23,X)`/`rgba(17,30,50,X)`/`rgba(51,65,85,X)` → light equivalents (white or light tint per context)
  - Dark borders: `rgba(26,45,71,X)` → `var(--c-border)`-equivalent
  - Dark-theme hover overlays (`rgba(255,255,255,X)` lighten-on-dark) → `rgba(15,23,42,X)` darken-on-light equivalent, or remove if the resulting effect is near-invisible on light (see Task 3/Task 8 notes)
- Decision: `.settings-modal-overlay` scrim lightens (does NOT stay dark like `.modal-overlay`) — matches the Catalog `.filter-panel-overlay` / Admin `.super-admin-confirm-backdrop` divergence, using the same `rgba(15,23,42,0.25)` recipe.
- Decision: glass-morphism panels (`.settings-avatar`, `.settings-danger-zone`, `.settings-integ-card`) get a **value-only swap** — flip the dark base color to a light equivalent, keep the existing accent-tint gradient/overlay structure. `.settings-avatar` and `.settings-danger-zone`'s gradients are already translucent accent tints (not a flat dark base), so they need **no value change** — only `.settings-integ-card`'s flat dark `rgba(7,13,26,0.55)` base needs to flip.
- Decision: `.settings-integ-btn` dark text (`#070d1a`) on a solid green gradient button stays **unchanged** — matches the established "dark text on solid color chip" precedent.
- Decision: TABS array `accent: "#818cf8"` (Segurança tab, feeds `--nav-accent`) → `"#4f46e5"`, consistent with every other indigo accent darkened project-wide. Other TABS/INTEGRATIONS/USAGE array accent hex values (`#6366f1`, `#22c55e`, `#f59e0b`, `#06b6d4`, `#fbbf24` used as icon/accent-chip colors) stay unchanged — decorative accents, not text.
- Login/Register pages, `AuthShell`, Agent, Onboarding, Analytics, Overview, Inbox — all explicitly out of scope, not touched by this plan.
- Verify with `pnpm --filter @whatsagent/web build` and `pnpm --filter @whatsagent/web lint` after each task. If `pnpm` isn't on PATH or the build fails with a Node-version error, prefix with `export PATH="/c/Users/Login/AppData/Roaming/nvm/v20.11.1:$PATH"` and use `corepack pnpm ...` instead. If the build fails with a `.tsbuildinfo` path-separator "Debug Failure" (a stale-cache issue, unrelated to any of these changes), run `rm -rf apps/web/.next/cache` once and retry.

---

### Task 1: `settings/page.tsx` — all TSX edits

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx`

**Interfaces:**
- Consumes: `.settings-*` CSS from Tasks 2-8.
- Produces: no new interfaces.

- [ ] **Step 1: Fix TABS array Segurança accent**

Before (page.tsx:40-44):
```tsx
  { key: "conta",        label: "Conta",        icon: User,       desc: "Perfil, loja e preferências da conta",     accent: "#6366f1" },
  { key: "notificacoes", label: "Notificações",  icon: Bell,       desc: "Alertas de conversas, pedidos e relatórios", accent: "#f59e0b" },
  { key: "seguranca",    label: "Segurança",     icon: Shield,     desc: "Senha, 2FA e sessões ativas",                accent: "#818cf8" },
  { key: "integracoes",  label: "Integrações",   icon: Plug,       desc: "WhatsApp, pagamentos e serviços conectados", accent: "#22c55e" },
  { key: "plano",        label: "Plano",         icon: CreditCard, desc: "Assinatura, uso e histórico de pagamentos",   accent: "#06b6d4" },
```

After:
```tsx
  { key: "conta",        label: "Conta",        icon: User,       desc: "Perfil, loja e preferências da conta",     accent: "#6366f1" },
  { key: "notificacoes", label: "Notificações",  icon: Bell,       desc: "Alertas de conversas, pedidos e relatórios", accent: "#f59e0b" },
  { key: "seguranca",    label: "Segurança",     icon: Shield,     desc: "Senha, 2FA e sessões ativas",                accent: "#4f46e5" },
  { key: "integracoes",  label: "Integrações",   icon: Plug,       desc: "WhatsApp, pagamentos e serviços conectados", accent: "#22c55e" },
  { key: "plano",        label: "Plano",         icon: CreditCard, desc: "Assinatura, uso e histórico de pagamentos",   accent: "#06b6d4" },
```

- [ ] **Step 2: Fix Perfil card (avatar, name, danger zone)**

Before (page.tsx:132-210):
```tsx
      {/* Avatar */}
      <SectionPanel title="Perfil" description="Informações visíveis no painel e relatórios." accent="#6366f1">
        <div className="settings-avatar-row">
          <div className="settings-avatar">
            <User className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[#e2e8f0]">Foto do perfil</p>
            <p className="text-[11px] text-[#64748b] mt-1">Upload de avatar em breve.</p>
          </div>
        </div>
```

After:
```tsx
      {/* Avatar */}
      <SectionPanel title="Perfil" description="Informações visíveis no painel e relatórios." accent="#6366f1">
        <div className="settings-avatar-row">
          <div className="settings-avatar">
            <User className="w-8 h-8 text-slate-500" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[#0f172a]">Foto do perfil</p>
            <p className="text-[11px] text-[#64748b] mt-1">Upload de avatar em breve.</p>
          </div>
        </div>
```

Before (page.tsx:198-206):
```tsx
      {/* Danger zone */}
      <div className="settings-danger-zone">
        <div className="settings-danger-head">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" strokeWidth={1.8} />
          <div>
            <p className="text-[13px] font-semibold text-[#f87171]">Zona de perigo</p>
            <p className="text-[11px] text-[#64748b] mt-0.5">Ações irreversíveis para a sua conta.</p>
          </div>
        </div>
```

After:
```tsx
      {/* Danger zone */}
      <div className="settings-danger-zone">
        <div className="settings-danger-head">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.8} />
          <div>
            <p className="text-[13px] font-semibold text-[#dc2626]">Zona de perigo</p>
            <p className="text-[11px] text-[#64748b] mt-0.5">Ações irreversíveis para a sua conta.</p>
          </div>
        </div>
```

- [ ] **Step 3: Fix notification rows**

Before (page.tsx:334-338):
```tsx
              <div className="settings-notif-row">
                <div>
                  <p className="text-[13px] font-medium text-[#e2e8f0]">{label}</p>
                  <p className="text-[11px] text-[#64748b] mt-0.5">{desc}</p>
                </div>
```

After:
```tsx
              <div className="settings-notif-row">
                <div>
                  <p className="text-[13px] font-medium text-[#0f172a]">{label}</p>
                  <p className="text-[11px] text-[#64748b] mt-0.5">{desc}</p>
                </div>
```

- [ ] **Step 4: Fix Segurança 2FA row and password modal feedback**

Before (page.tsx:413-418):
```tsx
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#e2e8f0]">Alterar senha</p>
            <p className="text-[11px] text-[#64748b] mt-0.5">
              Atualize sua senha de acesso ao painel
            </p>
          </div>
```

After:
```tsx
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#0f172a]">Alterar senha</p>
            <p className="text-[11px] text-[#64748b] mt-0.5">
              Atualize sua senha de acesso ao painel
            </p>
          </div>
```

Before (page.tsx:476-477):
```tsx
              {error && <p className="text-sm text-rose-400">{error}</p>}
              {success && <p className="text-sm text-green-400">Senha alterada com sucesso!</p>}
```

After:
```tsx
              {error && <p className="text-sm text-rose-600">{error}</p>}
              {success && <p className="text-sm text-green-600">Senha alterada com sucesso!</p>}
```

- [ ] **Step 5: Fix Integrações status icons and card text**

Before (page.tsx:556-560):
```tsx
  const statusIcon = (s: ConnStatus) => {
    if (s === "connected") return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" strokeWidth={2} />;
    if (s === "pending") return <div className="w-3.5 h-3.5 rounded-full bg-amber-400/30 border border-amber-400 flex-shrink-0" />;
    return <div className="w-3.5 h-3.5 rounded-full border border-[#334155] flex-shrink-0" />;
  };
```

After:
```tsx
  const statusIcon = (s: ConnStatus) => {
    if (s === "connected") return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" strokeWidth={2} />;
    if (s === "pending") return <div className="w-3.5 h-3.5 rounded-full bg-amber-400/30 border border-amber-400 flex-shrink-0" />;
    return <div className="w-3.5 h-3.5 rounded-full border border-[#cbd5e1] flex-shrink-0" />;
  };
```

Before (page.tsx:576-587):
```tsx
                <div className="settings-integ-status">
                  {statusIcon(status)}
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: status === "connected" ? "#4ade80" : status === "pending" ? "#fbbf24" : "#475569" }}
                  >
                    {badge}
                  </span>
                </div>
              </div>
              <p className="text-[13px] font-semibold text-[#e2e8f0] mt-3">{name}</p>
              <p className="text-[11px] text-[#64748b] mt-1 leading-relaxed">{desc}</p>
```

After:
```tsx
                <div className="settings-integ-status">
                  {statusIcon(status)}
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: status === "connected" ? "#15803d" : status === "pending" ? "#a16207" : "#94a3b8" }}
                  >
                    {badge}
                  </span>
                </div>
              </div>
              <p className="text-[13px] font-semibold text-[#0f172a] mt-3">{name}</p>
              <p className="text-[11px] text-[#64748b] mt-1 leading-relaxed">{desc}</p>
```

- [ ] **Step 6: Fix WhatsApp connect modal icon**

Before (page.tsx:623-627):
```tsx
            <div className="settings-modal-head">
              <div className="flex items-start gap-3">
                <div className="settings-modal-icon" style={{ background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.25)" }}>
                  <MessageSquare className="w-4 h-4 text-amber-400" strokeWidth={1.8} />
                </div>
```

After:
```tsx
            <div className="settings-modal-head">
              <div className="flex items-start gap-3">
                <div className="settings-modal-icon" style={{ background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.25)" }}>
                  <MessageSquare className="w-4 h-4 text-amber-700" strokeWidth={1.8} />
                </div>
```

- [ ] **Step 7: Fix Plano card header, price, features, footer**

Before (page.tsx:721-736):
```tsx
        <div className="settings-plan-header">
          <div className="settings-plan-icon">
            <Sparkles className="w-5 h-5 text-green-400" strokeWidth={1.6} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#4ade80] uppercase tracking-widest">Plano atual</p>
            <p className="text-[22px] font-bold text-[#f1f5f9] leading-tight mt-0.5 tracking-tight">{planDisplay}</p>
          </div>
          <span className={`tag ml-auto shrink-0 ${sub?.status === "ACTIVE" ? "tag-green" : "tag-slate"}`}>
            {statusLabel}
          </span>
        </div>

        <div className="settings-plan-price">
          <span className="text-[32px] font-bold text-[#f1f5f9] tracking-tight">{PLAN_PRICE[planName] ?? "—"}</span>
          {planName !== "ENTERPRISE" && <span className="text-[13px] text-[#64748b]">/mês</span>}
        </div>

        <ul className="settings-plan-features">
          {(PLAN_FEATURES[planName] ?? []).map((f) => (
            <li key={f} className="flex items-center gap-2 text-[12px] text-[#94a3b8]">
              <Check className="w-3 h-3 text-green-400 shrink-0" strokeWidth={2.5} />
              {f}
            </li>
          ))}
        </ul>

        <div className="settings-plan-footer">
          <p className="text-[11px] text-[#475569]">
            Próxima renovação: <span className="text-[#94a3b8]">{renewalDisplay}</span>
          </p>
          <button className="settings-plan-upgrade-btn">
            <ArrowUpRight className="w-3.5 h-3.5" />
            Ver planos
          </button>
        </div>
```

After:
```tsx
        <div className="settings-plan-header">
          <div className="settings-plan-icon">
            <Sparkles className="w-5 h-5 text-green-600" strokeWidth={1.6} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#15803d] uppercase tracking-widest">Plano atual</p>
            <p className="text-[22px] font-bold text-[#0f172a] leading-tight mt-0.5 tracking-tight">{planDisplay}</p>
          </div>
          <span className={`tag ml-auto shrink-0 ${sub?.status === "ACTIVE" ? "tag-green" : "tag-slate"}`}>
            {statusLabel}
          </span>
        </div>

        <div className="settings-plan-price">
          <span className="text-[32px] font-bold text-[#0f172a] tracking-tight">{PLAN_PRICE[planName] ?? "—"}</span>
          {planName !== "ENTERPRISE" && <span className="text-[13px] text-[#64748b]">/mês</span>}
        </div>

        <ul className="settings-plan-features">
          {(PLAN_FEATURES[planName] ?? []).map((f) => (
            <li key={f} className="flex items-center gap-2 text-[12px] text-[#64748b]">
              <Check className="w-3 h-3 text-green-600 shrink-0" strokeWidth={2.5} />
              {f}
            </li>
          ))}
        </ul>

        <div className="settings-plan-footer">
          <p className="text-[11px] text-[#94a3b8]">
            Próxima renovação: <span className="text-[#94a3b8]">{renewalDisplay}</span>
          </p>
          <button className="settings-plan-upgrade-btn">
            <ArrowUpRight className="w-3.5 h-3.5" />
            Ver planos
          </button>
        </div>
```

- [ ] **Step 8: Fix Uso do mês labels**

Before (page.tsx:766-770):
```tsx
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-medium text-[#94a3b8]">{label}</span>
                  <span className="text-[11px] text-[#475569] font-variant-numeric tabular-nums">
                    {u.used} / {u.limit}
                  </span>
                </div>
```

After:
```tsx
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-medium text-[#94a3b8]">{label}</span>
                  <span className="text-[11px] text-[#94a3b8] font-variant-numeric tabular-nums">
                    {u.used} / {u.limit}
                  </span>
                </div>
```

- [ ] **Step 9: Fix billing empty-state and invoice rows**

Before (page.tsx:782-799):
```tsx
        {invoices.length === 0 ? (
          <div className="settings-billing-empty">
            <CreditCard className="w-5 h-5 text-[#334155]" strokeWidth={1.5} />
            <p className="text-[12px] text-[#475569]">Nenhum pagamento registrado ainda.</p>
          </div>
        ) : (
          <div className="settings-invoice-list">
            {invoices.map((inv) => (
              <div key={inv.id} className="settings-invoice-row">
                <div className="settings-invoice-date">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600 shrink-0" strokeWidth={1.8} />
                  <div>
                    <p className="text-[13px] font-medium text-[#e2e8f0]">
                      {new Date(inv.date).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <p className="text-[11px] text-[#64748b] mt-0.5">{inv.status ?? "Processado"}</p>
                  </div>
                </div>
```

After:
```tsx
        {invoices.length === 0 ? (
          <div className="settings-billing-empty">
            <CreditCard className="w-5 h-5 text-[#94a3b8]" strokeWidth={1.5} />
            <p className="text-[12px] text-[#94a3b8]">Nenhum pagamento registrado ainda.</p>
          </div>
        ) : (
          <div className="settings-invoice-list">
            {invoices.map((inv) => (
              <div key={inv.id} className="settings-invoice-row">
                <div className="settings-invoice-date">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600 shrink-0" strokeWidth={1.8} />
                  <div>
                    <p className="text-[13px] font-medium text-[#0f172a]">
                      {new Date(inv.date).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <p className="text-[11px] text-[#64748b] mt-0.5">{inv.status ?? "Processado"}</p>
                  </div>
                </div>
```

- [ ] **Step 10: Fix Suspense fallback loading text**

Before (page.tsx:894-902):
```tsx
export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="fade-up flex flex-col h-screen overflow-hidden">
          <Header title="Configurações" subtitle="Gerencie sua conta, integrações e plano" />
          <div className="flex flex-1 items-center justify-center text-slate-400">Carregando…</div>
        </div>
      }
    >
```

After:
```tsx
export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="fade-up flex flex-col h-screen overflow-hidden">
          <Header title="Configurações" subtitle="Gerencie sua conta, integrações e plano" />
          <div className="flex flex-1 items-center justify-center text-slate-500">Carregando…</div>
        </div>
      }
    >
```

- [ ] **Step 11: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 12: Commit**

```bash
git add "apps/web/src/app/(dashboard)/settings/page.tsx"
git commit -m "fix(web): retheme settings page for light theme"
```

---

### Task 2: Nav shell + Hero CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:5541-5605,5701-5704`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.settings-nav*` and `.settings-hero-title` rules.

- [ ] **Step 1: Apply the nav shell CSS edits**

Before (globals.css:5541-5605):
```css
  .settings-nav {
    width: 228px;
    flex-shrink: 0;
    border-right: 1px solid rgba(26,45,71,0.8);
    background: rgba(12,21,38,0.72);
    backdrop-filter: blur(12px);
    padding: 18px 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    overflow-y: auto;
  }
  .settings-nav-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #475569;
    padding: 0 10px 10px;
  }
  .settings-nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 10px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 450;
    color: var(--c-muted);
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    text-align: left;
    transition: color 180ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
  }
  .settings-nav-item:hover {
    color: var(--c-text);
    background: rgba(255,255,255,0.04);
    border-color: rgba(255,255,255,0.06);
  }
  .settings-nav-item-active {
    color: #f1f5f9;
    background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
    border-color: color-mix(in srgb, var(--nav-accent, #6366f1) 22%, transparent);
    box-shadow:
      inset 3px 0 0 var(--nav-accent, var(--c-green)),
      0 4px 20px color-mix(in srgb, var(--nav-accent, #6366f1) 8%, transparent);
    font-weight: 500;
  }
  .settings-nav-icon {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: rgba(15,23,42,0.55);
    border: 1px solid rgba(255,255,255,0.06);
    transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
  }
  .settings-nav-item:hover .settings-nav-icon {
    border-color: rgba(255,255,255,0.1);
  }
```

After:
```css
  .settings-nav {
    width: 228px;
    flex-shrink: 0;
    border-right: 1px solid var(--c-border);
    background: #ffffff;
    backdrop-filter: blur(12px);
    padding: 18px 10px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    overflow-y: auto;
  }
  .settings-nav-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #94a3b8;
    padding: 0 10px 10px;
  }
  .settings-nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 10px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 450;
    color: var(--c-muted);
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    text-align: left;
    transition: color 180ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
  }
  .settings-nav-item:hover {
    color: var(--c-text);
    background: rgba(15,23,42,0.04);
    border-color: var(--c-border);
  }
  .settings-nav-item-active {
    color: #0f172a;
    background: linear-gradient(135deg, rgba(15,23,42,0.04) 0%, rgba(15,23,42,0.02) 100%);
    border-color: color-mix(in srgb, var(--nav-accent, #6366f1) 22%, transparent);
    box-shadow:
      inset 3px 0 0 var(--nav-accent, var(--c-green)),
      0 4px 20px color-mix(in srgb, var(--nav-accent, #6366f1) 8%, transparent);
    font-weight: 500;
  }
  .settings-nav-icon {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: #f8fafc;
    border: 1px solid var(--c-border);
    transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
  }
  .settings-nav-item:hover .settings-nav-icon {
    border-color: var(--c-s3);
  }
```

- [ ] **Step 2: Apply the hero title fix**

Before (globals.css:5701-5707):
```css
  .settings-hero-title {
    font-size: 20px;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.025em;
    line-height: 1.2;
  }
```

After:
```css
  .settings-hero-title {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.025em;
    line-height: 1.2;
  }
```

- [ ] **Step 3: Apply the hero background gradient fix**

Before (globals.css:5629-5642):
```css
  .settings-hero {
    position: relative;
    margin: 22px 0 20px;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--hero-accent, #6366f1) 22%, transparent);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--hero-accent, #6366f1) 10%, transparent) 0%,
      rgba(12,21,38,0.92) 55%,
      rgba(7,13,26,0.98) 100%
    );
    backdrop-filter: blur(16px);
  }
```

After:
```css
  .settings-hero {
    position: relative;
    margin: 22px 0 20px;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--hero-accent, #6366f1) 22%, transparent);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--hero-accent, #6366f1) 10%, transparent) 0%,
      #ffffff 55%,
      #f8fafc 100%
    );
    backdrop-filter: blur(16px);
  }
```

- [ ] **Step 4: Confirm no change needed for hero glow/eyebrow/desc**

`.settings-hero::before`, `.settings-hero-glow*` (decorative radial glows), `.settings-hero-eyebrow` (`color-mix` with `#94a3b8` fallback, already muted-safe), and `.settings-hero-desc` (`#64748b`, already correct) stay unchanged — do not edit them.

- [ ] **Step 5: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme settings nav shell and hero CSS for light theme"
```

---

### Task 3: Panel CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:5754-5797`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.settings-panel*` rules consumed by every `SectionPanel` on the page.

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:5753-5797):
```css
  /* Panel */
  .settings-panel {
    background: rgba(12,21,38,0.78);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(26,45,71,0.85);
    border-radius: 14px;
    overflow: hidden;
    position: relative;
    transition: border-color 200ms ease, box-shadow 200ms ease;
  }
  .settings-panel:hover {
    border-color: color-mix(in srgb, var(--panel-accent, #6366f1) 28%, var(--c-border));
    box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  }
  .settings-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.025) 0%, transparent 48%);
    pointer-events: none;
  }
  .settings-panel-accent-bar {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--panel-accent, #6366f1), color-mix(in srgb, var(--panel-accent, #6366f1) 40%, transparent) 70%, transparent);
    opacity: 0.85;
    pointer-events: none;
  }
  .settings-panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 16px 20px 14px;
    border-bottom: 1px solid rgba(26,45,71,0.7);
    background: rgba(255,255,255,0.02);
    position: relative;
    z-index: 1;
  }
  .settings-panel-title {
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
    letter-spacing: -0.015em;
  }
```

After:
```css
  /* Panel */
  .settings-panel {
    background: #ffffff;
    backdrop-filter: blur(10px);
    border: 1px solid var(--c-border);
    border-radius: 14px;
    overflow: hidden;
    position: relative;
    transition: border-color 200ms ease, box-shadow 200ms ease;
  }
  .settings-panel:hover {
    border-color: color-mix(in srgb, var(--panel-accent, #6366f1) 28%, var(--c-border));
    box-shadow: 0 8px 32px rgba(15,23,42,0.1);
  }
  .settings-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(15,23,42,0.02) 0%, transparent 48%);
    pointer-events: none;
  }
  .settings-panel-accent-bar {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--panel-accent, #6366f1), color-mix(in srgb, var(--panel-accent, #6366f1) 40%, transparent) 70%, transparent);
    opacity: 0.85;
    pointer-events: none;
  }
  .settings-panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 16px 20px 14px;
    border-bottom: 1px solid var(--c-border);
    background: rgba(15,23,42,0.02);
    position: relative;
    z-index: 1;
  }
  .settings-panel-title {
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
    letter-spacing: -0.015em;
  }
```

- [ ] **Step 2: Confirm no change needed for `.settings-panel-desc`**

`.settings-panel-desc` color `#64748b` is already the target muted value — do not edit it.

- [ ] **Step 3: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme settings panel CSS for light theme"
```

---

### Task 4: Danger zone, save bar, and toggle CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:5975-6067`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.settings-danger-btn`, `.settings-save-btn*`, `.settings-toggle*` rules.

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:5975-5992):
```css
  .settings-danger-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    color: #f87171;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    cursor: pointer;
    transition: background 160ms ease, border-color 160ms ease;
  }
  .settings-danger-btn:hover {
    background: rgba(239,68,68,0.14);
    border-color: rgba(239,68,68,0.35);
  }
```

After:
```css
  .settings-danger-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    color: #dc2626;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    cursor: pointer;
    transition: background 160ms ease, border-color 160ms ease;
  }
  .settings-danger-btn:hover {
    background: rgba(239,68,68,0.14);
    border-color: rgba(239,68,68,0.35);
  }
```

Before (globals.css:6005-6039):
```css
  .settings-save-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 14px;
    min-height: 36px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    color: #4ade80;
    background: rgba(34,197,94,0.08);
    border: 1px solid rgba(34,197,94,0.2);
    cursor: pointer;
    justify-content: center;
    transition: background 160ms ease, border-color 160ms ease;
  }
  .settings-save-btn:hover:not(:disabled) {
    background: rgba(34,197,94,0.14);
    border-color: rgba(34,197,94,0.35);
  }
  .settings-save-btn:disabled { opacity: 0.7; cursor: default; }
  .settings-save-btn-inline {
    width: auto;
    min-width: 140px;
    flex: 1;
  }
  .settings-save-spinner {
    width: 13px;
    height: 13px;
    border: 2px solid rgba(74,222,128,0.3);
    border-top-color: #4ade80;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
```

After:
```css
  .settings-save-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 14px;
    min-height: 36px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    color: #15803d;
    background: rgba(34,197,94,0.08);
    border: 1px solid rgba(34,197,94,0.2);
    cursor: pointer;
    justify-content: center;
    transition: background 160ms ease, border-color 160ms ease;
  }
  .settings-save-btn:hover:not(:disabled) {
    background: rgba(34,197,94,0.14);
    border-color: rgba(34,197,94,0.35);
  }
  .settings-save-btn:disabled { opacity: 0.7; cursor: default; }
  .settings-save-btn-inline {
    width: auto;
    min-width: 140px;
    flex: 1;
  }
  .settings-save-spinner {
    width: 13px;
    height: 13px;
    border: 2px solid rgba(74,222,128,0.3);
    border-top-color: #15803d;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
```

Before (globals.css:6043-6056):
```css
  /* Toggle */
  .settings-toggle {
    width: 44px;
    height: 26px;
    border-radius: 99px;
    background: rgba(51,65,85,0.8);
    border: 1px solid rgba(255,255,255,0.06);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    transition: background 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
    flex-shrink: 0;
  }
  .settings-toggle:hover { border-color: rgba(255,255,255,0.12); }
```

After:
```css
  /* Toggle */
  .settings-toggle {
    width: 44px;
    height: 26px;
    border-radius: 99px;
    background: var(--c-s3);
    border: 1px solid var(--c-border);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    transition: background 220ms ease, border-color 220ms ease, box-shadow 220ms ease;
    flex-shrink: 0;
  }
  .settings-toggle:hover { border-color: var(--c-muted); }
```

- [ ] **Step 2: Confirm no change needed for the toggle-on and thumb states**

`.settings-toggle-on` (`var(--c-green)`, `rgba(34,197,94,X)`) and `.settings-toggle-thumb` (`#f8fafc`) are already light-safe — do not edit them.

- [ ] **Step 3: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme settings danger-zone, save-bar, and toggle CSS for light theme"
```

---

### Task 5: Notifications, 2FA, and sessions CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:6074-6125`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.settings-notif-*` and `.settings-session-row*` rules. `.settings-2fa-icon` needs no change (decorative indigo tint, already light-safe).

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:6073-6093):
```css
  /* Notifications */
  .settings-notif-group-icon {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    font-size: 12px;
    border: 1px solid;
    margin: 16px 18px 4px;
    border-radius: 99px;
    background: rgba(255,255,255,0.02);
  }
  .settings-notif-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 15px 20px;
    transition: background 160ms ease;
  }
  .settings-notif-row:hover { background: rgba(255,255,255,0.02); }
```

After:
```css
  /* Notifications */
  .settings-notif-group-icon {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    font-size: 12px;
    border: 1px solid;
    margin: 16px 18px 4px;
    border-radius: 99px;
    background: rgba(15,23,42,0.02);
  }
  .settings-notif-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 15px 20px;
    transition: background 160ms ease;
  }
  .settings-notif-row:hover { background: rgba(15,23,42,0.02); }
```

Before (globals.css:6115-6125):
```css
  /* Sessions */
  .settings-session-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    border-bottom: 1px solid rgba(26,45,71,0.5);
    transition: background 140ms ease;
  }
  .settings-session-row:last-child { border-bottom: none; }
  .settings-session-row:hover { background: rgba(255,255,255,0.02); }
```

After:
```css
  /* Sessions */
  .settings-session-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    border-bottom: 1px solid var(--c-border);
    transition: background 140ms ease;
  }
  .settings-session-row:last-child { border-bottom: none; }
  .settings-session-row:hover { background: rgba(15,23,42,0.02); }
```

- [ ] **Step 2: Confirm no change needed for `.settings-2fa-icon`**

`.settings-2fa-icon` background/border/box-shadow (`rgba(99,102,241,X)`) is a translucent indigo tint, already light-safe — do not edit it.

- [ ] **Step 3: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme settings notifications and sessions CSS for light theme"
```

---

### Task 6: Integrations and webhook CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:6143-6252`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.settings-integ-card*` and `.settings-webhook-copy*` rules.

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:6143-6154):
```css
  .settings-integ-card {
    padding: 18px;
    border-radius: 12px;
    background: rgba(7,13,26,0.55);
    border: 1px solid rgba(26,45,71,0.85);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    cursor: default;
    transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease, transform 200ms ease;
  }
```

After:
```css
  .settings-integ-card {
    padding: 18px;
    border-radius: 12px;
    background: #ffffff;
    border: 1px solid var(--c-border);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    cursor: default;
    transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease, transform 200ms ease;
  }
```

Before (globals.css:6215-6224):
```css
  .settings-integ-btn-connected {
    color: #94a3b8;
    background: rgba(17,30,50,0.8);
    border: 1px solid var(--c-border);
  }
  .settings-integ-btn-connected:hover {
    background: rgba(26,45,71,0.6);
    box-shadow: none;
    color: var(--c-text);
    transform: none;
  }
```

After:
```css
  .settings-integ-btn-connected {
    color: #64748b;
    background: #f8fafc;
    border: 1px solid var(--c-border);
  }
  .settings-integ-btn-connected:hover {
    background: #f1f5f9;
    box-shadow: none;
    color: var(--c-text);
    transform: none;
  }
```

Before (globals.css:6237-6252):
```css
  .settings-webhook-copy {
    display: inline-flex;
    align-items: center;
    padding: 0 12px;
    border-radius: 0 8px 8px 0;
    font-size: 11px;
    font-weight: 600;
    color: #818cf8;
    background: rgba(99,102,241,0.08);
    border: 1px solid rgba(99,102,241,0.2);
    border-left: none;
    cursor: pointer;
    white-space: nowrap;
    transition: background 160ms ease;
  }
  .settings-webhook-copy:hover { background: rgba(99,102,241,0.15); }
```

After:
```css
  .settings-webhook-copy {
    display: inline-flex;
    align-items: center;
    padding: 0 12px;
    border-radius: 0 8px 8px 0;
    font-size: 11px;
    font-weight: 600;
    color: #4f46e5;
    background: rgba(99,102,241,0.08);
    border: 1px solid rgba(99,102,241,0.2);
    border-left: none;
    cursor: pointer;
    white-space: nowrap;
    transition: background 160ms ease;
  }
  .settings-webhook-copy:hover { background: rgba(99,102,241,0.15); }
```

- [ ] **Step 2: Apply the `.settings-integ-card:hover` fix**

Before (globals.css:6162-6167):
```css
  .settings-integ-card:hover {
    border-color: rgba(99,102,241,0.28);
    background: rgba(12,21,38,0.85);
    box-shadow: 0 8px 28px rgba(0,0,0,0.2);
    transform: translateY(-2px);
  }
```

After:
```css
  .settings-integ-card:hover {
    border-color: rgba(99,102,241,0.28);
    background: #f8fafc;
    box-shadow: 0 8px 28px rgba(15,23,42,0.1);
    transform: translateY(-2px);
  }
```

- [ ] **Step 3: Confirm no change needed for `.settings-integ-card::before` and `.settings-integ-btn`**

`.settings-integ-card::before` background `rgba(255,255,255,0.03)` is a near-invisible white sheen artifact, harmless no-op on light — do not edit it. `.settings-integ-btn` color `#070d1a` (dark text on solid green gradient button) stays **unchanged** — matches the established "dark text on solid color chip" precedent. Do not edit it.

- [ ] **Step 4: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme settings integrations and webhook CSS for light theme"
```

---

### Task 7: Plan card and invoices CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:6255-6344,6401-6424`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.settings-plan-card`, `.settings-plan-upgrade-btn`, `.settings-invoice-*` rules.

- [ ] **Step 1: Apply the plan card CSS edits**

Before (globals.css:6254-6264):
```css
  /* Plan card */
  .settings-plan-card {
    background: linear-gradient(145deg, rgba(34,197,94,0.1) 0%, rgba(12,21,38,0.95) 48%, rgba(7,13,26,0.98) 100%);
    border: 1px solid rgba(34,197,94,0.25);
    border-radius: 16px;
    padding: 24px;
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(12px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.22);
  }
```

After:
```css
  /* Plan card */
  .settings-plan-card {
    background: linear-gradient(145deg, rgba(34,197,94,0.1) 0%, #ffffff 48%, #f8fafc 100%);
    border: 1px solid rgba(34,197,94,0.25);
    border-radius: 16px;
    padding: 24px;
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(12px);
    box-shadow: 0 12px 40px rgba(15,23,42,0.12);
  }
```

Before (globals.css:6328-6341):
```css
  .settings-plan-upgrade-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 8px 16px;
    border-radius: 9px;
    font-size: 12px;
    font-weight: 600;
    color: #4ade80;
    background: rgba(34,197,94,0.1);
    border: 1px solid rgba(34,197,94,0.22);
    cursor: pointer;
    transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
  }
```

After:
```css
  .settings-plan-upgrade-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 8px 16px;
    border-radius: 9px;
    font-size: 12px;
    font-weight: 600;
    color: #15803d;
    background: rgba(34,197,94,0.1);
    border: 1px solid rgba(34,197,94,0.22);
    cursor: pointer;
    transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
  }
```

- [ ] **Step 2: Apply the invoices CSS edits**

Before (globals.css:6401-6424):
```css
  .settings-invoice-amount {
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
    font-variant-numeric: tabular-nums;
  }
  .settings-invoice-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: #818cf8;
    background: rgba(99,102,241,0.08);
    border: 1px solid rgba(99,102,241,0.18);
    transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
    cursor: pointer;
  }
  .settings-invoice-link:hover {
    background: rgba(99,102,241,0.16);
    color: #a5b4fc;
    border-color: rgba(99,102,241,0.32);
  }
```

After:
```css
  .settings-invoice-amount {
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
  }
  .settings-invoice-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    color: #4f46e5;
    background: rgba(99,102,241,0.08);
    border: 1px solid rgba(99,102,241,0.18);
    transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
    cursor: pointer;
  }
  .settings-invoice-link:hover {
    background: rgba(99,102,241,0.16);
    color: #4f46e5;
    border-color: rgba(99,102,241,0.32);
  }
```

- [ ] **Step 3: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme settings plan card and invoices CSS for light theme"
```

---

### Task 8: Modals CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:6427-6531`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.settings-modal*` rules consumed by the password-change and WhatsApp-connect modals in `settings/page.tsx`.

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:6426-6453):
```css
  /* Modals */
  .settings-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(2,6,23,0.72);
    backdrop-filter: blur(8px);
    animation: settings-modal-overlay-in 200ms ease-out both;
  }
  @keyframes settings-modal-overlay-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .settings-modal {
    width: 100%;
    max-width: 440px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: rgba(12,21,38,0.96);
    border: 1px solid rgba(99,102,241,0.22);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.45);
    animation: settings-modal-in 240ms ease-out both;
  }
```

After:
```css
  /* Modals */
  .settings-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(15,23,42,0.25);
    backdrop-filter: blur(8px);
    animation: settings-modal-overlay-in 200ms ease-out both;
  }
  @keyframes settings-modal-overlay-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .settings-modal {
    width: 100%;
    max-width: 440px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border: 1px solid var(--c-border);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(15,23,42,0.16);
    animation: settings-modal-in 240ms ease-out both;
  }
```

Before (globals.css:6461-6474):
```css
  .settings-modal-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 20px 22px 16px;
    border-bottom: 1px solid rgba(26,45,71,0.8);
    background: rgba(255,255,255,0.02);
  }
  .settings-modal-title {
    font-size: 16px;
    font-weight: 600;
    color: #f1f5f9;
    letter-spacing: -0.02em;
  }
```

After:
```css
  .settings-modal-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 20px 22px 16px;
    border-bottom: 1px solid var(--c-border);
    background: rgba(15,23,42,0.02);
  }
  .settings-modal-title {
    font-size: 16px;
    font-weight: 600;
    color: #0f172a;
    letter-spacing: -0.02em;
  }
```

Before (globals.css:6492-6510):
```css
  .settings-modal-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 9px;
    color: #64748b;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    cursor: pointer;
    transition: color 160ms ease, background 160ms ease, border-color 160ms ease;
    flex-shrink: 0;
  }
  .settings-modal-close:hover {
    color: #f1f5f9;
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.12);
  }
```

After:
```css
  .settings-modal-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 9px;
    color: #64748b;
    background: rgba(15,23,42,0.04);
    border: 1px solid var(--c-border);
    cursor: pointer;
    transition: color 160ms ease, background 160ms ease, border-color 160ms ease;
    flex-shrink: 0;
  }
  .settings-modal-close:hover {
    color: #0f172a;
    background: rgba(15,23,42,0.08);
    border-color: var(--c-s3);
  }
```

Before (globals.css:6525-6531):
```css
  .settings-modal-footer {
    display: flex;
    gap: 10px;
    padding: 16px 22px 20px;
    border-top: 1px solid rgba(26,45,71,0.8);
    background: rgba(7,13,26,0.5);
  }
```

After:
```css
  .settings-modal-footer {
    display: flex;
    gap: 10px;
    padding: 16px 22px 20px;
    border-top: 1px solid var(--c-border);
    background: #f8fafc;
  }
```

- [ ] **Step 2: Confirm no change needed for `.settings-modal-desc` and `.settings-modal-lg`**

`.settings-modal-desc` (`#64748b`, already correct) and `.settings-modal-lg` (layout-only, no color) stay unchanged.

- [ ] **Step 3: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme settings modals CSS for light theme"
```

---

### Task 9: Verification sweep + final project-wide summary

**Files:** none modified — read-only verification task.

- [ ] **Step 1: Grep for remaining dark literals in the Settings scope**

Run:
```bash
grep -n "rgba(7,13,26\|rgba(12,21,38\|rgba(15,23,42\|rgba(2,6,23\|rgba(17,30,50\|rgba(51,65,85\|rgba(26,45,71\|rgba(255,255,255\|#f87171\|#4ade80\|#e2e8f0\|#f1f5f9\|#818cf8\|#a5b4fc\|#334155\|#475569\b" apps/web/src/app/globals.css | awk -F: '$1 >= 5529 && $1 <= 6575'
```
Expected: no matches within the `.settings-*` block (5529-6575) except intentionally-kept decorative accent tints (e.g. `rgba(99,102,241,X)` indigo glass effects on `.settings-avatar`/`.settings-2fa-icon`, which the spec explicitly keeps unchanged). Review any hit against the spec before treating it as a gap.

Run:
```bash
grep -n "text-slate-400\|text-red-400\|text-green-400\|text-rose-400\|text-amber-400\|text-\[#e2e8f0\]\|text-\[#f1f5f9\]\|text-\[#f87171\]\|text-\[#4ade80\]\|text-\[#334155\]\|text-\[#475569\]\|border-\[#334155\]" "apps/web/src/app/(dashboard)/settings/page.tsx"
```
Expected: no matches.

- [ ] **Step 2: Full build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed cleanly.

- [ ] **Step 3: Final project-wide sweep for visibility**

Run a broad grep across `apps/web/src/app` and `apps/web/src/components` for common dark-theme literal patterns (`rgba(15,23,42`, `rgba(12,21,38`, `text-white`, `bg-slate-900`, `bg-slate-800`) and compile a short summary of which routes/files still show matches. Compare against the known-and-accepted out-of-scope list: Login/Register/`AuthShell`, Agent (`agent/persona`, `agent/rules`, `agent/knowledge`), Onboarding (`setup/*` + its layout), Analytics, Overview, Inbox. Report any match OUTSIDE this list to the user as a surprise finding requiring a decision, rather than silently ignoring it.

- [ ] **Step 4: Update the progress ledger**

Append to `.superpowers/sdd/progress.md`:
```
Phase 2.6 (Settings, FINAL): Tasks 1-8 complete, verification sweep clean (grep + build + lint). Project-wide sweep confirms only the pre-agreed out-of-scope routes (Login/Register/AuthShell, Agent, Onboarding, Analytics, Overview, Inbox) remain dark.
```

- [ ] **Step 5: No commit for this task**

This is a verification-only task; nothing to commit unless Step 1 finds a gap, in which case fix it under the relevant earlier task's commit message pattern before re-running the sweep.
