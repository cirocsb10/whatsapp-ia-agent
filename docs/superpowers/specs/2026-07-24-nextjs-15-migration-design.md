# Migração `apps/web` para Next.js 15 + React 19

## Contexto

`apps/web` está em Next.js 14.2.35 + React 18.3.1 desde o scaffold inicial do projeto (commit `5106637`). O Turbopack já foi ativado no dev script (`next dev --turbo`), mas gera um warning de incompatibilidade do `@sentry/nextjs` com Turbopack em versões do Next anteriores à 15.4.1. Migrar para Next 15 resolve esse warning e destrava melhorias de performance em dev (Turbopack maduro) e produção (React 19).

Não afeta `api`, `channel-service`, `ai-orchestrator` nem o schema do banco — mudança isolada em `apps/web`.

## Levantamento de riscos

Investigação read-only do código de `apps/web/src/**` confirmou que o projeto já foi escrito de forma bastante "forward-compatible":

| Categoria | Achado | Ação necessária |
|---|---|---|
| `fetch()` server-side sem cache explícito | `app/api/auth/me/route.ts`, `app/api/proxy/[...path]/route.ts` | Nenhuma — o novo default (`no-store`) é o comportamento correto para essas rotas; nenhum call site depende do cache antigo para funcionar |
| `cookies()` | 7 arquivos, todos já usando `await cookies()` | Nenhuma |
| `headers()` | Nenhum uso encontrado | N/A |
| `params`/`searchParams` em Server Components | Nenhuma página usa (todas `page.tsx` sem args) | Nenhuma |
| `params` em Route Handler dinâmico | `app/api/proxy/[...path]/route.ts` — único handler com segmento dinâmico (`[...path]`) | **Ajustar**: `params: { path: string[] }` → `params: Promise<{ path: string[] }>` + `await` |
| `next.config.mjs` | `experimental.serverComponentsExternalPackages: []` | **Ajustar**: mover para `serverExternalPackages: []` top-level (chave renomeada/promovida) |
| Dependências com peer dep React estrito | Nenhuma encontrada — todas usam `react >=16.8.0` ou já suportam `^19` (`framer-motion`, `recharts`, `@testing-library/react`, `react-hook-form`, `@tanstack/react-query`, `zustand`, `@sentry/nextjs`) | Nenhuma, exceto bump de devDeps abaixo |
| `@types/react`/`@types/react-dom` | `^18.3.0` | **Bump** para `^19` |
| `eslint-config-next` | Pinado em `14.2.0` (sem `^`) | **Bump** alinhado à versão do Next escolhida |
| Sentry (`instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`) | Já no padrão moderno exigido pelo SDK recente; `@sentry/nextjs@10.67.0` já suporta Next 15/React 19 | Nenhuma |
| Jest/Playwright | Sem dependência de comportamento específico do Next 14 | Nenhuma |
| `instrumentationHook` experimental | Não presente no repo | N/A |
| `middleware.ts` | Usa apenas APIs estáveis (`NextRequest`/`NextResponse`, `jose`, `req.cookies`) | Nenhuma |

Superfície real de mudança de código: **1 arquivo de config + 1 route handler**.

## Fases

### Fase 1 — Upgrade + correções obrigatórias

- Bump em `apps/web/package.json`: `next` → `^15`, `react`/`react-dom` → `^19`, `@types/react`/`@types/react-dom` → `^19`, `eslint-config-next` alinhado.
- `next.config.mjs`: mover `serverComponentsExternalPackages` para `serverExternalPackages` top-level.
- `app/api/proxy/[...path]/route.ts`: tornar `params` assíncrono (`Promise<{ path: string[] }>` + `await`).
- Rodar `pnpm --filter @whatsagent/web build`, `lint`, `test`, `test:e2e` e corrigir o que a compilação/testes reais apontarem além do já mapeado.
- Commit único, revertível isoladamente via `git revert`.

### Fase 2 — Aproveitar o que o Next 15 destrava

- Confirmar que o warning do Sentry+Turbopack desapareceu (Next 15.4.1+ é compatível).
- Checagem final de flags/config órfãs de versão antiga.
- Commit isolado.

## Validação

Após cada fase, localmente (sem subir docker/outros serviços, já que a mudança não toca neles):

```bash
pnpm --filter @whatsagent/web build
pnpm --filter @whatsagent/web lint
pnpm --filter @whatsagent/web test
pnpm --filter @whatsagent/web test:e2e
```

## Rollback

Cada fase é um commit isolado; revert via `git revert` caso algo quebre.

## Fora de escopo

- Ajustar cache de `fetch()` em call sites que hoje já especificam comportamento explícito (nenhuma mudança de comportamento pretendida ali).
- Qualquer refatoração não relacionada à migração de versão.
- Migração de `api`/`channel-service`/`ai-orchestrator` (não usam Next.js).
