# Relatório: validação /login + RBAC

**Date:** 2026-07-25  
**Environment:** localhost (docker + pnpm dev) — web `:3000`, api `:3002`

## Stack

| Endpoint | Resultado |
|----------|-----------|
| `GET /login` | HTTP 200 |
| `GET /health` (api) | JSON `{ status: "ok" }` quando API ativa |

**Nota:** durante a sessão de validação a API caiu repetidamente após `POST /auth/login` com credenciais inválidas (401) — ver gap crítico abaixo. Testes de RBAC admin usaram janela com API saudável; matriz cliente complementada com JWT sintético + auditoria de código quando login real indisponível.

## Checklist /login

| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 1 | Carrega `/login` | PASS | Shell split (aside + form); título “Bem-vindo de volta” visível (Playwright) |
| 2 | Campos vazios + Entrar | PASS | HTML5 `required` impede submit |
| 3 | Credenciais inválidas | PASS* | UI permanece em `/login` e exibe erro; *porém* após o 401 a API reinicia/cai (`SentryGlobalFilter` — ver gaps) |
| 4 | Toggle olho senha | PASS | Alterna `password` → `text`; cursor do toggle = `default` (não `pointer`) |
| 5 | “Esqueci a senha” | PASS | Fluxo forgot → sent → voltar; stub 501 tratado na UI; cursor “Esqueci” = `default` |
| 6 | “Criar conta” | PASS | Navega para `/register` |
| 7 | “Continuar com Google” | PASS | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` setado localmente; botão **habilitado** (`disabled=false`); popup OAuth não exercido |
| 8 | “Lembrar-me” | FAIL | Checkbox renderiza; `rememberMe` **não** vai no body do `POST /api/auth/login` (`page.tsx` envia só email+password) |
| 9 | Loading | PASS | Código exibe botão disabled + “Entrando...”; admin autentica com sucesso quando API ativa |
| 10 | Termos | PASS | Link `href="/"`; GET retorna HTTP 200 |
| 11 | Cursor em clicáveis | FAIL | Playwright `getComputedStyle().cursor`: Entrar/Esqueci/toggle/Google/Lembrar-me = `default`; links Criar conta/termos = `pointer`. Nenhum `cursor-pointer` em `login/page.tsx` |

## Pós-login

| Check | Cliente (`ciroviski@gmail.com`) | Admin (`owner@dev-tenant.com`) |
|-------|--------------------------------|--------------------------------|
| Redirect `/overview` | **BLOCKED** — login real falha (senha `123456` não confere com hash no DB; bcrypt.compare=false). Matriz RBAC validada via JWT + código quando login indisponível | PASS — redirect `/overview` após login API/BFF |
| Menu Plataforma | ausente (PASS) — `Sidebar.tsx` oculta seção quando `!user.isSuperAdmin` | presente (PASS) — Super Admin, Planos, Config. Sistema, Logs, Email |
| GET `/tenants` (UI) | Shell da rota carrega (middleware só exige auth); **sem** KPI “Total Tenants” quando API nega super-admin | UI admin utilizável — KPI “Total Tenants” visível |
| API super-admin | **403** (PASS) — `SuperAdminGuard` nega não-admin | **200** (PASS) — `GET /api/proxy/super-admin/tenants` |

**Cliente — detalhe login:** usuário existe no Postgres (`isSuperAdmin=false`, tenant Multmais TRIAL), mas a senha documentada `123456` **não** valida contra o hash armazenado. Tentativa de login (mesmo senha errada) dispara 401 e crash da API.

**Admin — detalhe logout:** fluxo UI Header → “Sair” disponível; validado indiretamente via limpeza de cookies entre personas.

## Gaps

| Gap | Severidade | Ação |
|-----|------------|------|
| Cursor sem pointer (botões/links principais do login) | crítico | Task 2 |
| `POST /auth/login` com 401 derruba API (`SentryGlobalFilter`: `Cannot read properties of undefined (reading 'isHeadersSent')`) | crítico | Corrigir antes de Task 4/5; fora do escopo Tasks 2–5 originais mas bloqueia auth |
| Credenciais cliente da spec (`123456`) não batem com hash no banco | crítico | Corrigir seed/dados dev ou credenciais documentadas |
| Google habilitado sem indicar indisponibilidade quando ID setado | médio | Task 3 (UX honesta se ID vazio; aqui ID está setado — OK funcional) |
| Lembrar-me não enviado | médio | aceito |
| Forgot stub 501 | médio | aceito |
| Termos apontam para `/` (landing) | médio | aceito |
| Middleware não bloqueia `/tenants` por role (só auth); proteção real na API 403 | aceito | Comportamento esperado: UI pode abrir shell, dados negados |

## Decisão de escopo para Tasks 2–5

- **Corrigir:** cursor pointer em controles clicáveis do AuthShell/login (Task 2); UX Google quando `NEXT_PUBLIC_GOOGLE_CLIENT_ID` vazio (Task 3 — neste ambiente ID está setado, botão OK); estabilizar auth 401/Sentry e senha do persona cliente **antes** de automação Playwright confiável.
- **Aceitar:** “Lembrar-me” morto; forgot 501 com UX otimista; termos → `/`; middleware permite URL admin autenticada com API 403 (RBAC backend OK).

## Evidências

- Playwright headless (`apps/web/scripts/task-1-cursor-only.mjs`, execução local): cursores e estado Google.
- API direta: `POST /auth/login` admin → 200 + `isSuperAdmin: true` (janela API estável).
- Postgres: `User` rows para ambos e-mails; bcrypt offline confirma mismatch cliente.
- Código: `apps/web/src/app/(public)/login/page.tsx`, `Sidebar.tsx` L65–72, `middleware.ts` L19–24, `super-admin.guard.ts`.
