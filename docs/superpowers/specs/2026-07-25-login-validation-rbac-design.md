# Design: Validação da tela `/login` + RBAC pós-login

**Date:** 2026-07-25  
**Status:** Approved for planning  
**Approach:** Manual-first validation, then fix critical gaps, then automate regression (Jest + Playwright)

## Goal

Validar todas as funcionalidades de `http://localhost:3000/login`, autenticar com dois perfis reais (cliente de tenant e admin da plataforma) e confirmar que cada um vê apenas as funcionalidades que deveria após o login. Entregar relatório pass/fail, correções críticas e testes de regressão.

## Personas e credenciais (dev local)

| Perfil | E-mail | Senha (dev) | Flags |
|--------|--------|-------------|-------|
| Cliente (tenant OWNER) | `ciroviski@gmail.com` | `123456` | `isSuperAdmin=false` |
| Admin da plataforma | `owner@dev-tenant.com` | `devpassword123` | `isSuperAdmin=true`, seed |

Credenciais de e2e **não** devem ser hardcoded no repositório. Usar env vars (`E2E_CLIENT_EMAIL` / `E2E_CLIENT_PASSWORD` / `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`) com defaults documentados apenas em README de teste local.

## Scope

### In scope

- Checklist completa da UI/BFF de `/login`
- Login real com cliente e admin
- Matriz pós-login (sidebar + tentativa de rotas admin)
- Auditoria de gaps de código
- Correção de itens **críticos** (auth, RBAC, cursor em controles clicáveis, Google se for bug/config local)
- Jest (página/estados com `fetch` mockado) + Playwright (login + diferença de menu)
- Observações do usuário já conhecidas:
  1. Elementos clicáveis sem cursor de ponteiro (`cursor: pointer`)
  2. Autenticação Google aparenta estar desabilitada

### Out of scope (this cycle)

- E2E completo do fluxo Google OAuth em CI (smoke manual / assert de estado desabilitado ou erro claro)
- Implementação completa de forgot-password se o backend continuar stub `501` (documentar; UX honesta no máximo)
- Papéis AGENT / VIEWER dentro do tenant
- Redesign visual amplo da AuthShell

## Success criteria

1. Checklist `/login` executada e registrada (pass/fail)
2. Cliente e admin autenticam; matriz de navegação bate
3. Gaps críticos corrigidos ou explicitamente aceitos no relatório
4. Suite automatizada cobre login + presença/ausência da seção Plataforma
5. Controles clicáveis relevantes usam cursor pointer (ou ficam claramente não-interativos)
6. Estado do Google login é honesto: funciona com `NEXT_PUBLIC_GOOGLE_CLIENT_ID` setado, ou UI indica indisponível / não engana o usuário

## Checklist `/login` (UI + BFF)

| # | Caso | Esperado |
|---|------|----------|
| 1 | Carrega `/login` | Shell split (branding + form), título “Bem-vindo de volta” |
| 2 | Campos vazios + Entrar | Validação HTML `required` |
| 3 | Credenciais inválidas | Mensagem de erro, permanece em `/login` |
| 4 | Toggle olho senha | Alterna `password` ↔ `text`; cursor pointer |
| 5 | “Esqueci a senha” | View recuperar → enviar → “Verifique seu e-mail” → voltar; links/botões com pointer |
| 6 | “Criar conta” | Vai para `/register` |
| 7 | “Continuar com Google” | Se client ID configurado: inicia OAuth; se não: UI desabilitada ou erro claro (não “silêncio”) |
| 8 | “Lembrar-me” | Comportamento real **ou** gap documentado (hoje o estado não vai no body do login) |
| 9 | Loading | Botão disabled + “Entrando...” durante request |
| 10 | Termos | Link não quebra (hoje aponta para `/`) |
| 11 | Cursor em clicáveis | Botões, links, toggle senha, “Esqueci a senha”, checkbox label, Google — `cursor-pointer` (ou equivalente) |

## Matriz pós-login (RBAC de UI)

Redirect esperado após login bem-sucedido: `/overview` (ambos).

| Área | Cliente (`isSuperAdmin=false`) | Admin (`isSuperAdmin=true`) |
|------|--------------------------------|-----------------------------|
| Menu: Overview, Conversas, Suporte, Analytics, Campanhas | sim | sim |
| Configurar: Agente, Catálogo, CRM, Pedidos, Configurações | sim | sim |
| Seção **Plataforma** (Tenants, Planos, Config. Sistema, Logs, Email) | **não** | **sim** |
| Acesso direto URL admin (ex. `/tenants`) | rejeitado pela API e/ou middleware — **não** apenas esconder no menu | ok |

Se o menu esconder mas a API/rota permitir acesso ao cliente, tratar como **gap crítico** de autorização.

Fonte atual do gate de menu: `Sidebar` filtra itens com `admin: true` quando `!user.isSuperAdmin`.

## Observações iniciais do usuário (investigar na validação)

### Cursor não indica clicável

Vários controles na tela de login são `<button>` / links sem `cursor-pointer` (Tailwind default de button varia; no projeto costuma faltar a classe). Incluir no checklist (#11) e corrigir na AuthShell / página de login se confirmado.

### Google login desabilitado

Hipótese principal: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` vazio no `.env` local → `GoogleOAuthProvider` com `clientId=""`. Confirmar em validação manual e em `apps/web/src/app/providers.tsx`.

Tratamento esperado neste ciclo:

- Se for só config local ausente: documentar no relatório; opcionalmente melhorar UX (desabilitar botão + mensagem “Login Google indisponível”)
- Se client ID estiver setado e ainda falhar: bug crítico a corrigir (BFF `/api/auth/google` ou API)

## Execution flow

1. Auditoria rápida de código (BFF login/google/forgot, cookies, `rememberMe`, Sidebar + middleware/API super-admin)
2. Validação manual no browser (checklist → cliente → matriz → logout → admin → matriz)
3. Relatório pass/fail + gaps (crítico / médio / aceito)
4. Correções críticas (+ cursor pointer + honestidade do botão Google)
5. Automatizar regressão
6. Re-rodar checklist nos pontos tocados

## Fix policy

| Severidade | Ação |
|------------|------|
| Crítico (auth, RBAC real, cursor em controles principais, Google enganoso) | Corrigir neste ciclo |
| Médio (“Lembrar-me” morto, termos → `/`, forgot stub) | Documentar; corrigir só se trivial |
| Aceito | Explicitar no relatório |

## Testing architecture

### Jest (`apps/web`)

- Estados da página: `login` / `forgot` / `sent`
- Toggle de senha
- Erro de credenciais (mock `fetch`)
- Redirect mockado para `/overview` em sucesso
- Preferir padrões existentes (`/** @jest-environment jsdom */`, Testing Library)

### Playwright

- Preferir smoke local ou extensão de `tests/e2e` / `tests/e2e-full` conforme o que já existir
- Casos mínimos:
  1. Login cliente → assert ausência de “Super Admin” / seção Plataforma
  2. Login admin → assert presença de itens Plataforma
  3. Cliente abre `/tenants` → sem acesso privilegiado (redirect, 403, ou empty state autenticado sem dados de plataforma — definir pelo comportamento real encontrado)
- Credenciais via env; README do teste documenta defaults locais

### Manual

- Google OAuth smoke apenas se `NEXT_PUBLIC_GOOGLE_CLIENT_ID` estiver configurado
- Caso contrário, validar UX de “indisponível”

## Artifacts

- Esta spec: `docs/superpowers/specs/2026-07-25-login-validation-rbac-design.md`
- Relatório pós-execução: `docs/superpowers/specs/2026-07-25-login-validation-rbac-report.md` (criar após a rodada)
- Plan de implementação: via skill `writing-plans` após aprovação desta spec

## Non-goals reminder

Não transformar esta validação em redesign da landing/auth nem em matriz completa de papéis OWNER/ADMIN/AGENT/VIEWER. Foco: login funciona e cliente ≠ admin da plataforma na UI e nas rotas.
`)