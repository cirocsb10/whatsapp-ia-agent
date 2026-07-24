# Remover tema dark e adotar identidade visual PrevConsulta (verde como cor primária)

## Contexto

O app `apps/web` do whatsapp-ia-agent já foi migrado majoritariamente para tema claro (dashboard, admin, onboarding, CRM, catálogo, analytics, settings, orders, support), mas **4 telas ainda carregam um tema escuro isolado** que nunca foi removido: a landing page, login, register e o `AuthShell`. Não existe mecanismo de dark/light toggle no projeto (sem `next-themes`, sem `ThemeProvider`, zero classes `dark:` no repo) — o `darkMode: "class"` do `tailwind.config.ts` é código morto. Além disso, o usuário gosta da identidade visual do PrevConsulta (`D:\Projetos\clit\prevconsulta\apps\backoffice`) — fonte Outfit (já usada aqui também), cards `rounded-2xl` sem sombra, badges em pílula, tabelas com header `bg-slate-50`, sidebar com item ativo em tom pastel da cor de marca — e quer essa mesma linguagem visual só que com **verde como cor dominante** no lugar do azul do PrevConsulta.

Decisões já tomadas com o usuário:
1. **Escopo**: remover o dark E reestilizar o dashboard (sidebar, KPI cards, tabelas, badges, modais) para seguir os padrões do PrevConsulta — não é só matar as 4 telas escuras.
2. **Verde primário**: manter `#22C55E` (já é o verde de CTA do app) como cor de marca dominante, com uma escala DEFAULT/dark/light ao redor dele.
3. **Indigo `#6366F1`**: mantém como acento secundário específico para UI de IA (como já é hoje) — não vira tudo monocromático verde.
4. **Fonte Fraunces**: remove totalmente. A landing headline passa a usar só Outfit, igual ao PrevConsulta.

## Achados-chave da investigação

- **Zero infraestrutura de dark mode real** — é só CSS hardcoded em 4 lugares, não um sistema de tema para desmontar.
- `apps/web/tailwind.config.ts` (24 linhas) tem tokens semânticos quebrados: `border`/`background`/`foreground` apontam para `var(--border-default)`, `var(--bg-base)`, `var(--text-primary)`, que **não existem** em `globals.css` (que usa nomes `--c-*`). Grep confirmou **zero usos** de `bg-background`, `text-foreground`, `border-border`, `bg-surface-1/2/3`, `bg-muted` em `apps/web/src` — seguro remover esses tokens sem migração de call sites.
- `globals.css` já expõe tokens `:root` funcionais e usados (`--c-green: #22c55e`, `--c-indigo: #6366f1`, `--c-base`, `--c-border`, `--c-text`, `--c-muted`, etc.) e uma camada de classes de componente (`.kpi`, `.nav-item`, `.tag-*`, `.modal-panel`) que o dashboard já consome — ou seja, a reestilização do dashboard é majoritariamente **edição de CSS em um arquivo**, não uma reescrita de dezenas de `.tsx`.
- O bloco `.lp-*` (landing page), linhas ~9736–10450 de `globals.css`, é hardcoded com paleta escura própria (`#020617`, `#e2e8f0`, `#94a3b8`, `rgba(2,6,23,0.72)`), totalmente desacoplada dos tokens `:root`.
- 4 superfícies concentram 100% do dark real: `apps/web/src/app/page.tsx` (+ o bloco `.lp-*`), `apps/web/src/app/(public)/login/page.tsx`, `apps/web/src/app/(public)/register/page.tsx`, `apps/web/src/components/auth/AuthShell.tsx`.
- Fonte: já é `Outfit` (self-hosted, igual ao PrevConsulta) — nenhuma mudança de fonte necessária, exceto remover `Fraunces` (`next/font/google`, usada só em `layout.tsx` linhas 2/8-13/25 e `.lp-headline-serif` em `page.tsx` linha 187 + regra correspondente em `globals.css`).
- Cores de marca `#22C55E`/`#6366F1` aparecem como hex literal (não via token) em ~32/~25 arquivos — normalizar tudo isso é fora de escopo desta passada; tratar como débito técnico a resolver oportunisticamente.
- `.nav-item.active` hoje usa tint indigo (`rgba(99,102,241,0.08)`) — inconsistente com "verde como primária dominante", precisa virar tint verde.
- `.kpi` tem `backdrop-filter: blur(8px)` (toque glassmorphism) e hover glow com fallback indigo — ambos destoam do padrão flat-card do PrevConsulta.

## Plano de execução

### Fase 0 — Consolidar tokens de design (base para tudo depois)

**`apps/web/src/app/globals.css`** (bloco `:root`, linhas 13–26):
- Manter os nomes `--c-*` existentes (já usados em milhares de linhas, renomear é alto risco/baixo valor).
- Adicionar o que falta: `--c-green-dark: #16A34A`, `--c-green-light` (tint pastel para nav ativo/badges, análogo ao `#EDF5FC` do PrevConsulta — escolher durante execução, ex. `rgba(34,197,94,0.10)` ou um hex sólido tipo `#E9F9EF`), e um tom de texto verde escuro para contraste em cima do tint (análogo ao `#2A6599` do PrevConsulta, ex. `#166534`/`#15803D`).
- Manter `--c-indigo: #6366f1` sem alteração (acento secundário de IA).

**`apps/web/tailwind.config.ts`**:
- Remover `darkMode: "class"` (linha 4, morto).
- Remover `colors.border`, `colors.background`, `colors.foreground` (linhas 10–12) — apontam para variáveis inexistentes e têm zero uso confirmado; remover é mais simples que consertar, já que o PrevConsulta também não usa uma camada semântica Tailwind (usa classes slate/brand literais).
- Remover `colors.surface` (linha 15) e `colors.muted` (linha 16) — hardcoded em tons escuros, zero uso confirmado.
- Ajustar `colors.primary`/`colors.accent` (linhas 13–14) para refletir a escala verde definitiva definida no `globals.css` acima (manter `accent` = indigo como está).

Verificação: `pnpm --filter @whatsagent/web build` sem erros; grep confirma zero referências aos tokens removidos.

### Fase 1 — Remover as 4 telas com tema escuro

1. **`apps/web/src/app/globals.css` linhas 9736–10450 (bloco `.lp-*`)**: antes de editar, rodar grep escopado a esse range para enumerar todo hex/rgba escuro (`#e2e8f0`, `#f1f5f9`, `#94a3b8`, `#020617`, `#0f172a`, `rgba(2,6,23,...)`) e trocar por light: fundo `var(--c-base)`/branco, texto por `var(--c-text)`/`var(--c-muted)`/`var(--c-subtle)`, `.lp-nav` glass de `rgba(2,6,23,0.72)` para algo como `rgba(255,255,255,0.8)` + `border-bottom: 1px solid var(--c-border)`. `.lp-btn-primary` já usa gradiente verde — manter. Reponderar os orbs decorativos para verde dominante / indigo secundário, com opacidade mais baixa (fundo claro satura mais rápido que fundo escuro).
2. **`apps/web/src/app/page.tsx`**: sem reescrita estrutural — só remover `className="lp-headline-serif"` (linha 187, ver Fase 2) e checar pontualmente por hex/classe escura inline não capturada no CSS.
3. **`apps/web/src/app/(public)/login/page.tsx`** e **`apps/web/src/app/(public)/register/page.tsx`** (mesmo padrão nos dois): `bg-slate-900/80|60` → `bg-white` + `border border-slate-200`; `border-white/10` → `border-slate-200`; `text-white` → `text-slate-900`; `text-slate-400/300/100` → `text-slate-500` (secundário) / `text-slate-400` (muted), seguindo a hierarquia de texto do PrevConsulta. Garantir que focus ring/CTA do form usem verde, não indigo/tema escuro.
4. **`apps/web/src/components/auth/AuthShell.tsx`**: `bg-[#020617]` → `bg-slate-50`; texto invertido para hierarquia clara; `border-white/10` → `border-slate-200`; cards "glass" (`bg-white/5`) → `bg-white` sólido com `border border-slate-200` (sem sombra pesada, seguindo o padrão flat card do PrevConsulta — que não usa glassmorphism); orbs decorativos coloridos — recomenda-se remover (PrevConsulta não tem esse recurso) em vez de tentar adaptar para fundo claro.

Verificação: `pnpm --filter @whatsagent/web dev`, checar visualmente `/`, `/login`, `/register` — nenhum fundo preto/quase-preto restante, verde como CTA dominante, contraste de texto correto.

### Fase 2 — Remover fonte Fraunces

- `apps/web/src/app/layout.tsx`: remover o `import { Fraunces } from "next/font/google"` (linha 2), o bloco de config `fraunces` (linhas 8–13) e `${fraunces.variable}` do `<body className>` (linha 25).
- `apps/web/src/app/globals.css`: remover a regra `.lp-headline-serif` (usa `var(--font-fraunces)`).
- `apps/web/src/app/page.tsx` linha 187: remover a classe `lp-headline-serif` do `<span>` — decidir na hora entre herdar o Outfit padrão ou trocar por uma classe de ênfase existente sem serifa (ex. `.tg-green`, já presente no CSS, se o objetivo for destacar a frase em verde).

Verificação: grep case-insensitive por `fraunces` no repo retorna zero resultados; conferir visualmente que o headline da landing renderiza em Outfit.

### Fase 3 — Reestilizar dashboard nos padrões PrevConsulta (verde primário)

Como o dashboard já roteia estilo por classes CSS nomeadas em `globals.css`, a maior parte disso é edição de CSS, com poucos `.tsx` tocados:

1. **Sidebar** (`apps/web/src/components/layout/Sidebar.tsx` consome `.nav-item`/`.nav-item.active` do CSS — o componente em si não tem cor hardcoded): trocar o tint indigo do item ativo por tint verde pastel + texto verde escuro (análogo ao `#EDF5FC`/`#2A6599` do PrevConsulta), mantendo a barra lateral verde (`box-shadow: inset 2px 0 0 var(--c-green)`) que já está correta.
2. **KPI cards** (classe `.kpi` + `apps/web/src/components/analytics/KpiCard.tsx`): aumentar `border-radius` de 12px para os 16px (`rounded-2xl`) dominantes no PrevConsulta; remover o `backdrop-filter: blur(8px)` de repouso (destoa do card flat do PrevConsulta); trocar o fallback padrão do glow de hover de indigo para verde, preservando os casos em que `--kpi-accent` é passado explicitamente como indigo (KPIs de IA legítimos).
3. **Tabelas/listas**: a localização exata dos componentes de tabela/lista (CRM, catálogo, pedidos) não foi confirmada nesta investigação — passo de descoberta necessário na execução (`grep -n "\.table\b|grid-cols" apps/web/src/app/globals.css` + varredura das páginas de listagem em `apps/web/src/app/(dashboard)/**`). Aplicar o padrão do PrevConsulta: container `rounded-2xl border border-slate-200 bg-white`, header `bg-slate-50` com `text-[11px] font-bold uppercase tracking-[0.05em] text-slate-400`, linhas com `border-b border-slate-50 last:border-b-0`.
4. **Badges/pills** (`.tag-*` em `globals.css`, hoje `border-radius: 4px`): o PrevConsulta usa pílula (`rounded-full`). Antes de mudar globalmente, checar o uso real de `.tag` (usado em KPI deltas, estágios de CRM, status de produto — blast radius amplo) em 2-3 lugares reais (ex. `DealCard.tsx`, `ProductCard.tsx`) para decidir entre converter `.tag` para pílula ou criar um novo conjunto `.badge-*` paralelo para contextos onde a pílula não cabe bem.
5. **Modais** (`.modal-panel` + `apps/web/src/components/ui/Modal.tsx`, já sem cor hardcoded): aumentar `border-radius` de 14px para 16px por paridade; sombra atual já segue a convenção do PrevConsulta (reservada para overlays) — manter.
6. **Botões**: não fazer uma consolidação completa de botão (32+25 arquivos com hex literal é grande demais para esta passada) — só garantir que as superfícies de maior tráfego (CTA da landing, submit de login/register, ações primárias de modal) usem verde consistentemente, o que as Fases 1 e 3.5 já cobrem.

Verificação: dev server, checar visualmente `/overview` (KPI + sidebar), `/inbox`, `/crm` (kanban + badges), `/catalog` ou `/orders` (tabela), abrir pelo menos um modal.

## Sequenciamento e recomendação de PRs

Ordem: **Fase 0 → Fase 1 → Fase 2 → Fase 3**. Tokens primeiro (tudo depois depende deles), remoção do dark em seguida (é o requisito mais visível/urgente, autocontido em 4 arquivos), Fraunces junto ou logo após a Fase 1 (evita duas edições separadas no `page.tsx`), reskin do dashboard por último (maior blast radius, se beneficia da escala verde já definida).

Dado o tamanho (`globals.css` tem 10.450 linhas; dezenas de arquivos carregam hex de marca), recomenda-se dividir em **3 PRs sequenciais**: (1) tokens — pequeno e mecânico; (2) remoção do dark + Fraunces — entrega direta do requisito "sem tema escuro"; (3) reskin do dashboard — maior e mais subjetivo, revisado separadamente. Não há testes visuais automatizados no projeto — verificação é manual via `pnpm --filter @whatsagent/web dev` nas rotas listadas em cada fase.

## Riscos / decisões em aberto para a execução

- Valores exatos de tint verde (nav ativo, badges, hover de KPI) não estão fixados — este plano propõe candidatos, mas o acerto fino é visual, feito durante a execução.
- Mudar `.tag` de retângulo para pílula tem blast radius não totalmente mapeado — checar usos antes de aplicar globalmente.
- Localização exata dos componentes de tabela/lista do dashboard não foi confirmada — passo de descoberta na Fase 3.
- `RouteErrorFallback.tsx`/`ErrorBoundary.tsx` usam `#020617` só como cor de texto sobre botão verde (contraste, não superfície escura) — tratado como fora de escopo, não mexer.
