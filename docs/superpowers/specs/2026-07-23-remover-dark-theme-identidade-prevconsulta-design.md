# Remover tema dark e adotar identidade PrevConsulta (verde primário)

## Goal

Eliminar o tema escuro residual em `apps/web` (landing, login, register, `AuthShell`) e alinhar o dashboard à linguagem visual do PrevConsulta (`rounded-2xl`, cards flat sem glass, badges em pílula, tabelas com header `bg-slate-50`, nav ativo em tint pastel da marca) — com **verde `#22C55E` como cor dominante** e indigo `#6366F1` apenas como acento de UI de IA.

Não existe dark/light toggle (`next-themes` / `ThemeProvider` / classes `dark:`). O `darkMode: "class"` do Tailwind é código morto. A abordagem é **CSS-first**: tokens + classes nomeadas em `globals.css`, com poucos TSX tocados.

## Decisions locked

| Decisão | Escolha |
|---------|---------|
| Escopo | Remover dark **e** reskin do dashboard (não só as 4 telas) |
| Primária | `#22C55E` + escala dark/tint/ink |
| Indigo | Mantém para IA; não monocromático verde |
| Fonte | Remover Fraunces; headline só Outfit |
| Badges | `.tag` globalmente → pílula (`rounded-full`) |
| Entrega | Tudo no working tree (Fases 0–3); PRs opcionais depois |
| Abordagem | CSS-first (opção 1) — sem migração semântica Tailwind |

## Out of scope

- Normalizar hex literais `#22C55E` / `#6366F1` nos ~32/~25 arquivos (débito técnico)
- Consolidação completa de botões
- `RouteErrorFallback` / `ErrorBoundary` com `#020617` só no texto do CTA verde (contraste, não superfície)
- `EmojiPickerPanel` `Theme.DARK` (picker, não chrome do app)
- Reestruturação de CRM kanban / páginas de feature além das classes CSS compartilhadas

## Architecture approach

Editar a camada de design já existente:

1. **Tokens** (`:root` + `tailwind.config.ts`) — base para tint verde e limpeza de tokens mortos
2. **Superfícies públicas** (`.lp-*`, AuthShell, login, register) — light
3. **Fraunces** — remoção completa
4. **Dashboard primitives** (`.nav-item`, `.kpi`, `.tag`, `.delta`, `.modal-panel`, headers de tabela) — padrão PrevConsulta + verde

Sequência obrigatória: Fase 0 → 1 → 2 → 3.

---

## Fase 0 — Tokens

### `globals.css` `:root`

Manter nomes `--c-*` existentes. Adicionar:

| Token | Valor | Uso |
|-------|--------|-----|
| `--c-green-dark` | `#16A34A` | hover / dim |
| `--c-green-tint` | `#E9F9EF` | nav ativo, soft surfaces (análogo `#EDF5FC` PrevConsulta) |
| `--c-green-ink` | `#166534` | texto sobre tint (análogo `#2A6599`) |

Manter `--c-indigo: #6366f1` sem alteração.

### `tailwind.config.ts`

- Remover `darkMode: "class"`
- Remover `colors.border`, `background`, `foreground` (apontam para vars inexistentes; zero uso)
- Remover `colors.surface`, `colors.muted` (tons escuros hardcoded; zero uso)
- `primary`: `DEFAULT #22C55E`, `dim #16A34A`, `foreground #ffffff`
- `accent`: permanece indigo

Verificação: `pnpm --filter @whatsagent/web build`; grep sem referências aos tokens removidos.

---

## Fase 1 — Remover dark (4 superfícies)

### Landing (`.lp-*` em `globals.css`)

- Fundo `#020617` → `var(--c-base)` / branco; texto → `var(--c-text)` / `var(--c-muted)` / `var(--c-subtle)`
- Nav: glass escuro → `rgba(255,255,255,0.85)` + `border: 1px solid var(--c-border)`; sombra mais leve
- Orbs: verde dominante + indigo secundário, opacidade reduzida
- `.lp-btn-primary` (gradiente verde) e badges de plano: manter
- Cards/features/planos: `bg-white` + borda slate, sem glass escuro
- Enumerar hex/rgba escuros no bloco `.lp-*` via grep e substituir sistematicamente

### `page.tsx`

- Sem reescrita estrutural
- Remover `lp-headline-serif` do span “você dorme”; aplicar `lp-gradient-text` (Outfit + gradiente)

### Login / Register

- `bg-slate-900/80|60` → `bg-white` + `border-slate-200`
- `border-white/10` → `border-slate-200`
- `text-white` → `text-slate-900`; `text-slate-400/300/100` → hierarquia slate clara
- Focus ring / CTA: verde (`#22C55E`); texto do botão `#020617` ok (contraste)

### `AuthShell.tsx`

- `bg-[#020617]` → `bg-slate-50`; aside claro
- Cards métricas: `bg-white` + `border border-slate-200` (flat, sem glass)
- **Remover orbs decorativos** (PrevConsulta não tem)
- Footer / subtítulos: `text-slate-500`

Verificação visual: `/`, `/login`, `/register` — sem fundo preto; CTA verde dominante.

---

## Fase 2 — Remover Fraunces

- `layout.tsx`: remover import, config e `${fraunces.variable}` do `<body>`
- `globals.css`: remover regra `.lp-headline-serif`
- `page.tsx`: classe trocada na Fase 1
- Grep case-insensitive `fraunces` → zero resultados

---

## Fase 3 — Reskin dashboard

### Sidebar

`.nav-item.active`:

- `background: var(--c-green-tint)`
- `color: var(--c-green-ink)`
- Manter `box-shadow: inset 2px 0 0 var(--c-green)`
- Ícone SVG: `var(--c-green)`

Admin nav (laranja) permanece distinto — não forçar verde.

### KPI (`.kpi`)

- `border-radius: 16px` (`rounded-2xl`)
- Remover `backdrop-filter: blur(8px)` em repouso
- Fallback de hover glow / icon wrap: verde (`rgba(34,197,94,0.08)` etc.) em vez de indigo
- Preservar `--kpi-accent` / `--kpi-accent-glow` quando passados explicitamente (KPIs de IA)

### Tags (`.tag`) — opção A

- `border-radius: 9999px`
- Padding ~`2px 10px` (pílula)
- Variantes de cor (`.tag-green` etc.) mantêm tint/ink legíveis no light

### Delta (`.delta`)

- Mesma pílula (`border-radius: 9999px`)
- Cores light-legíveis: up `#15803d` (não `#4ade80`); down vermelho escuro (`#b91c1c` / similar)

### Modais (`.modal-panel`)

- `border-radius: 16px`
- Sombra atual mantida (overlays OK no PrevConsulta)

### Tabelas / listas

Alinhar headers ao padrão PrevConsulta (`bg-slate-50`, uppercase 10–11px, tracking, texto `slate-400`/`subtle`):

- `.orders-table-head` / `.orders-th`
- `.product-list-header` (e container da lista se precisar `rounded-2xl border`)
- `.super-admin-table-head` (já próximo; só alinhar se divergir)

Linhas: `border-b` suave; `last:border-b-0` onde aplicável via CSS existente.

### Botões

Só garantir CTAs de alto tráfego já cobertos (landing, login/register, primários de modal) — sem refactor global.

Verificação visual: `/overview`, `/inbox`, `/crm`, `/orders` ou `/catalog`, abrir um modal.

---

## Error handling / testing

- Sem testes visuais automatizados no projeto
- Verificação: `pnpm --filter @whatsagent/web build` + `dev` nas rotas listadas
- Sem mudança de comportamento de runtime além de CSS/classes — sem novos testes unitários obrigatórios

## Risks

| Risco | Mitigação |
|-------|-----------|
| Tint verde imperfeito | Valores fixados na spec; ajuste fino visual na execução se contraste falhar WCAG |
| `.tag` pílula em layouts densos | Opção A aprovada; se algum chip quebrar layout, ajustar padding pontual, não reverter global |
| Bloco `.lp-*` grande (~700 linhas) | Grep de hex escuros antes de editar; substituir sistematicamente |
| `globals.css` enorme | Editar só seções nomeadas; evitar reformatação em massa |

## Success criteria

1. Nenhuma superfície pública com fundo `#020617` / `slate-900` como chrome
2. Zero referências a Fraunces
3. Nav ativo em tint verde; KPI flat `rounded-2xl`; tags/deltas em pílula
4. Build web passa; rotas de verificação visual ok em light + CTA verde
