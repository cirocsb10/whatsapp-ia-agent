# Design: Multicanal WhatsApp + Campanhas (Multimais)

**Date:** 2026-07-23  
**Status:** Approved for planning  
**Source plan:** `.plans/28-multicanal-campanhas.md`  
**Related:** `.docs/ebook-ubots-bloqueio-BDaKT_wc.md` (compliance principles)

## Problem

O tenant Multimais precisa operar ~16 números WhatsApp Business sob uma conta, blindar números na API oficial (com ou sem IA), dar visibilidade por número aos atendentes, tornar a progressão automática do CRM opcional, estimar custo de mensageria Meta, e disparar campanhas via templates aprovados — sem usar envio em massa não-oficial.

## Goals

1. Múltiplos `WhatsappChannel` por tenant, com formulário manual de credenciais Meta.
2. Toggle de IA por canal (modo “blindado” = só registra).
3. Visibilidade e resposta por **membership** no canal (não por `assignedUserId`).
4. Indicador derivado “Em atendimento por X” / “IA”.
5. Flag `crmProgressionEnabled` no `AgentConfig`.
6. Calculadora de custo estimado (por tenant e por canal).
7. Módulo de campanhas isolado do LangGraph, só templates Meta `APPROVED`, opt-out na montagem da audiência.

## Non-goals (this delivery)

- Meta Embedded Signup / OAuth (formulário manual agora; contrato preparado).
- Grupos/segmentos de audiência salvos e reutilizáveis.
- Import CSV de telefones.
- Hierarquia gestor→equipe além de OWNER/ADMIN vs AGENT.
- Remoção imediata dos campos escalares `Tenant.whatsapp*` (fica ponte por 1 release).
- Atribuição manual de conversas como regra de acesso.

## Decisions locked

| Topic | Choice |
|---|---|
| Escopo da sessão | Todas as 6 fases, incremental, commit por funcionalidade |
| Conexão de número | Formulário manual (`phoneId`, token, `wabaId`, número) |
| Nome do canal | `displayName` obrigatório |
| Membros do canal | N:N opcional; OWNER/ADMIN veem/respondem tudo |
| Visibilidade AGENT | Canais em que é membro |
| “Em atendimento” | Derivado da última msg outbound humana; só IA → rótulo “IA” |
| Audiência de campanha | Todos + filtro por estágio CRM; sem segmentos salvos |
| Templates | Sync via Business Management API da Meta |
| Implementação | Incremental por fase (0+1 → 2 → 3 → 4 → 5) |

## Architecture overview

```
Meta webhook (phone_number_id)
  → channel-service.resolveChannel
  → persist Conversation(+channelId) + Message (sempre)
  → se isPublished && channel.isAiEnabled → msg.inbound → ai-orchestrator
  → ai.response(+channelId) → OutboundConsumer (token do canal)

Campanhas (isolado):
  api/campaigns → BullMQ send → Meta template API (token do canal)
  Meta status webhook → RabbitMQ campaign.status → api atualiza CampaignRecipient
```

## Phase 0–1 — Multi-número + toggle IA

### Schema

**WhatsappChannel**
- `id`, `tenantId`, `displayName` (required)
- `whatsappPhoneId` (unique), `whatsappNumber`, `metaAccessToken`, `wabaId`
- `status` (e.g. ACTIVE / INACTIVE), `isDefault`, `isAiEnabled`
- timestamps

**WhatsappChannelMember**
- `channelId`, `userId`, unique `(channelId, userId)`
- Membros opcionais no create; lista pode ficar vazia

**Conversation**
- Add `channelId` (nullable during migration window, required after backfill for new rows)

**Tenant**
- Keep scalar `whatsappPhoneId` / `whatsappNumber` / `metaAccessToken` for one release as bridge

### Migration / backfill

1. Additive migration + models.
2. Backfill: one `WhatsappChannel` per tenant with `whatsappPhoneId` set; `isDefault: true`; `isAiEnabled` copied from current `AgentConfig.isPublished` (**must not use column default alone**).
3. Backfill `Conversation.channelId` to the tenant default channel where possible.
4. Deploy: channel-service reads `WhatsappChannel` with defensive fallback to `Tenant` scalars for one release.
5. Later release: remove fallback and scalars (out of this delivery’s hard cut, but code paths documented).

### Backend

- `resolveChannel(phoneNumberId)` → `{ tenantId, channelId, isAiEnabled, accessToken }`; Redis key `channel:phone:{id}`.
- Meta client accepts token per call.
- RabbitMQ `msg.inbound` / `ai.response` payloads include `channelId`.
- Module `apps/api/src/modules/channels/`: CRUD, members, `toggleAi`; `@Roles("OWNER","ADMIN")`.
- Effective AI gate: `AgentConfig.isPublished && channel.isAiEnabled`.
- When AI off: still persist inbound; skip `msg.inbound` publish and inactivity AI timers.

### Frontend

- Settings tab “Números conectados”: list / add / edit / remove / members / AI switch.
- Badges: “IA ativa” vs “Blindado (só registrando)”.
- Follow existing settings / dark OLED / shadcn patterns (`ui-ux-pro-max` + design system).

## Phase 2 — Visibility + attending indicator

### Visibility

- `ConversationsService.findAll(tenantId, currentUser)`:
  - OWNER/ADMIN: all tenant conversations.
  - AGENT: `channelId IN` memberships of `currentUser`.
- Same rule for reply / get-by-id authorization.
- No unassigned queue; no access filter on `assignedUserId`.

### Attending indicator

- Today `Message` has `direction` + `isFromAi` but **no user author**. Add nullable `Message.sentByUserId` (FK User); set it on human inbox replies; leave null for AI/inbound.
- Compute from last `OUTBOUND` message:
  - `isFromAi = false` and `sentByUserId` set → “Em atendimento por {name}”.
  - Only AI outbounds so far (`isFromAi = true`) → “IA”.
  - Inbound customer messages do not change the indicator.
- Expose on conversation list/detail DTOs (e.g. `attendingLabel` / `attendingUserId`).
- No assign UI in this delivery.

## Phase 3 — Optional CRM progression

- `AgentConfig.crmProgressionEnabled Boolean @default(true)`.
- Gate at start of every public method in `crm-progression.service.ts` (no-op + log if disabled).
- DTO + agent/settings toggle next to publish control.

## Phase 4 — Messaging cost estimate

### Schema

**MessagePricingRate**
- `tenantId` optional (null = platform default)
- `category` (Meta conversation categories: marketing, utility, authentication, service, …)
- `countryCode`, `priceBrlCents`, `effectiveFrom`, `effectiveTo`

Persist Meta pricing category on message/conversation when status webhook provides it.

### Status webhook

- Extend `MetaStatus` DTO to accept optional `pricing` / `conversation` fields from Meta.
- When present, store category for cost aggregation.
- When absent, heuristic estimate (template campaign sends → template category; reactive service window → service).

### API / UI

- Aggregation by tenant, channel, category, period → estimated cost + monthly projection.
- UI “Uso e custos” with explicit **estimativa** label (not Meta invoice).

## Phase 5 — Campaigns

### Schema

- **MessageTemplate**: tenantId, channelId, Meta name/language/category/status, body variables snapshot
- **Campaign**: tenantId, channelId, templateId, name, `audienceQuery` JSON, status, scheduledAt
- **CampaignRecipient**: campaignId, contactId, delivery status, waMessageId, sent/delivered/read timestamps, failure reason

### Audience

`audienceQuery` shapes for v1:
- `{ type: "all" }`
- `{ type: "crm_stage", stageId: string }`

Always exclude `Contact.isOptedOut` (and `optOutAt` set) when building recipients — not only at send time.

No saved reusable segments; campaign `name` is the durable label (e.g. “Aniversário Salvador 2026”).

### Backend

- Module `apps/api/src/modules/campaigns/`: templates sync, audience build, campaign CRUD, dispatch job (BullMQ).
- Sync templates from Meta using channel `wabaId` + token; only `APPROVED` templates selectable for send.
- Delivery tracking: channel-service status handler publishes `campaign.status` on RabbitMQ; api consumer updates `CampaignRecipient` without coupling campaign domain into channel-service beyond event emit.

### Frontend

- Route `(dashboard)/campaigns/`: template list + sync, campaign builder (name, channel, template, audience filter), history with per-recipient status.

### Convention update

- Update `CLAUDE.md`: LangGraph pipeline remains 100% reactive; **only** the campaigns module may send Meta template (business-initiated) messages.

## Compliance notes (from Ubots ebook)

Bake into product behavior, not marketing copy:
- Official API only; no unofficial mass send.
- Templates for proactive sends.
- Opt-in/opt-out respect; frequency and relevance via CRM-filtered audiences.
- Centralized history across numbers; governance via channel membership + OWNER/ADMIN oversight.

## Testing strategy

- Unit: resolveChannel (+ fallback), AI gate, membership visibility, CRM no-op flag, audience opt-out exclusion, pricing aggregation, campaign status mapping.
- After each phase: run relevant package unit tests; commit by functionality.
- Manual/verification checklist from `.plans/28-multicanal-campanhas.md` (two channels, AI off logging, AGENT scope, CRM toggle, cost estimate, campaign opt-out + delivery).

## Risks

| Risk | Mitigation |
|---|---|
| Webhook routing break during cutover | Dual read fallback one release + backfill count check |
| Wrong `isAiEnabled` backfill | Copy from `AgentConfig.isPublished` explicitly |
| AGENT sees empty inbox | Optional members + OWNER/ADMIN full access; document Multimais setup (add members per number) |
| Meta status without pricing category | Heuristic + UI “estimativa” |
| Campaign compliance | Opt-out at audience build; APPROVED-only templates |

## Implementation order

1. Phase 0+1 (schema, channel-service, api channels, settings UI, AI gate)
2. Phase 2 (visibility + attending indicator)
3. Phase 3 (CRM flag)
4. Phase 4 (pricing + analytics UI)
5. Phase 5 (campaigns module + CLAUDE.md note)
6. Unit tests refreshed per area; commits per functionality
