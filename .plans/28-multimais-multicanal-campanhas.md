# Plano: Novas Funcionalidades do Chatbot (Reunião Multimais 09/07/2026)

## Contexto

A transcrição `.docs/2026 07 09 11 07 01 Reunião Presencial Multmais.txt` mistura dois assuntos: a maior parte trata do sistema de convenção/cupons da Multimais (projeto `convencao_multmais`, fora de escopo aqui). A partir da linha ~500, a conversa muda para uma demo do **próprio WhatsAgent** (este repositório) sendo apresentado ao cliente Multimais como ferramenta de atendimento via WhatsApp. Durante essa demo/discussão surgiram 6 gaps concretos entre o que o cliente precisa e o que o produto faz hoje.

Rodei um agente de exploração para confirmar, arquivo por arquivo, o que já existe vs. o que falta (2 dos 8 itens levantados inicialmente já estavam implementados: horário comercial por tenant e retomada humana de conversa). Os 6 itens abaixo foram confirmados como gaps reais e o usuário validou que todos devem entrar no plano — incluindo o módulo de disparo/campanha, que exige uma exceção explícita à convenção "Agents never initiate conversations" do CLAUDE.md (usando o mecanismo oficial de *template messages* da Meta, que tem perfil de risco diferente do envio em massa não-oficial que a regra original visa evitar).

**Objetivo:** permitir que o tenant Multimais conecte 9–13 números do WhatsApp Business sob uma única conta, blinde números contra bloqueio da Meta migrando-os para a API oficial (sem necessariamente ativar a IA de imediato), dê visibilidade individualizada/hierárquica de conversas aos atendentes, torne a progressão automática do funil de CRM opcional, forneça uma estimativa de custo de mensageria, e habilite disparo de campanhas via templates aprovados pela Meta.

## Ordem das fases e dependências

Fase 0 (multi-número) é a base técnica para quase tudo: schema, roteamento de webhook e contrato de envio outbound. Fases 1–4 dependem dela em graus variados; Fase 5 (campanhas) é o módulo novo maior e depende das Fases 0 e 4 (custo por envio).

```
Fase 0: Multi-canal WhatsApp (fundação)
   → Fase 1: Toggle de IA por canal
   → Fase 2: Visibilidade hierárquica de conversas
   → Fase 3: Funil de CRM opcional
   → Fase 4: Calculadora de custo de mensageria
   → Fase 5: Disparo/campanha (módulo novo, fora do fluxo reativo)
```

---

## Fase 0 — Múltiplos números WhatsApp por tenant

**Estado atual confirmado:** `Tenant` tem campos escalares `whatsappPhoneId`/`whatsappNumber`/`metaAccessToken` (`packages/database/prisma/schema.prisma` ~L142-176). `WebhookService.resolveTenantId` (`apps/channel-service/src/webhook/webhook.service.ts:289-311`) resolve o tenant via `prisma.tenant.findFirst({ where: { whatsappPhoneId } })`, cacheado no Redis (`tenant:phone:{id}`, TTL 3600s) — estritamente 1:1 tenant↔número.

**Mudança de schema** (`packages/database/prisma/schema.prisma`): novo modelo `WhatsappChannel` (tenantId FK, `whatsappPhoneId` único, `whatsappNumber`, `metaAccessToken`, `wabaId`, `status`, `isDefault`, `isAiEnabled` — este último já preparando a Fase 1). Manter os campos escalares do `Tenant` por uma release como ponte de migração (não remover ainda).

**Backend:**
- `webhook.service.ts`: substituir `resolveTenantId` por `resolveChannel(phoneNumberId)`, retornando `{ tenantId, channelId, isAiEnabled, accessToken }` via `prisma.whatsappChannel.findUnique`. Cache key `channel:phone:{id}`.
- Cliente Meta (`meta-api.client.ts` ou equivalente) passa a aceitar token por chamada em vez de token único configurado.
- Payload RabbitMQ (`msg.inbound`/`ai.response`) ganha `channelId` para que `apps/ai-orchestrator/src/consumers/rabbitmq.py` e o `OutboundConsumer` saibam por qual número responder.
- Novo módulo `apps/api/src/modules/channels/` (CRUD de `WhatsappChannel`, `@Roles("OWNER","ADMIN")`), substituindo a lógica de número único hoje em `apps/api/src/modules/settings/settings.service.ts`.

**Frontend:** nova tela "Números conectados" em `apps/web/src/app/(dashboard)/settings/` (listar/adicionar/remover números, status por linha), seguindo o padrão visual já usado nas telas de settings (dark OLED, shadcn/ui).

**Risco de migração (o mais alto do plano):** script de backfill cria 1 `WhatsappChannel` por tenant existente com `whatsappPhoneId` preenchido, com `isDefault: true` e `isAiEnabled` = valor atual de `AgentConfig.isPublished` (**não deixar isso no default da coluna** — se o backfill não copiar esse valor explicitamente, todo tenant existente perde a IA silenciosamente). Deploy em 3 passos: (a) migration aditiva + backfill com verificação de contagem, (b) channel-service lendo de `WhatsappChannel` com fallback defensivo para os campos legados do `Tenant` por uma release, (c) remoção do fallback e dos campos escalares em migration posterior.

---

## Fase 1 — Toggle de IA por número

Usa o campo `isAiEnabled` já criado na Fase 0 — aqui é só a lógica de comportamento.

- `webhook.service.ts`: a persistência da mensagem (bloco `tx.message.create`) sempre roda — é isso que viabiliza o cenário de "blindagem" (número na API oficial, humano responde manualmente, conversa fica logada). Só a publicação do evento `msg.inbound` e o agendamento do timer de inatividade ficam condicionados a `channel.isAiEnabled`.
- Gate efetivo: `agentConfig.isPublished && channel.isAiEnabled` — mantém `AgentConfig.isPublished` como chave-mestra por tenant, e `WhatsappChannel.isAiEnabled` como override por número.
- `channels.service.ts`: método `toggleAi(channelId, enabled)`.
- Web: switch de IA por linha na tela de números da Fase 0, com badge "Blindado (só registrando)" vs "IA ativa".

---

## Fase 2 — Visibilidade hierárquica de conversas

**Estado atual confirmado:** `UserRole` (OWNER/ADMIN/AGENT/VIEWER) existe com `RolesGuard` (`apps/api/src/common/guards/roles.guard.ts`) gateando *ações* via `@Roles()`, mas `ConversationsService.findAll` (`apps/api/src/modules/conversations/conversations.service.ts:34-46`) não filtra por usuário — todo AGENT vê todas as conversas do tenant, apesar de `Conversation.assignedUserId` já existir no modelo.

- `findAll(tenantId, currentUser)`: para `role === "AGENT"`, adicionar `assignedUserId: currentUser.id` ao `where`; OWNER/ADMIN continuam vendo tudo (atende ao pedido do cliente de "por enquanto, pelo menos um usuário master vê tudo").
- `conversations.controller.ts`: injetar `@CurrentUser()` (decorator já existe) e repassar ao service.
- **Importante:** precisa existir (ou criar) um endpoint de "conversas não atribuídas" para o AGENT poder ver/reivindicar conversas novas — senão o filtro estrito por `assignedUserId` esconde todo atendimento recém-chegado de todo mundo.
- Hierarquia mais completa (gestor vê só sua equipe) fica deliberadamente fora desta fase — cliente confirmou que pode vir depois.
- Sem mudança de schema necessária; risco baixo tecnicamente, mas risco de UX (agentes deixam de ver conversas que viam antes) — vale rollout por tenant.

---

## Fase 3 — Funil de CRM configurável (liga/desliga)

**Estado atual confirmado:** `apps/api/src/modules/crm/crm-progression.service.ts` roda `advanceToPosition`/`advanceToWon`/`advanceToLost` incondicionalmente, chamado a partir de `conversations.service.ts:195` e do fluxo de webhook — sem nenhuma flag de tenant hoje.

- Schema: `AgentConfig.crmProgressionEnabled Boolean @default(true)` (aditivo, zero impacto em tenants existentes).
- `crm-progression.service.ts`: cada método público lê a flag no início e faz no-op (com log) se desabilitado — centralizar o gate no service, não em cada call site.
- DTO de update do `AgentConfig` ganha o campo correspondente.
- Web: toggle "Progressão automática do funil CRM" na tela de agente/settings, ao lado do toggle de publicação existente.

---

## Fase 4 — Calculadora de custo de mensageria

**Estado atual confirmado:** `Message.aiTokensUsed`/`aiLatencyMs` já são agregados em `apps/api/src/modules/analytics/analytics.service.ts` — mas isso é custo de LLM, não custo de conversa WhatsApp/Meta. `billing.service.ts` só cobre assinatura Stripe da plataforma.

- Novo modelo `MessagePricingRate` (tenantId opcional = null para tarifa padrão da plataforma, `category`, `countryCode`, `priceBrlCents`, vigência `effectiveFrom`/`effectiveTo`) — tabela de preços versionada, já que a Meta varia por categoria/país e muda com o tempo.
- Verificar antes de decidir o shape: se o webhook de status da Meta já traz a categoria da conversa (`apps/channel-service/src/webhook/webhook.controller.ts`, branch de status) — se sim, adicionar `Message.conversationCategory`; senão, derivar heuristicamente.
- Agregação em `analytics.service.ts` (reaproveitando os padrões já existentes) ou novo `apps/api/src/modules/billing/usage.service.ts`: soma por tenant/canal/categoria/período, cruzada com `MessagePricingRate` → custo estimado e projeção mensal.
- Web: aba "Uso e custos" em analytics ou settings — gráfico de volume + tabela de custo estimado, com rótulo explícito de "estimativa".
- Depende do `WhatsappChannel` da Fase 0 para quebrar custo por número (o cliente tem 9-13 números — visão por número é o pedido real, não só por tenant).

---

## Fase 5 — Disparo/campanha (módulo novo, fora do fluxo reativo)

Explicitamente separado do pipeline reativo do LangGraph — sem envolvimento do `ai-orchestrator`, sem mudanças no fluxo padrão de `webhook/`. Usa exclusivamente *template messages* aprovadas pela Meta (Business-Initiated), mecanismo distinto do envio em massa não-oficial que a regra "100% reativo" do CLAUDE.md visa evitar.

**Schema:** três modelos novos —
- `MessageTemplate` (tenantId, channelId, name, language, category, status sincronizado com a Meta, variáveis do corpo)
- `Campaign` (tenantId, channelId, templateId, audienceQuery em JSON, status, scheduledAt)
- `CampaignRecipient` (campaignId, contactId, status de entrega, waMessageId, timestamps de sent/delivered/read, motivo de falha)

**Backend:**
- Novo módulo `apps/api/src/modules/campaigns/`: `templates.service.ts` (sincroniza templates aprovados via Business Management API da Meta, usando `WhatsappChannel.wabaId`), `audience.service.ts` (monta lista de destinatários a partir de `Contact`, **bloqueio obrigatório de contatos com `isOptedOut`/`optOutAt` já na construção da audiência, não só no envio**), `campaigns.service.ts`.
- Job de disparo via BullMQ (seguindo o padrão já existente de `knowledge-embedding.processor.ts`), usando o token de acesso do `WhatsappChannel` escolhido.
- Tracking de entrega/leitura: reaproveitar o callback de status que o `channel-service` já recebe da Meta, mas isolar via evento RabbitMQ (`campaign.status`) para que `channel-service` não precise conhecer o conceito de campanha — mantém a separação limpa.

**Frontend:** novo `apps/web/src/app/(dashboard)/campaigns/` — lista de templates com status de sincronização, builder de campanha (público-alvo + template + número), histórico de disparo com status por destinatário.

**Convenção:** atualizar a nota do CLAUDE.md ("Agents never initiate conversations...") para registrar a exceção explícita de templates via este módulo, mantendo claro que o pipeline reativo do LangGraph continua 100% reativo — só o módulo de campanhas, isolado, envia proativamente.

---

## Resumo de riscos por fase

| Fase | Risco | Mitigação |
|---|---|---|
| 0 | Alto — janela entre backfill e corte pode derrubar roteamento de webhook de todo tenant | fallback duplo por 1 release + checagem de contagem no runbook |
| 1 | Baixo, mas backfill errado desativa IA silenciosamente | copiar `isAiEnabled` explicitamente do `AgentConfig.isPublished` atual no backfill |
| 2 | Baixo tecnicamente, risco de UX (agente some com conversas que via antes) | endpoint de "não atribuídas" na mesma fase + rollout por tenant |
| 3 | Mínimo — aditivo, default `true` preserva comportamento atual | — |
| 4 | Baixo — aditivo; precisão depende de a Meta enviar categoria no webhook | validar payload de status antes de fixar o schema |
| 5 | Superfície nova grande — risco de compliance (opt-out, templates não aprovados) | bloqueio de opt-out na construção da audiência, não só no envio |

## Arquivos críticos

- `packages/database/prisma/schema.prisma`
- `apps/channel-service/src/webhook/webhook.service.ts`
- `apps/channel-service/src/queue/outbound.consumer.ts`
- `apps/api/src/modules/conversations/conversations.service.ts` e `.controller.ts`
- `apps/api/src/modules/crm/crm-progression.service.ts`
- `apps/api/src/modules/settings/settings.service.ts`
- `apps/ai-orchestrator/src/consumers/rabbitmq.py`

## Verificação

- Fase 0: subir tenant de teste com 2 `WhatsappChannel`, confirmar que mensagens inbound de ambos os números chegam ao inbox correto e que a resposta sai pelo número certo.
- Fase 1: desativar `isAiEnabled` num canal e confirmar que a mensagem é logada mas não gera resposta automática; reativar e confirmar retomada.
- Fase 2: logar como AGENT e confirmar que só vê conversas atribuídas a si + endpoint de não-atribuídas; logar como OWNER e confirmar visão completa.
- Fase 3: desligar `crmProgressionEnabled` e confirmar que o funil não avança automaticamente numa conversa de teste.
- Fase 4: gerar mensagens de teste em categorias diferentes e conferir se o total estimado bate com a tabela de preços configurada.
- Fase 5: criar campanha de teste para um contato próprio, confirmar respeito ao opt-out, e status de entrega/leitura refletido corretamente na UI.
