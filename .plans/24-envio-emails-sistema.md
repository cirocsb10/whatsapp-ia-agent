# Plano: Envio de Emails do Sistema (igual ao backoffice do PrevConsulta)

## Contexto

O WhatsAgent hoje **não envia nenhum email** — confirmado por busca completa no repo (nenhum resultado para nodemailer, resend, sendgrid, ses, smtp, mailer, EmailService). O único plano existente é uma menção aspiracional a "Resend" em `.plans/07-multitenant-billing.md`, nunca implementada.

O usuário pediu para replicar a arquitetura de envio de email **do backoffice do projeto `D:\Projetos\clit\prevconsulta`**, que funciona assim (single-tenant):

- **Nodemailer** com transporte SMTP genérico (não um provider gerenciado) — o admin configura host/porta/usuário/senha pela própria UI do backoffice.
- Configuração de SMTP fica **no banco** (não em env vars), com a senha **criptografada em repouso** (AES-256-GCM).
- Envio é **assíncrono via fila** (Bull/Redis) com retry exponencial, processado por um worker dedicado.
- Endpoint de "enviar email de teste" para o admin validar a configuração.
- HTML dos emails é montado como *template literal* inline (não há camada de template) — gap conhecido do projeto de referência.

Como o WhatsAgent é **multi-tenant**, e após alinhamento com o usuário, esta primeira fase implementa:
- **Configuração de SMTP global da plataforma** (gerenciada só pelo super-admin), análoga ao singleton `"default"` do PrevConsulta — não uma config por tenant. É para emails "do sistema" (billing, alertas, onboarding), não emails em nome de um tenant específico.
- **Apenas a infraestrutura + botão de teste** — sem plugar em gatilhos de negócio (billing alerts, welcome email) ainda. Isso fica para uma fase seguinte, uma vez a infra validada.

## Diferenças de stack a respeitar (não copiar 1:1)

| PrevConsulta | WhatsAgent | Ação |
|---|---|---|
| `@nestjs/bull` + `bull` (Bull clássico) | `@nestjs/bullmq` já instalado e configurado em `app.module.ts` (`BullModule.forRootAsync`, conexão via `REDIS_URL`) | Usar **BullMQ**, não instalar `bull`/`@nestjs/bull` |
| Sem `common/crypto` | Não existe utilitário de criptografia no projeto (nem `metaAccessToken` do Tenant é criptografado hoje) | Criar `apps/api/src/common/crypto/secret-cipher.util.ts` novo, mesmo algoritmo (AES-256-GCM) |
| Settings singleton via tabela própria `SmtpSettings` | Prisma schema já tem `PlatformBilling` como modelo singleton-por-plataforma (padrão a seguir) | Criar tabela `PlatformSmtpSettings` com `id` fixo, seguindo o mesmo padrão de singleton |
| Rotas em `apps/api/src/settings/` | Módulos ficam em `apps/api/src/modules/<nome>/` | Criar `apps/api/src/modules/platform-email/` |
| Guard `SuperAdminAuthGuard` | Guards existentes: `ClerkAuthGuard` + `SuperAdminGuard` (usados juntos em `super-admin.controller.ts`) | Reusar os dois guards existentes |
| Sem multi-tenant | `CurrentTenantId` decorator existe mas **não se aplica aqui** (config é plataforma-wide) | Não usar tenant scoping nestas rotas |

## Arquitetura proposta

### 1. Banco de dados (`packages/database/prisma/schema.prisma`)

Novo model, próximo ao `PlatformBilling` existente:

```prisma
model PlatformSmtpSettings {
  id                String   @id @default("default")
  host              String?
  port              Int      @default(587)
  username          String?
  passwordEncrypted String?
  secure            Boolean  @default(false)
  fromEmail         String?
  fromName          String?
  updatedAt         DateTime @updatedAt
}
```

Rodar `pnpm db:migrate` para gerar a migration.

### 2. Criptografia de segredo

`apps/api/src/common/crypto/secret-cipher.util.ts` — porta direta de `prevconsulta/apps/api/src/common/crypto/secret-cipher.util.ts`: `encryptSecret`, `decryptSecret`, `getEncryptionKey(config: ConfigService)` lendo uma nova env var `SETTINGS_ENCRYPTION_KEY` (base64, 32 bytes — gerar com `openssl rand -base64 32`). Adicionar ao `.env.example` da raiz.

### 3. Transporte Nodemailer

`apps/api/src/common/mail/smtp-transporter.util.ts` — porta direta de `prevconsulta/apps/api/src/common/mail/smtp-transporter.util.ts` (`buildTransporter`, `formatFrom`). Adicionar dependência `nodemailer` + `@types/nodemailer` (dev) ao `apps/api/package.json`.

### 4. Módulo `platform-email` (`apps/api/src/modules/platform-email/`)

Seguindo a convenção de módulos existente (ver `billing/`, `payments/`):

- **`platform-smtp-settings.service.ts`** — porta de `smtp-settings.service.ts` do PrevConsulta, adaptada:
  - `getSettings()` — retorna config sanitizada (sem senha) + `configured`/`hasPassword`.
  - `updateSettings(dto)` — upsert em `PlatformSmtpSettings`, criptografa senha se enviada.
  - `getSettingsForSending()` — descriptografa senha, usado pelo processor da fila.
  - `sendTestEmail(dto)` — merge de config salva + overrides do form, envia email de teste síncrono (fora da fila).
- **`platform-email.service.ts`** — equivalente ao `sendEmail()` do `NotificationsService` do PrevConsulta: único ponto de entrada (`sendEmail(to, subject, html)`) que enfileira o job. Injetável por outros módulos (billing, clerk) no futuro.
- **`processors/email.processor.ts`** — worker BullMQ (`@Processor('email')` do pacote `@nestjs/bullmq`, não `@nestjs/bull`), busca config via `getSettingsForSending()`, monta transporter, chama `sendMail`. Mesma política de retry (`attempts: 3, backoff: exponential 2000ms`) definida na chamada `queue.add`.
- **`platform-email.controller.ts`** — rotas super-admin:
  - `GET /super-admin/email/smtp`
  - `PUT /super-admin/email/smtp`
  - `POST /super-admin/email/smtp/test`
  - `@UseGuards(ClerkAuthGuard, SuperAdminGuard)`, seguindo o padrão de `super-admin.controller.ts`.
- **`dto/smtp-settings.dto.ts`** — `UpdateSmtpSettingsDto`, `TestSmtpSettingsDto extends UpdateSmtpSettingsDto` (class-validator).
- **`platform-email.module.ts`** — registra a queue BullMQ `email` via `BullModule.registerQueue({ name: 'email' })`, declara controller + providers (`PlatformSmtpSettingsService`, `PlatformEmailService`, `EmailProcessor`), exporta `PlatformEmailService` para uso futuro por outros módulos.

Registrar `PlatformEmailModule` em `apps/api/src/app.module.ts` (imports).

### 5. Frontend — tela de configuração (super-admin)

Novo arquivo: `apps/web/src/app/(admin)/email/page.tsx`, seguindo o padrão visual/estrutural de `apps/web/src/app/(admin)/tenants/page.tsx` (mesmo layout `(admin)/layout.tsx`, dark OLED design system do projeto). Formulário: host, porta, usuário, senha (mascarada, só reenviada se alterada), secure (toggle TLS), fromEmail, fromName, e botão "Enviar email de teste" com campo de destinatário. Chamadas via `ky` para as 3 rotas do backend.

### 6. Variáveis de ambiente

Adicionar ao `.env.example` (raiz):
```
SETTINGS_ENCRYPTION_KEY=   # gerar com: openssl rand -base64 32
```
Não adicionar `SMTP_*` — a config vive no banco, como no PrevConsulta.

## O que fica fora desta fase (deliberado)

- Nenhum gatilho de negócio conectado ainda (billing alerts, welcome email) — infra pura + teste manual.
- Nenhuma camada de template (React Email/MJML) — mesmo gap do projeto de referência; HTML inline por enquanto.
- Nenhum log de auditoria de envio (`EmailLog`) — o PrevConsulta também não tem; considerar depois se necessário.
- Config por tenant — decidido como fora de escopo nesta fase.

## Verificação

1. `pnpm db:migrate` roda sem erro e cria a tabela `PlatformSmtpSettings`.
2. `pnpm --filter @whatsagent/api test` — cobrir `PlatformSmtpSettingsService` com spec análogo a `smtp-settings.service.spec.ts` (não existe no PrevConsulta, mas seguir padrão `billing.service.spec.ts`).
3. Rodar `pnpm --filter @whatsagent/api dev` + `pnpm --filter @whatsagent/web dev`, logar como super-admin, acessar `/email`, configurar SMTP real (ex.: Gmail SMTP ou Mailtrap), clicar "Enviar teste" e confirmar recebimento.
4. Confirmar que a senha nunca retorna em claro no `GET /super-admin/email/smtp` (apenas `hasPassword: true`).
5. Derrubar o Redis/worker propositalmente e confirmar que o job de teste (se enfileirado) falha e faz retry conforme configurado — nota: o teste síncrono (`sendTestEmail`) não passa pela fila, propositalmente, igual ao PrevConsulta.
