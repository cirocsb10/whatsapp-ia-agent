# Design: Meta/WhatsApp — Gaps de Código

## Contexto

O channel-service já tem a estrutura completa para receber e enviar mensagens via Meta Cloud API:
- `WebhookController` recebe e valida HMAC
- `WebhookService` processa mensagens e publica no RabbitMQ
- `MetaApiClient` envia mensagens
- `OutboundConsumer` consome respostas do AI e despacha via Meta

O setup externo foi concluído (app criado, webhook configurado, credenciais no `.env.local`). O canal recebe webhooks corretamente.

Três gaps impedem o fluxo ponta-a-ponta funcionar:

## Gap 1 — Tenant sem `whatsappPhoneId` (bloqueador)

O `WebhookService.resolveTenantId()` busca o tenant pelo `whatsappPhoneId`. Mas tenants criados pelo Clerk webhook têm esse campo nulo — nunca foi configurado. Sem isso, toda mensagem é rejeitada com "No tenant found for phone number ID".

**Solução:** Adicionar um endpoint `PATCH /settings/whatsapp` na API que permite ao tenant configurar seu `whatsappPhoneId` e `metaAccessToken`. Para dev, também criar um script/seed que configura o tenant de teste diretamente no banco.

**Arquivo a modificar:**
- Criar `apps/api/src/modules/settings/settings.module.ts`
- Criar `apps/api/src/modules/settings/settings.controller.ts`
- Criar `apps/api/src/modules/settings/settings.service.ts`
- Modificar `apps/api/src/app.module.ts`

## Gap 2 — Contact/Conversation não são criados no banco

O `WebhookService.processMessage()` publica no RabbitMQ mas não persiste nada. O inbox do back-office fica vazio porque as tabelas `Contact`, `Conversation` e `Message` permanecem vazias.

**Solução:** Antes de publicar no RabbitMQ, o `WebhookService` deve:
1. Upsert do `Contact` pelo `phone` + `tenantId`
2. Buscar ou criar `Conversation` ativa para esse contact
3. Salvar o `Message` inbound no banco
4. Atualizar `Conversation.lastMessageAt`

**Arquivo a modificar:** `apps/channel-service/src/webhook/webhook.service.ts`

## Gap 3 — Opt-out não persiste

Quando o usuário manda "parar"/"stop", o `WebhookService` detecta e loga, mas não persiste `contact.isOptedOut = true`. Em todas as mensagens subsequentes o sistema continua respondendo.

**Solução:** No bloco de opt-out do `WebhookService`, após detectar a keyword, fazer:
1. Upsert do Contact (mesmo fluxo do Gap 2)
2. `prisma.contact.update({ isOptedOut: true, optOutAt: new Date() })`
3. Retornar sem publicar no RabbitMQ

**Arquivo a modificar:** `apps/channel-service/src/webhook/webhook.service.ts`

## Ordem de implementação

1. **Gap 1** (settings endpoint) — desbloqueante para testar os demais
2. **Gap 2 + Gap 3** juntos — ambos no `WebhookService`, mesma lógica de upsert de Contact

## Decisões de design

- O `WebhookService` já injeta `PrismaService` — sem nova dependência
- O upsert de Contact usa `prisma.contact.upsert({ where: { tenantId_phone } })`
- Conversation é buscada por `status IN [ACTIVE, HUMAN_HANDOFF]` + `contactId` — se não existe, cria nova
- Settings endpoint é protegido por `ClerkAuthGuard` (apenas o OWNER do tenant pode configurar)
- Para dev: seed script que popula `whatsappPhoneId = "1168626729666802"` no tenant do banco

## O que NÃO está no escopo

- Interface de configuração no frontend (será feita na fase de UI)
- Multi-número por tenant
- Conectar número real (requer verificação da empresa na Meta)
