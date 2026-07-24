# Remover Dark Theme + Identidade PrevConsulta (verde) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover o tema escuro residual (landing, login, register, AuthShell), eliminar Fraunces, e reskinizar primitives do dashboard no padrão PrevConsulta com verde `#22C55E` como primária.

**Architecture:** CSS-first. Tokens `--c-*` e classes nomeadas em `apps/web/src/app/globals.css` (`@layer components` + bloco `.lp-*` fora do layer). Poucos TSX com cores hardcoded (`AuthShell`, login, register, `layout`, headline da landing). Sem migração semântica Tailwind e sem `next-themes`.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS v4 (`@import "tailwindcss"`), Outfit self-hosted, Lucide.

**Testing approach note:** Restyle visual sem lógica de negócio — sem unit tests. Cada task valida com (a) `grep`/`rg` comprovando valores antigos sumiram, (b) `pnpm --filter @whatsagent/web build` quando o task toca config/CSS amplo. Task final = QA visual manual nas rotas listadas.

**Spec:** `docs/superpowers/specs/2026-07-23-remover-dark-theme-identidade-prevconsulta-design.md`

## Global Constraints

- Primária: `#22C55E` / `#22c55e`; escala `--c-green-dark #16A34A`, `--c-green-tint #E9F9EF`, `--c-green-ink #166534`.
- Indigo `#6366F1` / `#6366f1` só como acento de IA (`--c-indigo`, `--kpi-accent` explícito).
- `.tag` vira pílula globalmente (`border-radius: 9999px`).
- Não normalizar hex literais de marca nos ~32 arquivos (débito técnico).
- Não mexer em `RouteErrorFallback` / `ErrorBoundary` (`#020617` só no texto do CTA).
- Não mexer em `EmojiPickerPanel` `Theme.DARK`.
- Edits exatos em `globals.css` — preservar whitespace onde possível; não reformatar o arquivo inteiro.
- Entrega: Fases 0–3 no working tree; commits atômicos por task.

## File map

| File | Responsibility |
|------|----------------|
| `apps/web/src/app/globals.css` | Tokens, `.kpi`, `.nav-item`, `.tag`, `.delta`, `.modal-panel`, headers de tabela, bloco `.lp-*` |
| `apps/web/tailwind.config.ts` | Remover darkMode + tokens mortos; primary verde |
| `apps/web/src/app/layout.tsx` | Remover Fraunces |
| `apps/web/src/components/auth/AuthShell.tsx` | Shell auth light, sem orbs |
| `apps/web/src/app/(public)/login/page.tsx` | Inputs/CTAs light |
| `apps/web/src/app/(public)/register/page.tsx` | Inputs/CTAs light |
| `apps/web/src/app/page.tsx` | Headline sem serifa |

---

### Task 1: Tokens verdes + limpeza do Tailwind

**Files:**
- Modify: `apps/web/src/app/globals.css` (`:root`, ~linhas 13–26)
- Modify: `apps/web/tailwind.config.ts`

**Interfaces:**
- Produces: `--c-green-dark`, `--c-green-tint`, `--c-green-ink` para Tasks 4–6
- Produces: `primary.DEFAULT/dim` alinhados ao verde; sem `darkMode`/`surface`/`muted`/`border`/`background`/`foreground` mortos

- [ ] **Step 1: Estender `:root` em `globals.css`**

No bloco `:root` existente, após `--c-green: #22c55e;`, adicionar:

```css
    --c-green-dark: #16A34A;
    --c-green-tint: #E9F9EF;
    --c-green-ink:  #166534;
```

Manter `--c-indigo: #6366f1;` sem alteração.

- [ ] **Step 2: Reescrever `tailwind.config.ts`**

Substituir o arquivo inteiro por:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Outfit", "sans-serif"] },
      colors: {
        primary: { DEFAULT: "#22C55E", foreground: "#ffffff", dim: "#16A34A" },
        accent: { DEFAULT: "#6366F1", foreground: "#ffffff", dim: "#4F46E5" },
      },
      borderRadius: { lg: "12px", md: "8px", sm: "6px" },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

export default config;
```

- [ ] **Step 3: Verificar tokens mortos e build**

Run:

```bash
rg "bg-background|text-foreground|border-border|bg-surface-|bg-muted|darkMode" apps/web/src apps/web/tailwind.config.ts
pnpm --filter @whatsagent/web build
```

Expected: zero matches de call sites dos tokens removidos; build OK (ou só warnings pré-existentes).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/tailwind.config.ts
git commit -m "feat(web): add green brand tokens and drop dead dark Tailwind colors"
```

---

### Task 2: AuthShell light (sem orbs)

**Files:**
- Modify: `apps/web/src/components/auth/AuthShell.tsx`

**Interfaces:**
- Consumes: nenhum token novo obrigatório (Tailwind slate/white)
- Produces: shell claro reutilizado por login/register

- [ ] **Step 1: Substituir `AuthShell.tsx` pelo conteúdo light**

```tsx
import Link from "next/link";
import { MessageSquare } from "lucide-react";

function BrandMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="relative hidden w-[46%] min-w-[430px] overflow-hidden border-r border-slate-200 bg-white lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C55E]/15 text-[#22C55E]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">WhatsAgent</p>
                <p className="text-sm text-slate-500">Atendimento IA no WhatsApp</p>
              </div>
            </div>

            <h1 className="mt-12 max-w-md text-4xl font-bold leading-tight text-slate-900">
              Venda e atenda clientes com IA, sem perder o controle humano.
            </h1>
            <p className="mt-4 max-w-md text-slate-500">
              Plataforma multi-tenant para operação de WhatsApp com handoff, catálogo e analytics.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-4">
              <BrandMetric value="24/7" label="Respostas automáticas" />
              <BrandMetric value="98%" label="Satisfação média" />
              <BrandMetric value="3x" label="Mais conversões" />
            </div>
          </div>

          <p className="relative z-10 text-sm text-slate-500">
            © {new Date().getFullYear()} WhatsAgent. Todos os direitos reservados.
          </p>
        </aside>

        <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#22C55E]/15 text-[#22C55E]">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <p className="text-lg font-semibold text-slate-900">WhatsAgent</p>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900">{title}</h2>
              <p className="mt-2 text-slate-500">{subtitle}</p>
            </div>

            {children}
            {footer}
          </div>
        </main>
      </div>
    </div>
  );
}

export function AuthLinkFooter({
  text,
  linkText,
  href,
}: {
  text: string;
  linkText: string;
  href: string;
}) {
  return (
    <p className="mt-8 text-center text-sm text-slate-500">
      {text}{" "}
      <Link href={href} className="font-medium text-[#22C55E] hover:underline">
        {linkText}
      </Link>
    </p>
  );
}
```

- [ ] **Step 2: Grep residual dark no AuthShell**

Run: `rg "020617|white/10|white/5|blur-3xl|slate-50\"|bg-\[#020617\]" apps/web/src/components/auth/AuthShell.tsx`

Expected: zero matches de chrome escuro/orbs (`020617`, `white/10`, orbs).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/auth/AuthShell.tsx
git commit -m "feat(web): restyle AuthShell to light PrevConsulta-like layout"
```

---

### Task 3: Login + Register light

**Files:**
- Modify: `apps/web/src/app/(public)/login/page.tsx`
- Modify: `apps/web/src/app/(public)/register/page.tsx`

**Interfaces:**
- Consumes: AuthShell light (Task 2)

- [ ] **Step 1: Aplicar mapeamento de classes em ambos os arquivos**

Substituir em **todo** o arquivo (replace_all onde seguro):

| De | Para |
|----|------|
| `border-white/10 bg-slate-900/80` | `border-slate-200 bg-white text-slate-900` |
| `border-white/10 bg-slate-900/60` | `border-slate-200 bg-white` |
| `border border-white/10 bg-slate-900/60` | `border border-slate-200 bg-white` |
| `text-sm text-slate-300` (labels) | `text-sm text-slate-600` |
| `text-slate-400 hover:text-white` | `text-slate-500 hover:text-slate-900` |
| `text-slate-200 hover:bg-white/5` | `text-slate-700 hover:bg-slate-50` |
| `border-white/20 bg-slate-900` | `border-slate-300 bg-white` |
| `hover:text-slate-300` (toggle senha) | `hover:text-slate-700` |
| `bg-white/10` (dividers) | `bg-slate-200` |
| `text-slate-100 hover:bg-white/5` | `text-slate-700 hover:bg-slate-50` |
| `text-slate-300 hover:underline` (termos) | `text-slate-600 hover:underline` |
| `text-sm text-slate-300` (caixa sent) | `text-sm text-slate-600` |

Manter: `bg-[#22C55E]`, `text-[#020617]` nos CTAs verdes, `ring-[#22C55E]/40`, `accent-[#22C55E]`.

Trocar o link “Esqueci a senha” de `text-[#6366F1]` para `text-[#22C55E]` (CTA/link primário verde).

Inputs finais devem seguir o padrão:

```tsx
className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-slate-900 outline-none ring-[#22C55E]/40 focus:ring-2"
```

Botão Google:

```tsx
className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
```

- [ ] **Step 2: Grep dark residual**

Run:

```bash
rg "slate-900/|white/10|white/5|border-white" apps/web/src/app/(public)/login/page.tsx apps/web/src/app/(public)/register/page.tsx
```

Expected: zero matches.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(public)/login/page.tsx" "apps/web/src/app/(public)/register/page.tsx"
git commit -m "feat(web): restyle login and register forms for light theme"
```

---

### Task 4: Landing `.lp-*` light + headline Outfit

**Files:**
- Modify: `apps/web/src/app/globals.css` (bloco `/* ── Landing Page` até antes de `/* ── Product Card`)
- Modify: `apps/web/src/app/page.tsx` (span do headline)

**Interfaces:**
- Consumes: tokens `--c-base`, `--c-text`, `--c-muted`, `--c-subtle`, `--c-border`, `--c-green*`
- Produces: landing light; remove dependência visual de Fraunces no headline (classe CSS Fraunces removida na Task 5)

**Mapping recipe (aplicar no bloco `.lp-*` apenas):**

| Padrão dark | Light |
|-------------|-------|
| `background: #020617` / `rgba(2,6,23,*)` de superfície | `var(--c-base)` / `#ffffff` / `rgba(255,255,255,*)` |
| `color: #f1f5f9` / `#e2e8f0` / `#f8fafc` (texto) | `var(--c-text)` / `#0f172a` / `#1e293b` |
| `color: #94a3b8` (links/muted em dark chrome) | `var(--c-muted)` / `#64748b` |
| `color: #4ade80` (badge text em dark) | `var(--c-green-ink)` / `#15803d` |
| Nav `rgba(2,6,23,0.72)` | `rgba(255,255,255,0.85)` + `border: 1px solid var(--c-border)` |
| Card `rgba(15,23,42,0.6\|0.85\|0.9)` | `#ffffff` |
| Hover card `rgba(0,0,0,0.5)` shadow pesada | `0 20px 40px -16px rgba(15,23,42,0.12)` |
| Orbs | verde dominante `rgba(34,197,94,0.10)`, indigo `rgba(99,102,241,0.06)`, amarelo ↓ |

**Manter:** `.lp-btn-primary` gradiente verde; `.lp-plan-badge` / `.lp-plan-cta-highlight` com `color: #020617` no botão verde; animações (respeitar `prefers-reduced-motion` já existente).

- [ ] **Step 1: Atualizar chrome raiz + nav + orbs**

Substituir as regras iniciais do bloco landing por valores light. Trechos-alvo (valores finais):

```css
.lp-root {
  min-height: 100vh; background: var(--c-base); color: var(--c-text);
  font-family: var(--font-ui);
  overflow-x: hidden; position: relative; isolation: isolate;
}
.lp-orb-1 { width: 640px; height: 640px; top: -220px; left: -220px; background: radial-gradient(circle, rgba(34,197,94,0.10) 0%, transparent 70%); }
.lp-orb-2 { width: 560px; height: 560px; bottom: 160px; right: -140px; background: radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%); animation-delay: -8s; animation-duration: 26s; }
.lp-orb-3 { width: 420px; height: 420px; top: 45%; left: 55%; background: radial-gradient(circle, rgba(251,191,36,0.04) 0%, transparent 70%); animation-delay: -14s; animation-duration: 30s; }
.lp-nav {
  position: fixed; top: 16px; left: 50%; transform: translateX(-50%); width: calc(100% - 48px); max-width: 1100px; z-index: 50;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(20px) saturate(140%); -webkit-backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid var(--c-border); border-radius: 14px; padding: 10px 20px;
  box-shadow: 0 12px 40px -16px rgba(15,23,42,0.12);
}
.lp-logo { /* ... */ color: var(--c-text); /* resto igual */ }
.lp-nav-links a { /* ... */ color: var(--c-muted); }
.lp-nav-links a:hover { color: var(--c-text); }
.lp-btn-ghost { /* ... */ color: var(--c-muted); border: 1px solid var(--c-border); }
.lp-btn-ghost:hover { color: var(--c-text); border-color: var(--c-s3); background: rgba(15,23,42,0.04); }
.lp-btn-outline { /* ... */ color: var(--c-muted); border: 1px solid var(--c-border); }
.lp-btn-outline:hover { color: var(--c-text); border-color: var(--c-s3); background: rgba(15,23,42,0.04); }
```

Manter `.lp-btn-primary` como está (gradiente verde + `color: #020617`).

- [ ] **Step 2: Hero, stats, chat mock, features, plans, CTA, footer**

Aplicar a mapping recipe em todas as regras `.lp-*` restantes no bloco. Valores finais críticos:

```css
.lp-badge { /* ... */ color: var(--c-green-ink); border: 1px solid rgba(34,197,94,0.25); background: var(--c-green-tint); }
.lp-headline { /* ... */ color: var(--c-text); }
.lp-stat { /* ... */ background: #ffffff; }
.lp-stat-value { /* ... */ color: var(--c-text); }
.lp-stats-bar { /* ... */ background: var(--c-border); border: 1px solid var(--c-border); }
.lp-chat-wrap {
  background: #ffffff; border: 1px solid var(--c-border); border-radius: 20px; overflow: hidden;
  box-shadow: 0 24px 64px rgba(15,23,42,0.12), 0 0 0 1px rgba(99,102,241,0.08);
  /* manter perspective/animation */
}
.lp-chat-name { color: var(--c-text); }
.lp-chat-status { color: var(--c-green-ink); }
.lp-msg-bot { /* ... */ color: var(--c-text); background: rgba(99,102,241,0.08); }
.lp-msg-user { /* ... */ color: var(--c-text); }
.lp-pix-badge { color: var(--c-green-ink); }
.lp-section-title { color: var(--c-text); }
.lp-feature-card {
  --glow: #6366F1; position: relative; padding: 28px; background: #ffffff;
  border: 1px solid var(--c-border); border-radius: 16px; overflow: hidden;
  /* transitions iguais */
}
.lp-feature-card:hover { background: #ffffff; transform: translateY(-4px); box-shadow: 0 20px 40px -16px rgba(15,23,42,0.12); border-color: transparent; }
.lp-feature-title { color: var(--c-text); }
.lp-step-title { color: var(--c-text); }
.lp-plan-card { background: #ffffff; border: 1px solid var(--c-border); /* resto */ }
.lp-plan-highlight { background: #ffffff !important; /* manter glow verde */ }
.lp-plan-name { color: var(--c-text); }
.lp-plan-amount { font-family: var(--font-ui), "Outfit", sans-serif; font-size: 44px; font-weight: 700; color: var(--c-text); letter-spacing: -0.03em; line-height: 1; }
.lp-plan-currency { color: var(--c-muted); }
.lp-plan-features li { color: var(--c-muted); }
.lp-plan-cta { background: var(--c-green-tint); border: 1px solid rgba(34,197,94,0.25); color: var(--c-green-ink); }
.lp-plan-cta:hover { background: rgba(34,197,94,0.18); border-color: rgba(34,197,94,0.4); color: var(--c-green-ink); }
.lp-cta-title { font-family: var(--font-ui), "Outfit", sans-serif; font-style: normal; font-size: clamp(32px, 4.4vw, 52px); font-weight: 700; letter-spacing: -0.02em; color: var(--c-text); margin: 0; line-height: 1.14; }
.lp-footer-links a:hover { color: var(--c-text); }
```

- [ ] **Step 3: Headline em `page.tsx`**

Trocar:

```tsx
<span className="lp-headline-serif">você dorme</span>
```

por:

```tsx
<span className="lp-gradient-text">você dorme</span>
```

- [ ] **Step 4: Grep dark residual no bloco landing**

Run:

```bash
rg "#020617|rgba\(2,6,23|#f1f5f9|#e2e8f0|lp-headline-serif|font-fraunces" apps/web/src/app/globals.css apps/web/src/app/page.tsx
```

Expected: `#020617` só onde é texto sobre botão verde (`.lp-btn-primary`, `.lp-plan-badge`, `.lp-pix-icon`, `.lp-plan-cta-highlight`); zero `lp-headline-serif` / `font-fraunces` em page.tsx; superfícies `#020617`/`rgba(2,6,23` de fundo sumidas.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/page.tsx
git commit -m "feat(web): restyle landing page to light theme with Outfit headline"
```

---

### Task 5: Remover Fraunces

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/globals.css` (apagar `.lp-headline-serif` se ainda existir)

**Interfaces:**
- Consome: Task 4 já removeu usos de Fraunces em plan amount / CTA title / headline

- [ ] **Step 1: Limpar `layout.tsx`**

Remover:

```ts
import { Fraunces } from "next/font/google";
```

e o bloco:

```ts
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
});
```

Body fica:

```tsx
<body className="bg-[#f8fafc] text-slate-900 antialiased">
```

- [ ] **Step 2: Remover regra `.lp-headline-serif` de `globals.css`** se ainda existir.

- [ ] **Step 3: Grep Fraunces**

Run: `rg -i "fraunces|font-fraunces|lp-headline-serif" apps/web`

Expected: zero matches.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/globals.css
git commit -m "refactor(web): remove Fraunces font from landing and root layout"
```

---

### Task 6: Dashboard primitives (nav, KPI, tag, delta, modal)

**Files:**
- Modify: `apps/web/src/app/globals.css` (`.kpi*`, `.delta*`, `.nav-item.active`, `.tag*`, `.modal-panel`)

**Interfaces:**
- Consumes: `--c-green-tint`, `--c-green-ink`, `--c-green` (Task 1)
- Preserva: `--kpi-accent` / `--kpi-accent-glow` quando setados por `KpiCard` (default accent prop ainda pode ser indigo nos call sites de IA)

- [ ] **Step 1: `.kpi` flat + glow verde default**

Substituir o bloco `.kpi` / hover / icon-wrap:

```css
  .kpi {
    background: #ffffff;
    border: 1px solid var(--c-border);
    border-radius: 16px;
    padding: 16px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease, transform 200ms ease;
    position: relative;
    overflow: hidden;
    cursor: default;
  }
  .kpi::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.025) 0%, transparent 55%);
    pointer-events: none;
  }
  .kpi:hover {
    border-color: color-mix(in srgb, var(--kpi-accent, #22c55e) 35%, var(--c-border));
    background: var(--c-s2);
    box-shadow: 0 4px 20px var(--kpi-accent-glow, rgba(34,197,94,0.08));
  }
  .kpi-accent::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--kpi-accent, var(--c-green)), transparent 80%);
    opacity: 0.7;
    border-radius: 16px 16px 0 0;
    transition: opacity 200ms ease;
  }
  .kpi:hover.kpi-accent::before { opacity: 1; }
  .kpi:hover .kpi-icon-wrap {
    border-color: color-mix(in srgb, var(--kpi-accent, #22c55e) 50%, var(--c-border));
    box-shadow: 0 0 14px var(--kpi-accent-glow, rgba(34,197,94,0.2));
    background: var(--kpi-accent-glow, rgba(34,197,94,0.08));
  }
```

(manter `.kpi-sparkline` e `.kpi-icon-wrap` base; só o hover do icon-wrap muda o fallback)

- [ ] **Step 2: `.delta` pílula + cores light-legíveis**

```css
  .delta {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 9999px;
    width: fit-content;
  }
  .delta-up   { color: #15803d; background: rgba(34,197,94,0.12); }
  .delta-down { color: #b91c1c; background: rgba(239,68,68,0.12); }
  .delta-none { color: var(--c-muted); background: rgba(100,116,139,0.12); }
```

- [ ] **Step 3: `.nav-item.active` tint verde**

```css
  .nav-item.active {
    color: var(--c-green-ink);
    background: var(--c-green-tint);
    box-shadow: inset 2px 0 0 var(--c-green);
  }
  .nav-item.active svg { color: var(--c-green); }
```

Não alterar `.nav-item-admin*`.

- [ ] **Step 4: `.tag` pílula**

```css
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 500;
  }
```

Manter variantes `.tag-green` etc. como estão (já light-legíveis).

- [ ] **Step 5: `.modal-panel` radius 16px**

```css
  .modal-panel {
    width: 100%;
    background: #ffffff;
    border: 1px solid var(--c-border);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(15,23,42,0.18);
    animation: modal-slide-up 240ms ease-out;
    max-height: calc(100vh - 32px);
    display: flex;
    flex-direction: column;
  }
```

- [ ] **Step 6: Grep checks**

Run:

```bash
rg "backdrop-filter: blur\(8px\)|rgba\(99,102,241,0\.08\)|border-radius: 4px" apps/web/src/app/globals.css
```

Expected: `.kpi` sem `backdrop-filter: blur(8px)`; `.nav-item.active` sem tint indigo `rgba(99,102,241,0.08)`; `.tag`/`.delta` sem `border-radius: 4px`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): restyle dashboard nav, KPI, tags and modals to PrevConsulta green"
```

---

### Task 7: Headers de tabela (orders, catalog, admin)

**Files:**
- Modify: `apps/web/src/app/globals.css` (`.orders-table-head`, `.orders-th`, `.product-list-header`, `.super-admin-table-head th`)

**Interfaces:**
- Alinha ao padrão PrevConsulta: `bg-slate-50`, uppercase, tracking, texto muted

- [ ] **Step 1: Orders header**

```css
  .orders-table-head {
    display: grid;
    grid-template-columns: 96px 1fr 1fr 100px 130px 110px 48px;
    align-items: center;
    padding: 0 16px;
    height: 38px;
    border-bottom: 1px solid var(--c-border);
    background: #f8fafc;
    flex-shrink: 0;
  }
  .orders-th {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--c-subtle);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
```

- [ ] **Step 2: Product list header**

```css
.product-list-header {
  font-size: 11px;
  font-weight: 700;
  color: var(--c-subtle);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #f8fafc;
}
```

- [ ] **Step 3: Super-admin table head (alinhar se divergir)**

Garantir:

```css
  .super-admin-table-head th {
    padding: 10px 16px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--c-subtle);
    background: #f8fafc;
    border-bottom: 1px solid var(--c-border);
  }
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): align table headers with PrevConsulta slate-50 pattern"
```

---

### Task 8: Build + QA visual

**Files:** nenhum (verificação)

- [ ] **Step 1: Build**

Run: `pnpm --filter @whatsagent/web build`

Expected: success.

- [ ] **Step 2: Grep gates finais**

```bash
rg -i "fraunces|font-fraunces|lp-headline-serif" apps/web
rg "darkMode|bg-background|text-foreground|border-border|colors\.surface|colors\.muted" apps/web/tailwind.config.ts
rg "bg-\[#020617\]|min-h-screen bg-\[#020617\]" apps/web/src
rg "backdrop-filter: blur\(8px\)" apps/web/src/app/globals.css
```

Expected:
- Fraunces: zero
- Tailwind morto: zero
- `bg-[#020617]` em AuthShell/landing root: zero (CTAs com `text-[#020617]` ok)
- KPI blur 8px: zero

- [ ] **Step 3: QA visual manual** (`pnpm --filter @whatsagent/web dev`)

Checklist:
- [ ] `/` — fundo claro, nav clara, headline Outfit+gradiente, CTA verde
- [ ] `/login` — shell claro, inputs brancos, sem orbs
- [ ] `/register` — idem
- [ ] `/overview` — sidebar ativo tint verde; KPIs `rounded-2xl` flat; deltas pílula
- [ ] `/crm` — tags/status em pílula se usarem `.tag`
- [ ] `/orders` ou `/catalog` — header tabela `bg-slate-50` uppercase
- [ ] Abrir um modal — radius 16px

- [ ] **Step 4: Commit vazio não necessário** — se só docs/plan pendentes, não commitar. Se houver fixups do QA, commit:

```bash
git commit -m "fix(web): polish light theme contrast after visual QA"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Tokens `--c-green-dark/tint/ink` | Task 1 |
| Tailwind limpeza + primary verde | Task 1 |
| AuthShell light, sem orbs | Task 2 |
| Login/register light | Task 3 |
| Landing `.lp-*` light | Task 4 |
| Headline Outfit / gradient | Task 4 |
| Remover Fraunces | Task 5 (+ plan amount/CTA title na Task 4) |
| Nav ativo verde | Task 6 |
| KPI flat 16px, glow verde default | Task 6 |
| `.tag` pílula global | Task 6 |
| `.delta` pílula + cores legíveis | Task 6 |
| Modal 16px | Task 6 |
| Table headers PrevConsulta | Task 7 |
| Verificação build + visual | Task 8 |
| Out of scope (hex literais, ErrorBoundary, EmojiPicker) | Não há task — correto |

Sem placeholders TBD. Nomes de tokens consistentes entre tasks.
