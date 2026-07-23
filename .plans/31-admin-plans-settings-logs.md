# Plano: Área de Administração do Sistema (Super Admin)

## Contexto

Hoje existe um início de área admin (`(admin)/tenants`, `(admin)/email`) mas com três lacunas que motivam este plano:

1. **Sem visão de planos contratados** — a tabela de tenants mostra `planType` como texto, mas não há tela dedicada de planos, uso e possibilidade de ajuste manual.
2. **Sem configurações gerais da plataforma** — só existe o singleton de SMTP (`PlatformSmtpSettings`); não há feature flags (modo manutenção, registro de tenants) nem defaults de trial/billing configuráveis.
3. **Sem log de sistema** — o modelo `AuditLog` existe no schema mas nunca é escrito/lido em lugar nenhum (código morto). O usuário pediu um log de acesso completo, no padrão do projeto de referência `D:\Projetos\clit\prevconsulta\apps\backoffice` (interceptor global de HTTP + tela com filtros e drawer de detalhes).

Além disso, foi identificada uma falha de isolamento: **qualquer usuário autenticado** consegue navegar para `/tenants` e `/email` hoje — o link aparece pra todo mundo na Sidebar e nada no frontend impede o acesso (só a API bloqueia via `SuperAdminGuard`, então a página carrega e só os dados falham com 403). Isso será corrigido junto.

Decisões já validadas com o usuário:
- Log de sistema = log de acesso HTTP completo (estilo prevconsulta), não uma trilha de auditoria curada.
- Configurações gerais = SMTP (consolidado nesta área) + flags de sistema (manutenção, registro de tenants) + defaults de trial/billing por plano.
- Planos = visualização + permitir override manual do plano de um tenant (bypass do Stripe), sinalizando claramente que a assinatura Stripe não é alterada.
- Isolamento de acesso admin será corrigido agora (Sidebar só mostra itens admin pra quem é `isSuperAdmin`; layout redireciona quem não é).

## 1. Schema (Prisma)

Arquivo: `packages/database/prisma/schema.prisma`

**`PlatformSettings`** (singleton, mesmo padrão de `PlatformSmtpSettings`):
```prisma
model PlatformSettings {
  id                        String   @id @default("default")
  maintenanceMode           Boolean  @default(false)
  maintenanceMessage        String?
  newTenantRegistrationOpen Boolean  @default(true)
  defaultTrialDays          Int      @default(7)
  defaultConversationsLimit Int      @default(100)
  planConversationLimits    Json     @default("{\"STARTER\":100,\"GROWTH\":1000,\"SCALE\":5000,\"ENTERPRISE\":20000}")
  updatedAt                 DateTime @updatedAt
}
```

**`SystemAccessLog`** (novo — não reaproveitar o `AuditLog` morto, formatos diferentes):
```prisma
model SystemAccessLog {
  id         String   @id @default(uuid())
  tenantId   String?
  userId     String?
  userEmail  String?
  method     String
  endpoint   String
  statusCode Int
  payload    Json?
  ip         String?
  userAgent  String?
  duration   Int
  createdAt  DateTime @default(now())

  @@index([createdAt])
  @@index([tenantId, createdAt])
  @@index([userId])
  @@index([method])
}
```
- `tenantId` nullable (login/register não têm tenant ainda); sem relação FK — precisa sobreviver a delete de tenant/user.
- Migração: `pnpm --filter @whatsagent/database prisma migrate dev --name add_platform_settings_and_system_access_log`.

## 2. Backend (`apps/api`)

Três módulos novos, irmãos de `platform-email` (convenção já estabelecida: um módulo por preocupação platform-wide, guardado com `@UseGuards(JwtAuthGuard, SuperAdminGuard)`):

```
apps/api/src/modules/system-log/
  system-log.module.ts        // registra APP_INTERCEPTOR
  system-log.controller.ts    // GET /super-admin/system-log (paginado + filtros)
  system-log.service.ts
  system-log.interceptor.ts   // interceptor global
  dto/query-system-log.dto.ts

apps/api/src/modules/platform-settings/
  platform-settings.module.ts
  platform-settings.controller.ts  // GET/PUT /super-admin/settings
  platform-settings.service.ts
  dto/update-platform-settings.dto.ts

apps/api/src/modules/plans/
  plans.module.ts
  plans.controller.ts   // GET /super-admin/plans, POST /super-admin/plans/:tenantId/override
  plans.service.ts
  dto/override-plan.dto.ts
```

**Interceptor de acesso** (`system-log.interceptor.ts`): captura toda request (método, endpoint, status, ip, duração, payload, `userId`/`userEmail`/`tenantId` de `req.user`), grava fire-and-forget (nunca derruba a request). Skip-list: `/health`, `/webhooks/*`, `/socket.io`, `/auth/me` (chamado toda navegação). Sanitiza chaves sensíveis do payload (`password`, `passwordHash`, `refreshToken`, `accessToken`, `passwordEncrypted`) e trunca payloads grandes.

**Plans override**: atualiza `Tenant.planType` e, se existir, `PlatformBilling.currentPlan`/`conversationsLimit` (usando `PlatformSettings.planConversationLimits`). **Não toca em `stripeSubId`/`stripeCustomerId`** — resposta inclui aviso explícito de que a assinatura Stripe não é afetada.

**Risco a documentar, não resolver agora**: `PlatformBilling` hoje não é criado em nenhum lugar (`createTenantAndUser` nunca grava essa tabela) — a view de planos e o override devem tratar `billing` como opcional/nulo em todo lugar.

## 3. Frontend (`apps/web`)

Novas rotas em `apps/web/src/app/(admin)/`:
```
plans/page.tsx
system-settings/page.tsx
system-log/page.tsx
```
(nomes `system-settings`/`system-log` para não colidir com `/settings` já existente, tenant-scoped).

Hooks novos ao lado dos existentes em `apps/web/src/features/admin/api/` (sem mexer no `queries.ts` atual):
```
system-log.ts           // useSystemLog(filters, page)
platform-settings.ts    // usePlatformSettings, useSavePlatformSettings
plans.ts                // usePlansOverview, useOverridePlan
components/LogDrawer.tsx    // drawer lateral com payload JSON
```

Padrão visual: reaproveitar as classes `super-admin-*` já existentes em `globals.css` (tema claro do admin, distinto do OLED do resto do app — inconsistência pré-existente, não será resolvida aqui). Novas classes conforme necessário: badges coloridos por método HTTP e por faixa de status, drawer lateral.

- `system-log/page.tsx`: barra de filtros (método, endpoint/IP com debounce, data de/até), tabela em grid CSS, clique na linha abre drawer com JSON completo, paginação simples.
- `plans/page.tsx`: tabela de tenants com plano atual, uso, limite; ação de override manual com aviso "assinatura Stripe não afetada".
- `system-settings/page.tsx`: seções — flags (manutenção, registro de tenants), defaults de trial/limite por plano, e o formulário de SMTP já existente reaproveitado (`useSmtpSettings`/`useSaveSmtp`/`useTestSmtp`, sem alteração).

## 4. Correção de isolamento de acesso

- **`apps/web/src/app/(admin)/layout.tsx`** vira Server Component async, usando `getServerUser()` (já existe em `apps/web/src/server/auth.ts`, mesmo helper usado no root layout): se `!user?.isSuperAdmin`, `redirect("/overview")`. Essa é a fonte de verdade da autorização no frontend — o JWT não carrega `isSuperAdmin` (payload é só `{sub, tenantId}`), então checar isso em `middleware.ts` exigiria uma chamada de rede extra sem ganho real; o layout já faz esse papel.
- **`apps/web/src/middleware.ts`**: adicionar `/plans`, `/system-settings`, `/system-log` a `PROTECTED_PREFIXES` (só para garantir redirect a `/login` se não autenticado — igual às demais rotas protegidas). Sem checagem de papel aqui.
- **`apps/web/src/components/layout/Sidebar.tsx`**: filtrar `NAV` por `user?.isSuperAdmin` antes de renderizar (usar `useAuthContext()`), escondendo a seção "Plataforma" inteira para quem não é super-admin. Adicionar os 3 novos itens (`Planos`, `Configurações do Sistema`, `Logs do Sistema`) à seção "Plataforma", todos com `admin: true`. Super-admins continuam vendo normalmente as seções "Menu"/"Configurar" (sem restringi-los do dashboard do próprio tenant).
- `apps/web/src/app/api/proxy/[...path]/route.ts`: sem alteração — autorização real já é responsabilidade do `SuperAdminGuard` na API; o redirect do layout cobre o frontend.

## 5. Sequenciamento

1. Schema + migração (`PlatformSettings`, `SystemAccessLog`) → verificar `prisma generate` e migração aplicada.
2. Módulos backend (`system-log`, `platform-settings`, `plans`) + registrar `SystemLogModule` em `app.module.ts` → testar com token super-admin (200) e token normal (403).
3. Correção de isolamento (`(admin)/layout.tsx`, `middleware.ts`, `Sidebar.tsx`) — fazer isso **antes/junto** das páginas novas, para que as rotas nunca fiquem expostas a não-admins durante o desenvolvimento.
4. Páginas + hooks do frontend.
5. Necessário garantir pelo menos um usuário com `isSuperAdmin = true` para testar (via seed existente ou update manual, já discutido na conversa).

## Verificação

- `pnpm --filter @whatsagent/database migrate:dev` roda sem erro, `prisma generate` ok.
- `pnpm --filter @whatsagent/api build` e testes unitários dos novos services.
- Smoke manual: logar como super-admin → ver as 3 novas telas funcionando (log de acesso populado, settings salvando, override de plano funcionando com aviso de Stripe). Logar como usuário normal → seção "Plataforma" some da Sidebar e acesso direto a `/plans`, `/system-settings`, `/system-log`, `/tenants`, `/email` redireciona para `/overview`.

## Riscos abertos (documentados, não resolvidos nesta fase)

- Volume de escrita do log de acesso completo (toda request, incluindo GET) — sem job de retenção/limpeza ainda; sugerir BullMQ repeatable job futuro para podar `SystemAccessLog` antigo.
- `PlatformBilling` não é populado hoje em `createTenantAndUser` — a view de planos deve tratar isso como opcional em todo lugar.
- Duplicação pré-existente de IDs Stripe entre `Tenant` e `PlatformBilling` — não é corrigida aqui, e o override de plano deliberadamente não escreve em nenhum dos dois campos Stripe para não aprofundar o desalinhamento.
- Tema claro do admin (`super-admin-*`) continua distinto do OLED do resto do app — mantido por consistência com as telas já existentes, não corrigido nesta fase.
