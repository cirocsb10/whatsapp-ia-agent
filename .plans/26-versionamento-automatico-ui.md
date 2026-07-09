# Plano — Exibição automática de versionamento (padrão prevconsulta)

## Contexto

O usuário quer replicar no `whatsapp-ia-agent` o mesmo mecanismo de exibição de versão do backoffice usado em `D:\Projetos\clit\prevconsulta`: a Sidebar mostra `v{version} · {commit}` do frontend, mais a versão da API obtida ao vivo via endpoint de health-check (`API v{version}`), permitindo detectar divergências entre o que está deployado no front e no back.

Hoje o `whatsapp-ia-agent` não tem nada disso: `package.json` (raiz e `apps/web`) está travado em `"version": "0.0.0"`, não há bump de versão, não há injeção de `NEXT_PUBLIC_*` de build info, e não existe endpoint de health na API. A investigação confirmou o mecanismo de origem:

- `scripts/build-info.js` (prevconsulta) — helper que lê o `version` do `package.json` do app e resolve o commit git (`git rev-parse --short HEAD`, com fallback para env vars de plataforma como `VERCEL_GIT_COMMIT_SHA`/`RENDER_GIT_COMMIT`/`GIT_COMMIT_SHA`).
- `next.config.js` do backoffice injeta isso em `NEXT_PUBLIC_APP_VERSION` / `NEXT_PUBLIC_BUILD_COMMIT` / `NEXT_PUBLIC_BUILD_DATE` via a chave `env` do Next (substituição estática no build).
- `apps/api` (NestJS) gera um `build-info.json` via hook `prebuild`/`predev` (`scripts/gen-build-info.js`), lido em runtime por `src/config/build-info.ts` e exposto em `GET /health`.
- A UI (`(dashboard)/layout.tsx` no prevconsulta) renderiza o texto no footer da sidebar e faz fetch de `/api/health` para mostrar a versão da API.
- Bump de versão é manual, por app, via `scripts/bump-version.js <app> <patch|minor|major|x.y.z>` — não há semantic-release nem CI de release.

Vamos replicar esse mesmo mecanismo nos 3 serviços escolhidos (web, api, channel-service), com a UI mostrando frontend + API version na Sidebar.

## Arquivos a criar/alterar

### 1. Helper compartilhado de build info
- **Criar** `scripts/build-info.js` (raiz do monorepo) — idêntico em espírito ao do prevconsulta: lê `version` de um `package.json` alvo, resolve `commit` via `git rev-parse --short HEAD` (fallback para env vars de plataforma) e `buildDate` (`new Date().toISOString()`).
- **Criar** `scripts/gen-build-info.js` — usa o helper acima para escrever um `build-info.json` ao lado do `package.json` do app (usado pelos apps NestJS).
- **Criar** `scripts/bump-version.js` — bump manual de semver por app (`node scripts/bump-version.js <api|web|channel-service> <patch|minor|major|x.y.z>`), editando o `package.json` daquele app.

### 2. Frontend (`apps/web`)
- **Editar** `apps/web/next.config.mjs`: importar `getBuildInfo` de `../../scripts/build-info.js`, adicionar chave `env` com `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_COMMIT`, `NEXT_PUBLIC_BUILD_DATE`.
- **Editar** `apps/web/src/components/layout/Sidebar.tsx`: no bloco "Status footer" (linhas ~106-125), adicionar uma linha abaixo do status de conexão (só quando `!collapsed`, igual ao padrão do resto do componente) mostrando `v{NEXT_PUBLIC_APP_VERSION} · {NEXT_PUBLIC_BUILD_COMMIT}`. Buscar a versão da API via `useEffect` + `fetch`/`ky` (o projeto já usa `ky` como client HTTP — reaproveitar o client existente em `apps/web/src/lib/` ao invés de criar um novo) para `GET {BACKOFFICE_API_URL}/health`, guardando em `useState` e exibindo `API v{apiVersion}` ao lado, com fallback silencioso (catch vazio) se a chamada falhar — igual ao prevconsulta.
- Adicionar `"prebuild": "node ../../scripts/build-info.js ...", ` **não é necessário** para o Next (a leitura acontece direto no `next.config.mjs`), então nenhum script extra em `apps/web/package.json` além de bump.

### 3. Back-office API (`apps/api`)
- **Criar** módulo/endpoint de health: `apps/api/src/modules/health/health.controller.ts` (+ módulo, registrado em `app.module.ts`) expondo `GET /health` retornando `{ status, version, commit, buildDate, timestamp }`.
- **Criar** `apps/api/src/common/config/build-info.ts` (ou local semelhante) — lê `build-info.json` gerado no build, com fallback para o `package.json` do próprio app se o arquivo não existir (dev sem build).
- **Editar** `apps/api/package.json`: adicionar hooks `prebuild`/`predev` chamando `node ../../scripts/gen-build-info.js ./package.json ./build-info.json`.
- Garantir CORS/rota pública (sem guard de auth) para `/health`, já que a Sidebar do frontend vai chamá-la sem estar autenticada como serviço.

### 4. Channel Service (`apps/channel-service`)
- Mesma coisa que a API: gerar `build-info.json` via `prebuild`/`predev`, e opcionalmente expor `GET /health` (não fica visível na UI hoje, mas fica pronto para uso futuro / debug).

### 5. Versionamento inicial
- Rodar (ou instruir) o bump inicial de cada `package.json` de `0.0.0` para `0.1.0` nos 3 apps (web, api, channel-service), usando o novo `scripts/bump-version.js`.

## Pontos de atenção

- **Precisa de `.git` disponível no ambiente de build/deploy** para `git rev-parse` funcionar — se o deploy for via Docker sem contexto `.git`, o fallback para env vars de plataforma (Vercel/Render/etc, ou um `GIT_COMMIT_SHA` setado manualmente no pipeline) deve ser mantido; documentar isso no próprio `build-info.js` como comentário curto.
- Reaproveitar o client HTTP (`ky`) e a variável de ambiente `BACKOFFICE_API_URL`/equivalente já existente no `.env.example`, em vez de hardcode.
- Não introduzir CI/release automation nova (o prevconsulta também não tem) — o bump continua manual via script.

## Verificação

1. `pnpm --filter @whatsagent/web build` — confirmar que `NEXT_PUBLIC_APP_VERSION`/`NEXT_PUBLIC_BUILD_COMMIT` aparecem no bundle (grep no output ou checar `.next`).
2. `pnpm --filter @whatsagent/api dev` — checar que `build-info.json` é gerado e `curl http://localhost:3002/health` retorna version/commit/buildDate.
3. Rodar `pnpm dev` na raiz, abrir `http://localhost:3000/overview`, expandir a sidebar e confirmar visualmente `v0.1.0 · <hash>` e `API v0.1.0` no footer.
4. Testar fallback: derrubar a API e confirmar que a sidebar não quebra (apenas omite `API vX`).
