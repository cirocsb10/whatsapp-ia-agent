# Design: Clerk Webhook — Sincronização de Usuários

## Contexto

O WhatsAgent usa Clerk para autenticação. O `ClerkAuthGuard` já valida JWTs e busca o `User` no banco pelo `clerkId`. O problema atual é que não existe nenhum mecanismo para criar o `User` e o `Tenant` no banco quando alguém se cadastra no Clerk — sem isso, o guard rejeita todos os logins com "User not found in system".

## Decisões

- **Criação automática no signup**: webhook `user.created` do Clerk cria `Tenant` + `User` (OWNER) automaticamente. Sem onboarding wizard, sem Clerk Organizations.
- **Um Tenant por signup**: cada novo usuário vira um tenant em trial. Multi-usuário no mesmo tenant será adicionado depois via convites.
- **Soft delete**: `user.deleted` desativa o usuário (`isActive: false`), não apaga dados.

## Arquitetura

### Novo módulo: `apps/api/src/modules/clerk/`

```
clerk-webhook.controller.ts   POST /webhooks/clerk
clerk-webhook.service.ts      lógica de criação/atualização/desativação
clerk-webhook.module.ts       registra no NestJS
```

Registrado em `AppModule`.

### Dependência nova

```
svix  — biblioteca oficial do Clerk para verificação de assinatura de webhook
```

### Endpoint

`POST /webhooks/clerk` — público (sem `ClerkAuthGuard`), protegido por validação de assinatura Svix.

Headers obrigatórios: `svix-id`, `svix-timestamp`, `svix-signature`.

Retorna `200` em todos os casos de sucesso (inclusive eventos ignorados) para o Clerk não retentar.

### Eventos tratados

| Evento | Ação |
|---|---|
| `user.created` | Cria `Tenant` + `User` (OWNER, TRIAL) |
| `user.updated` | Sincroniza `name`, `email`, `avatarUrl` |
| `user.deleted` | Seta `User.isActive = false` |
| outros | Ignora silenciosamente, retorna 200 |

### Lógica de `user.created`

**Tenant:**
- `name`: `first_name + last_name` do Clerk, fallback para prefixo do email
- `slug`: slugify do email prefix + 4 chars aleatórios para garantir unicidade (ex: `joao-silva-a3f2`)
- `status`: `TRIAL`
- `planType`: `STARTER`

**User:**
- `clerkId`: `id` do payload Clerk
- `email`: `email_addresses[0].email_address`
- `name`: `first_name + last_name`
- `avatarUrl`: `image_url` (opcional)
- `role`: `OWNER`
- `isActive`: `true`

### Validação de assinatura

```ts
import { Webhook } from 'svix';

const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
const evt = wh.verify(rawBody, headers); // lança se inválido
```

O controller deve receber o `rawBody` (Buffer), não o JSON parseado — configurar `bodyParser: false` na rota ou usar `RawBodyMiddleware`.

## Configuração externa já feita

- Endpoint registrado no Clerk: `https://placeholder.com/webhooks/clerk`
- Evento subscrito: `user.created`
- `CLERK_WEBHOOK_SECRET` preenchido no `.env.local`

## Pendências pós-implementação

1. Atualizar a URL do webhook no Clerk para a URL real (ngrok em dev, domínio em prod)
2. Adicionar `user.updated` e `user.deleted` nos eventos subscritos no painel do Clerk
