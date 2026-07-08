# Auth Migration: Clerk → Custom JWT (BFF + Redis) + Login UI estilo prevconsulta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Nota:** Existe um plano anterior em `.plans/15-replace-clerk-custom-auth.md` com arquitetura diferente (Bearer direto no browser, `RefreshToken` em tabela Postgres, Passport Google redirect, UI de card simples). Este plano (25) substitui as decisões arquiteturais do 15 — não executar os dois em paralelo. Decidir com o usuário se o 15 deve ser arquivado/deletado antes de iniciar a execução.

**Goal:** Remover completamente o Clerk e substituir por autenticação JWT própria (access 15min / refresh 7d com rotação via Redis), com página de login em layout split-screen inspirado no backoffice do `prevconsulta` (usando a paleta própria do WhatsAgent), login social via Google, e um proxy BFF no Next.js para que o browser nunca veja o token diretamente (cookies httpOnly).

**Architecture:**
- Backend NestJS (`apps/api`) emite/valida JWTs próprios: `JwtAuthGuard` substitui `ClerkAuthGuard`; refresh tokens rotacionados via Redis (chave `refresh:${jti}`, TTL 7d, uso único), não em tabela Postgres.
- Google OAuth verificado sem SDK, via `fetch` ao endpoint `tokeninfo` do Google (mesmo padrão do prevconsulta) — o token de acesso do Google é obtido no client via `@react-oauth/google` (fluxo implícito), não redirect server-side do Passport.
- Frontend Next.js (`apps/web`) vira BFF completo: toda chamada à API passa por `app/api/proxy/[...path]/route.ts` (baseado no padrão já existente em `d:\Projetos\clit\uber_clone_services\apps\backoffice\src\app\api\proxy\[...path]\route.ts`), que lê o cookie httpOnly `access_token` e injeta `Authorization: Bearer`. Rotas `app/api/auth/*` fazem login/refresh/logout e setam/limpam os cookies.
- WebSocket (Socket.IO) não passa pelo proxy HTTP — usa um "ticket" de uso único emitido via `/auth/socket-ticket` (autenticado por cookie) para autenticar o handshake sem expor o access token.
- Login UI: layout split-screen (painel de marca à esquerda + formulário à direita), paleta dark OLED do WhatsAgent (`#020617`/`#22C55E`/`#6366F1`, Plus Jakarta Sans via `next/font/google`), com estados `login | forgot | sent` numa única página (sem rotas extras), toggle de senha, "lembrar-me", erro inline.

**Tech Stack:** `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`, `ioredis` (Redis já usado no projeto para BullMQ), `jose` (verificação de JWT no middleware Edge), `@react-oauth/google`, `class-validator` (já existe).

**Out of scope:** Fluxo de convite de membros de equipe (cada `/auth/register` cria um novo tenant, como hoje). Recuperação de senha por e-mail real (endpoint fica com stub 501, como no prevconsulta) — pode virar plano futuro.

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `packages/database/prisma/schema.prisma` | Modificar | Remove `clerkId`, adiciona `passwordHash`, `googleId` no `User` |
| `apps/api/src/common/redis/redis.module.ts` | Criar | Provider `Redis` global (extrai instância inline hoje só em `agent.module.ts`) |
| `apps/api/src/modules/auth/auth.service.ts` | Criar | login, register, googleLogin (via tokeninfo), refreshToken (rotação Redis), logout, socketTicket |
| `apps/api/src/modules/auth/auth.controller.ts` | Criar | Rotas REST de autenticação (`@Throttle` 5/60s) |
| `apps/api/src/modules/auth/auth.module.ts` | Criar | Wiring com Passport + JwtModule + RedisModule |
| `apps/api/src/modules/auth/strategies/jwt.strategy.ts` | Criar | `passport-jwt`, Bearer header, valida `User` + status do tenant |
| `apps/api/src/modules/auth/dto/{login,register}.dto.ts` | Criar | DTOs com `class-validator` |
| `apps/api/src/modules/auth/auth.service.spec.ts` | Criar | Testes unitários (login, google, refresh/rotação, logout) |
| `apps/api/src/common/guards/jwt-auth.guard.ts` | Criar | Substitui `ClerkAuthGuard` |
| `apps/api/src/common/guards/jwt-auth.guard.spec.ts` | Criar | Testes do guard |
| `apps/api/src/common/guards/clerk-auth.guard.ts` (+ spec) | Deletar | Removido |
| `apps/api/src/modules/clerk/` (diretório completo) | Deletar | ClerkModule, controller, service, specs removidos |
| `apps/api/src/common/decorators/current-tenant.decorator.ts` | Modificar | Lê `req.user.tenantId` (setado pelo `JwtAuthGuard`) |
| `apps/api/src/common/interceptors/tenant-context.interceptor.ts` | Modificar | Remove comentário/referência ao Clerk |
| `apps/api/src/app.module.ts` | Modificar | Troca `ClerkWebhookModule` → `AuthModule` |
| `apps/api/src/gateways/events.gateway.ts` | Modificar | Troca verificação Clerk por troca de ticket (Redis) |
| Todos os controllers com `@UseGuards(ClerkAuthGuard, ...)` | Modificar | `agent-config`, `analytics`, `billing`, `categories`, `conversations`, `crm`, `orders`, `payments`, `products`, `settings`, `super-admin` → `JwtAuthGuard` |
| `apps/api/package.json` | Modificar | Remove `@clerk/backend`, `svix` (se não usado por outro webhook); adiciona `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`, `ioredis` (se ainda não presente na raiz) |
| `apps/web/src/app/api/proxy/[...path]/route.ts` | Criar | BFF proxy — baseado no padrão de `uber_clone_services`, com refresh automático em 401 |
| `apps/web/src/app/api/auth/{login,register,google,refresh,logout,me}/route.ts` | Criar | Proxies que setam/limpam cookies httpOnly |
| `apps/web/src/contexts/auth-context.tsx` | Criar | `AuthProvider`/`useAuthContext` — bootstrap via `/api/auth/me`, sem token exposto ao JS |
| `apps/web/src/app/providers.tsx` | Modificar | Troca `ClerkProvider` → `AuthProvider` + `GoogleOAuthProvider` |
| `apps/web/src/middleware.ts` | Modificar | Troca `clerkMiddleware` por verificação `jose.jwtVerify` do cookie `access_token` (Edge-compatible) |
| `apps/web/src/lib/hooks/useApi.ts` | Modificar | Chama `/api/proxy/*` (mesma origem) em vez de `NEXT_PUBLIC_API_URL` direto com `getToken()` |
| `apps/web/src/hooks/useSocket.ts` | Modificar | Busca ticket via `/api/proxy/auth/socket-ticket`, conecta com `auth: { ticket }` |
| `apps/web/src/app/(public)/login/page.tsx` | Criar | Layout split-screen estilo prevconsulta, paleta WhatsAgent, estados login/forgot/sent |
| `apps/web/src/app/(public)/register/page.tsx` | Criar | Mesmo layout, ligado a `/api/auth/register` |
| `apps/web/src/components/layout/Header.tsx` | Modificar | Troca `useUser`/`useClerk` por `useAuthContext()` |
| `apps/web/src/app/(dashboard)/settings/page.tsx` | Modificar | Remove `UserProfile` do Clerk; tela própria de perfil + trocar senha |
| `apps/web/src/app/page.tsx` | Modificar | Troca `SignInButton`/`SignUpButton` por links `/login` e `/register` |
| `apps/web/src/app/(onboarding)/setup/plan/page.tsx` | Modificar | Troca `useAuth()` do Clerk por `useAuthContext().isSignedIn` |
| `apps/web/src/components/agent/TestSimulator.tsx` | Modificar | Troca `getToken()` do Clerk por `apiFetch` de `useApi` |
| `apps/web/package.json` | Modificar | Remove `@clerk/nextjs`; adiciona `@react-oauth/google`, `jose` (se ainda não presente) |
| `.env.example`, `.env`, `.env.local`, `apps/web/.env.local`, `apps/channel-service/.env`, `packages/database/.env` | Modificar | Remove `CLERK_*`; adiciona `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN=15m`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN=7d`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |
| `packages/database/src/seed.ts` | Modificar | Usuário dev com `passwordHash` (bcrypt) em vez de `clerkId` |
| `apps/web/.clerk/` | Deletar | Cache de dev do Clerk |

---

## Task 1: Prisma Schema — remover Clerk, adicionar credenciais

**Files:** `packages/database/prisma/schema.prisma`

- [ ] **Step 1:** Verificar e-mails duplicados antes de tornar `email` único (se ainda não for):
  ```sql
  SELECT email, COUNT(*) FROM "User" GROUP BY email HAVING COUNT(*) > 1;
  ```
  Esperado: zero linhas.

- [ ] **Step 2:** Atualizar modelo `User` — remover `clerkId` (campo + `@@index([clerkId])`), adicionar:
  ```prisma
  passwordHash String?
  googleId     String? @unique
  ```

- [ ] **Step 3:** Rodar migration:
  ```powershell
  pnpm --filter @whatsagent/database migrate:dev --name replace_clerk_with_custom_auth
  ```

- [ ] **Step 4:** Conferir no Prisma Studio (`pnpm db:studio`) que `clerkId` sumiu e `passwordHash`/`googleId` existem.

- [ ] **Step 5:** Commit.

---

## Task 2: Backend — RedisModule compartilhado

**Files:** `apps/api/src/common/redis/redis.module.ts`, `apps/api/src/common/redis/redis.service.ts`

- [ ] **Step 1:** Extrair a instância `Redis` hoje criada inline em `apps/api/src/modules/agent/agent.module.ts` para um módulo global (`@Global()`) que injeta `Redis` via token, lendo `REDIS_URL`.

- [ ] **Step 2:** Atualizar `agent.module.ts` para importar `RedisModule` em vez de instanciar `Redis` diretamente.

- [ ] **Step 3:** Rodar `pnpm --filter @whatsagent/api build` para confirmar que nada quebrou.

- [ ] **Step 4:** Commit.

---

## Task 3: Backend — DTOs de auth

**Files:** `apps/api/src/modules/auth/dto/login.dto.ts`, `apps/api/src/modules/auth/dto/register.dto.ts`

- [ ] **Step 1:** Instalar dependências:
  ```powershell
  pnpm --filter @whatsagent/api add @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
  pnpm --filter @whatsagent/api add -D @types/passport-jwt @types/bcrypt
  ```

- [ ] **Step 2:** `LoginDto` (`email`, `password` com `@IsEmail`/`@IsString`).

- [ ] **Step 3:** `RegisterDto` (`email`, `name`, `password` com `@MinLength(8)`, `companyName?`).

- [ ] **Step 4:** Commit.

---

## Task 4: Backend — AuthService (com testes)

**Files:** `apps/api/src/modules/auth/auth.service.ts`, `apps/api/src/modules/auth/auth.service.spec.ts`

- [ ] **Step 1:** Escrever specs cobrindo: login com credenciais inválidas/válidas, `googleLogin` (mock do `fetch` ao tokeninfo), `refreshToken` com rotação (token antigo invalidado, novo par emitido), `logout` (chave Redis removida). Rodar e confirmar que falham (`AuthService` ainda não existe).

- [ ] **Step 2:** Implementar `AuthService`:
  - `login(email, password)`: busca `User` (com `tenant`), `bcrypt.compare` contra `passwordHash`, rejeita se `!isActive` ou tenant `SUSPENDED`/`CANCELLED`.
  - `register(dto)`: `$transaction` cria `Tenant` (status `TRIAL`) + `User` (role `OWNER`, `passwordHash` via `bcrypt.hash(pw, 10)`).
  - `googleLogin(accessToken)`: `fetch("https://oauth2.googleapis.com/tokeninfo?access_token=...")`, valida `email_verified === "true"`; resolve por `googleId`, fallback por `email` (persiste `googleId` no primeiro login); se não existir usuário, cria tenant+user como no `register`.
  - `generateTokens(userId, tenantId)`: assina access (`JWT_ACCESS_SECRET`, 15m) e refresh (`JWT_REFRESH_SECRET`, 7d, payload com `jti` via `randomUUID()`); grava `refresh:${jti}` → `userId` no Redis (TTL 7d).
  - `refreshToken(token)`: verifica assinatura, confere existência da chave Redis, **deleta a chave antiga** (rotação/uso único) e emite par novo.
  - `logout(token)`: verifica e deleta a chave Redis correspondente (não lança erro se já inválido).
  - `issueSocketTicket(userId)`: gera ticket aleatório, grava `socket-ticket:<id>` → `userId` no Redis com TTL curto (~30s).

- [ ] **Step 3:** Rodar specs — confirmar PASS.

- [ ] **Step 4:** Commit.

---

## Task 5: Backend — JwtStrategy + JwtAuthGuard (com testes)

**Files:** `apps/api/src/modules/auth/strategies/jwt.strategy.ts`, `apps/api/src/common/guards/jwt-auth.guard.ts` (+ spec)

- [ ] **Step 1:** `JwtStrategy` (`passport-jwt`, `ExtractJwt.fromAuthHeaderAsBearerToken()`, secret `JWT_ACCESS_SECRET`), `validate(payload)` retorna `{ sub }`.

- [ ] **Step 2:** Escrever spec do `JwtAuthGuard` cobrindo: usuário inativo → `UnauthorizedException`; tenant `SUSPENDED`/`CANCELLED` → `UnauthorizedException`; usuário válido → seta `req.user`/`req.tenantId`. Rodar e confirmar falha.

- [ ] **Step 3:** Implementar `JwtAuthGuard extends AuthGuard('jwt')`: após `super.canActivate`, busca `User` por `id` (com `tenant`), valida `isActive` e status do tenant, seta `req.user = user` e `req.tenantId = user.tenantId`.

- [ ] **Step 4:** Rodar specs — PASS. Commit.

---

## Task 6: Backend — AuthController, AuthModule, wiring

**Files:** `apps/api/src/modules/auth/auth.controller.ts`, `auth.module.ts`, `apps/api/src/app.module.ts`

- [ ] **Step 1:** `AuthController` com `@Controller('auth')` + `@Throttle({ default: { ttl: 60000, limit: 5 } })`:
  - `POST /auth/register`, `POST /auth/login`, `POST /auth/google` (body `{ accessToken }`), `POST /auth/refresh` (body `{ refreshToken }`), `POST /auth/logout` (guard `JwtAuthGuard`, body `{ refreshToken }`), `POST /auth/socket-ticket` (guard `JwtAuthGuard`), `GET /auth/me` (guard `JwtAuthGuard`, retorna `req.user`).

- [ ] **Step 2:** `AuthModule` — importa `PassportModule`, `RedisModule`, `JwtModule.register({})` (secrets passados por chamada em `sign`/`verify`, não no módulo — igual ao padrão do prevconsulta, pois access/refresh usam segredos diferentes).

- [ ] **Step 3:** Atualizar `app.module.ts`: remover `ClerkWebhookModule`, adicionar `AuthModule`.

- [ ] **Step 4:** `pnpm --filter @whatsagent/api build` — esperar erros relacionados a `clerkId`/`ClerkAuthGuard` (serão resolvidos nas próximas tasks).

- [ ] **Step 5:** Commit.

---

## Task 7: Backend — remover ClerkModule/guard, trocar guards nos controllers

**Files:** `apps/api/src/modules/clerk/` (deletar), `apps/api/src/common/guards/clerk-auth.guard.ts` (+ spec, deletar), todos os controllers listados no File Map

- [ ] **Step 1:** Localizar todos os usos de `ClerkAuthGuard`:
  ```powershell
  Select-String -Path "apps/api/src/**/*.ts" -Pattern "ClerkAuthGuard" -Recurse
  ```

- [ ] **Step 2:** Trocar import + uso de `ClerkAuthGuard` → `JwtAuthGuard` em cada controller (ajustar caminho relativo do import).

- [ ] **Step 3:** Deletar `apps/api/src/modules/clerk/` e `clerk-auth.guard.ts`(+spec).

- [ ] **Step 4:** Atualizar `current-tenant.decorator.ts` para ler `req.user.tenantId` (mantém compatibilidade se `JwtAuthGuard` também setar `req.tenantId`; escolher uma única fonte de verdade). Remover comentário obsoleto em `tenant-context.interceptor.ts`.

- [ ] **Step 5:** `pnpm --filter @whatsagent/database generate` (client pode estar desatualizado após remover `clerkId`), depois `pnpm --filter @whatsagent/api build` e `pnpm --filter @whatsagent/api test --no-coverage` — esperar PASS.

- [ ] **Step 6:** Commit.

---

## Task 8: Backend — EventsGateway com autenticação por ticket

**Files:** `apps/api/src/gateways/events.gateway.ts`

- [ ] **Step 1:** Remover import `@clerk/backend`. No `handleConnection`, ler `client.handshake.auth?.ticket`, buscar `socket-ticket:<ticket>` no Redis; se ausente/expirado, desconectar. Se válido, apagar a chave (uso único), buscar `User` pelo `userId` resolvido, checar `isActive`, `client.join(`tenant:${tenantId}`)`.

- [ ] **Step 2:** Garantir que o módulo do gateway importa `RedisModule` (para o mesmo client Redis usado no `AuthService`).

- [ ] **Step 3:** `pnpm --filter @whatsagent/api build && pnpm --filter @whatsagent/api test --no-coverage`. Commit.

---

## Task 9: Backend — remover dependências do Clerk

**Files:** `apps/api/package.json`

- [ ] **Step 1:** Confirmar que `svix` não é usado por nenhum outro webhook antes de remover:
  ```powershell
  Select-String -Path "apps/api/src/**/*.ts" -Pattern "svix" -Recurse
  ```

- [ ] **Step 2:** `pnpm --filter @whatsagent/api remove @clerk/backend` (e `svix` se confirmado não usado em outro lugar).

- [ ] **Step 3:** Commit.

---

## Task 10: Frontend — BFF proxy genérico

**Files:** `apps/web/src/app/api/proxy/[...path]/route.ts`

- [ ] **Step 1:** Portar o padrão de `d:\Projetos\clit\uber_clone_services\apps\backoffice\src\app\api\proxy\[...path]\route.ts` (lê cookie `access_token`, encaminha `Authorization: Bearer`, repassa método/corpo/status para `API_URL`).

- [ ] **Step 2:** Adicionar refresh automático: se a resposta upstream vier `401`, chamar internamente o fluxo de refresh (lendo cookie `refresh_token`, POST para `API_URL/auth/refresh`), setar novo `access_token`/`refresh_token` na resposta e reencaminhar a requisição original uma vez; se falhar de novo, propagar 401.

- [ ] **Step 3:** Registrar `GET/POST/PATCH/PUT/DELETE` handlers, igual ao padrão de referência.

- [ ] **Step 4:** Commit.

---

## Task 11: Frontend — rotas de auth do Next (cookies httpOnly)

**Files:** `apps/web/src/app/api/auth/{login,register,google,refresh,logout,me}/route.ts`

- [ ] **Step 1:** `login/route.ts` e `register/route.ts`: proxy para `${API_URL}/auth/login`/`/auth/register`; em caso de sucesso, setar cookies `access_token` (15min, httpOnly, `sameSite: lax`, `secure` em produção) e `refresh_token` (7d, mesmas flags).

- [ ] **Step 2:** `google/route.ts`: recebe `{ accessToken }` do client (`@react-oauth/google`), proxy para `${API_URL}/auth/google`, mesmos cookies.

- [ ] **Step 3:** `refresh/route.ts`: lê cookie `refresh_token`, proxy para `${API_URL}/auth/refresh`, atualiza cookies.

- [ ] **Step 4:** `logout/route.ts`: lê `refresh_token`, proxy para `${API_URL}/auth/logout`, limpa ambos os cookies (mesmo se a chamada upstream falhar).

- [ ] **Step 5:** `me/route.ts`: lê `access_token`, chama `GET ${API_URL}/auth/me` (ou decodifica localmente se preferir evitar round-trip), retorna dados do usuário sem expor o token.

- [ ] **Step 6:** Commit.

---

## Task 12: Frontend — AuthContext e Providers

**Files:** `apps/web/src/contexts/auth-context.tsx`, `apps/web/src/app/providers.tsx`

- [ ] **Step 1:** `AuthProvider`: no mount, chama `GET /api/auth/me`; expõe `{ user, isLoaded, isSignedIn, signOut }`. `signOut()` chama `POST /api/auth/logout` e redireciona para `/login`.

- [ ] **Step 2:** `providers.tsx`: remover `ClerkProvider`; envolver `children` com `AuthProvider` + `GoogleOAuthProvider` (de `@react-oauth/google`, `clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}`).

- [ ] **Step 3:** Commit.

---

## Task 13: Frontend — middleware customizado (Edge, `jose`)

**Files:** `apps/web/src/middleware.ts`

- [ ] **Step 1:** Instalar `jose` se ainda não presente em `apps/web`.

- [ ] **Step 2:** Substituir `clerkMiddleware` por função que lê cookie `access_token`, valida via `jose.jwtVerify(token, secret)` (secret `JWT_ACCESS_SECRET` como `Uint8Array`), mantendo a mesma lista de rotas protegidas hoje existente (`/setup`, `/overview`, `/analytics`, `/catalog`, `/inbox`, `/orders`, `/agent`, `/settings`, `/support`, `/tenants`). Redireciona para `/login` se inválido; redireciona usuário já autenticado tentando acessar `/login`/`/register` para `/overview`.

- [ ] **Step 3:** Commit.

---

## Task 14: Frontend — página de login (split-screen, estilo prevconsulta)

**Files:** `apps/web/src/app/(public)/login/page.tsx`, `apps/web/src/app/(public)/register/page.tsx`, `apps/web/src/app/layout.tsx` (fonte)

- [ ] **Step 1:** Carregar Plus Jakarta Sans via `next/font/google` em `layout.tsx` (hoje referenciada no Tailwind config mas nunca importada) e aplicar como fonte padrão.

- [ ] **Step 2:** `(public)/login/page.tsx` — layout split-screen:
  - Painel esquerdo (`hidden lg:flex`, `w-[46%] min-w-[430px]`): fundo `#020617`, formas decorativas suaves em baixa opacidade (`bg-white/5`-`10` adaptado para `bg-[#22C55E]/10`/`bg-[#6366F1]/10`), logo + headline + 2-3 métricas de marca (`BrandMetric`), rodapé copyright.
  - Painel direito: heading "Bem-vindo de volta", campos com ícone (`lucide-react`: `Mail`, `Lock`, `Eye`/`EyeOff`), toggle de senha, "lembrar-me" (checkbox custom), link "esqueci a senha", erro inline (`text-rose-400`), botão submit com loading state, divisor "ou", botão Google (`useGoogleLogin` do `@react-oauth/google`, fluxo implícito, POST para `/api/auth/google`).
  - Estado local `authView: 'login' | 'forgot' | 'sent'` (sem rotas extras) reproduzindo o fluxo de recuperação de senha do prevconsulta.

- [ ] **Step 3:** `(public)/register/page.tsx` — mesmo layout, formulário `name`/`email`/`password`/`companyName?`, submete para `POST /api/auth/register`.

- [ ] **Step 4:** Testar visualmente via `pnpm --filter @whatsagent/web dev` (login, registro, toggle de senha, fluxo esqueci-senha, responsividade mobile ocultando o painel esquerdo).

- [ ] **Step 5:** Commit.

---

## Task 15: Frontend — reescrever consumidores do Clerk

**Files:** `useApi.ts`, `useSocket.ts`, `Header.tsx`, `settings/page.tsx`, `setup/plan/page.tsx`, `TestSimulator.tsx`, `page.tsx`

- [ ] **Step 1:** `useApi.ts`: remover `useAuth`/`getToken`; `apiFetch` chama `/api/proxy${path}` (mesma origem, cookie enviado automaticamente).

- [ ] **Step 2:** `useSocket.ts`: antes de conectar, `POST /api/proxy/auth/socket-ticket`; conectar Socket.IO com `auth: { ticket }`.

- [ ] **Step 3:** `Header.tsx`: trocar `useUser`/`useClerk` por `useAuthContext()`; `signOut()` chama o novo fluxo.

- [ ] **Step 4:** `settings/page.tsx`: remover `UserProfile` do Clerk; construir tela própria (nome, e-mail, trocar senha via novo endpoint) — trocar senha pode ser um `PATCH /auth/change-password` simples no `AuthController` (fora do escopo estrito do login, mas necessário para não regressar a funcionalidade hoje delegada ao Clerk).

- [ ] **Step 5:** `setup/plan/page.tsx`: trocar `useAuth()` do Clerk por `useAuthContext().isSignedIn`.

- [ ] **Step 6:** `TestSimulator.tsx`: trocar `getToken()` por `apiFetch` de `useApi`.

- [ ] **Step 7:** `page.tsx` (landing): trocar `SignInButton`/`SignUpButton` modais por `<Link href="/login">`/`<Link href="/register">`.

- [ ] **Step 8:** Commit.

---

## Task 16: Limpeza final — dependências, env vars, dados existentes

**Files:** `apps/web/package.json`, `.env*` (todos), `apps/web/.clerk/`, `packages/database/src/seed.ts`

- [ ] **Step 1:** `pnpm --filter @whatsagent/web remove @clerk/nextjs`; `pnpm --filter @whatsagent/web add @react-oauth/google jose`.

- [ ] **Step 2:** Apagar `apps/web/.clerk/`.

- [ ] **Step 3:** Remover `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` de todos os `.env`/`.env.example`/`.env.local` (raiz, `apps/web`, `apps/channel-service`, `packages/database`); adicionar `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN=15m`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN=7d`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

- [ ] **Step 4:** Script único de migração de dados (`packages/database/src/scripts/migrate-clerk-users.ts`): para cada `User` hoje só com `clerkId` (antes de remover o campo na Task 1 — **rodar antes ou capturar os dados em backup**), gerar senha temporária/hash ou marcar para "definir senha no primeiro acesso". Atualizar `seed.ts` para criar usuário dev com `passwordHash` (bcrypt de senha de desenvolvimento) em vez de `clerkId`.

- [ ] **Step 5:** Commit final.

---

## Verificação end-to-end

- `pnpm --filter @whatsagent/api test` e `pnpm --filter @whatsagent/web lint` sem erros.
- `pnpm docker:up` (Postgres/Redis) + `pnpm --filter @whatsagent/api dev` + `pnpm --filter @whatsagent/web dev`: testar manualmente registro → login (email/senha) → acesso a rota protegida do dashboard → conexão de socket autenticada (evento no Inbox) → refresh automático (forçar expiração do access token) → logout → login com Google → fluxo "esqueci senha" (UI, mesmo com backend stub 501).
- Confirmar que `middleware.ts` bloqueia rotas protegidas sem cookie válido.
- Rodar `pnpm --filter @whatsagent/database migrate:dev` limpo sobre os dados de seed.
