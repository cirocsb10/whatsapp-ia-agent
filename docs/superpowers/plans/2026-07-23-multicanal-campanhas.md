# Multicanal WhatsApp + Campanhas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver multi-number WhatsApp channels per tenant, per-channel AI toggle, membership-based inbox visibility, derived attending indicator, optional CRM progression, messaging cost estimates, and Meta template campaigns — per `docs/superpowers/specs/2026-07-23-multicanal-campanhas-design.md`.

**Architecture:** Additive Prisma models (`WhatsappChannel`, members, pricing, campaigns); channel-service resolves webhook by `phone_number_id` with legacy Tenant fallback; RabbitMQ payloads carry `channelId`; campaigns are isolated from LangGraph (BullMQ + `campaign.status` events).

**Tech Stack:** Prisma, NestJS (api + channel-service), FastAPI consumer (ai-orchestrator), Next.js 14, BullMQ, RabbitMQ, Redis, Jest.

## Global Constraints

- `displayName` required on every channel; members optional (N:N).
- AI gate: `AgentConfig.isPublished && channel.isAiEnabled`.
- AGENT visibility = channel membership only; OWNER/ADMIN see all.
- No assign UI; add `Message.sentByUserId` for attending indicator.
- Campaigns: Meta templates `APPROVED` only; opt-out excluded at audience build; audience `{ type: "all" }` | `{ type: "crm_stage", stageId }`.
- Keep Tenant scalar WhatsApp fields for one release (fallback).
- Commits per functionality; run unit tests after each major task group.
- UI: existing dark OLED / shadcn / feature-first settings patterns.
- Portuguese UI copy.

---

## File Map

### New — database / shared
- Migration under `packages/database/prisma/migrations/`
- `packages/shared-types/src/events.types.ts` — add `channelId`, `campaign.status` routing

### New — api
- `apps/api/src/modules/channels/` (module, controller, service, DTOs, specs)
- `apps/api/src/modules/campaigns/` (templates, audience, campaigns, processor, specs)
- `apps/api/src/modules/billing/usage.service.ts` (or analytics extension) + specs
- Campaign status consumer (RabbitMQ) under `apps/api/src/queue/`

### New — web
- `apps/web/src/features/channels/` (components + api queries)
- Settings tab for connected numbers
- `apps/web/src/app/(dashboard)/campaigns/` + `features/campaigns/`
- Analytics/settings “Uso e custos” panel

### Modified
- `packages/database/prisma/schema.prisma`
- `apps/channel-service/src/webhook/webhook.service.ts` (+ specs)
- `apps/channel-service/src/webhook/dto/meta-webhook.dto.ts`
- `apps/channel-service/src/messaging/meta-api.client.ts`
- `apps/channel-service/src/queue/outbound.consumer.ts`
- `apps/ai-orchestrator/src/consumers/rabbitmq.py`
- `apps/api/src/modules/conversations/*`
- `apps/api/src/modules/crm/crm-progression.service.ts`
- `apps/api/src/modules/agent/*` (crmProgressionEnabled)
- `apps/api/src/modules/settings/*` (deprecate single-number write path or delegate to channels)
- `apps/web` inbox + sidebar
- `CLAUDE.md` campaigns exception note

---

## Task 1 — Prisma schema + migration + backfill

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: migration SQL with backfill

**Produces:** `WhatsappChannel`, `WhatsappChannelMember`, `channelId` on Conversation, `sentByUserId` on Message, `crmProgressionEnabled` on AgentConfig, `MessagePricingRate`, `MessageTemplate`, `Campaign`, `CampaignRecipient`, optional `pricingCategory` on Message

- [ ] **Step 1: Add enums and models to schema**

```prisma
enum WhatsappChannelStatus {
  ACTIVE
  INACTIVE
}

enum CampaignStatus {
  DRAFT
  SCHEDULED
  SENDING
  COMPLETED
  CANCELLED
  FAILED
}

enum CampaignRecipientStatus {
  PENDING
  SENT
  DELIVERED
  READ
  FAILED
  SKIPPED
}

enum MessageTemplateStatus {
  APPROVED
  PENDING
  REJECTED
  PAUSED
  DISABLED
}

model WhatsappChannel {
  id               String                @id @default(uuid())
  tenantId         String
  displayName      String
  whatsappPhoneId  String                @unique
  whatsappNumber   String?
  metaAccessToken  String?
  wabaId           String?
  status           WhatsappChannelStatus @default(ACTIVE)
  isDefault        Boolean               @default(false)
  isAiEnabled      Boolean               @default(false)
  createdAt        DateTime              @default(now())
  updatedAt        DateTime              @updatedAt

  tenant           Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  members          WhatsappChannelMember[]
  conversations    Conversation[]
  messageTemplates MessageTemplate[]
  campaigns        Campaign[]

  @@index([tenantId])
  @@index([tenantId, isDefault])
}

model WhatsappChannelMember {
  id        String   @id @default(uuid())
  channelId String
  userId    String
  createdAt DateTime @default(now())

  channel   WhatsappChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)
  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([channelId, userId])
  @@index([userId])
}

model MessagePricingRate {
  id             String    @id @default(uuid())
  tenantId       String?
  category       String
  countryCode    String    @default("BR")
  priceBrlCents  Int
  effectiveFrom  DateTime  @default(now())
  effectiveTo    DateTime?
  createdAt      DateTime  @default(now())

  tenant         Tenant?   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, category, countryCode])
  @@index([category, countryCode, effectiveFrom])
}

model MessageTemplate {
  id           String                @id @default(uuid())
  tenantId     String
  channelId    String
  name         String
  language     String
  category     String?
  status       MessageTemplateStatus @default(PENDING)
  bodyText     String?
  variables    Json?
  metaId       String?
  lastSyncedAt DateTime?
  createdAt    DateTime              @default(now())
  updatedAt    DateTime              @updatedAt

  tenant       Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  channel      WhatsappChannel       @relation(fields: [channelId], references: [id], onDelete: Cascade)
  campaigns    Campaign[]

  @@unique([channelId, name, language])
  @@index([tenantId])
}

model Campaign {
  id            String         @id @default(uuid())
  tenantId      String
  channelId     String
  templateId    String
  name          String
  audienceQuery Json
  status        CampaignStatus @default(DRAFT)
  scheduledAt   DateTime?
  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  tenant        Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  channel       WhatsappChannel @relation(fields: [channelId], references: [id])
  template      MessageTemplate @relation(fields: [templateId], references: [id])
  recipients    CampaignRecipient[]

  @@index([tenantId, status])
}

model CampaignRecipient {
  id            String                   @id @default(uuid())
  campaignId    String
  contactId     String
  status        CampaignRecipientStatus  @default(PENDING)
  waMessageId   String?                  @unique
  sentAt        DateTime?
  deliveredAt   DateTime?
  readAt        DateTime?
  failedAt      DateTime?
  failureReason String?

  campaign      Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  contact       Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@unique([campaignId, contactId])
  @@index([waMessageId])
  @@index([campaignId, status])
}
```

Also on existing models:
- `Tenant`: relations `whatsappChannels`, `messagePricingRates`, `messageTemplates`, `campaigns`
- `User`: `channelMemberships WhatsappChannelMember[]`
- `AgentConfig`: `crmProgressionEnabled Boolean @default(true)`
- `Conversation`: `channelId String?` + relation + `@@index([tenantId, channelId])`
- `Message`: `sentByUserId String?`, `pricingCategory String?`, relation to User optional
- `Contact`: `campaignRecipients CampaignRecipient[]`

- [ ] **Step 2: Create migration with backfill SQL**

```sql
-- After CREATE TABLE whatsapp_channels ...
INSERT INTO whatsapp_channels (
  id, "tenantId", "displayName", "whatsappPhoneId", "whatsappNumber",
  "metaAccessToken", status, "isDefault", "isAiEnabled", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  t.id,
  COALESCE(t."whatsappNumber", 'Número principal'),
  t."whatsappPhoneId",
  t."whatsappNumber",
  t."metaAccessToken",
  'ACTIVE',
  true,
  COALESCE(ac."isPublished", false),
  NOW(), NOW()
FROM tenants t
LEFT JOIN agent_configs ac ON ac."tenantId" = t.id
WHERE t."whatsappPhoneId" IS NOT NULL;

UPDATE conversations c
SET "channelId" = wc.id
FROM whatsapp_channels wc
WHERE wc."tenantId" = c."tenantId" AND wc."isDefault" = true AND c."channelId" IS NULL;
```

Verify: count tenants with phoneId == count default channels.

- [ ] **Step 3: Run migrate**

```bash
pnpm --filter @whatsagent/database migrate:dev
```

Expected: migration applied, client generated.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/
git commit -m "feat(db): add WhatsappChannel, campaigns, pricing schema"
```

---

## Task 2 — Shared event types + channelId on RabbitMQ payloads

**Files:**
- Modify: `packages/shared-types/src/events.types.ts`
- Modify consumers that parse these events (orchestrator + outbound)

**Produces:** `channelId?: string` on inbound/response; `CAMPAIGN_STATUS` routing key

- [ ] **Step 1: Update types**

```typescript
export const ROUTING_KEYS = {
  // ...existing
  CAMPAIGN_STATUS: "campaign.status",
} as const;

export interface InboundMessageEvent {
  tenantId: string;
  channelId?: string;
  whatsappPhoneId: string;
  // ...rest unchanged
}

export interface AiResponseEvent {
  tenantId: string;
  channelId?: string;
  conversationId: string;
  waPhoneId: string;
  toPhone: string;
  messages: OutboundMessage[];
  triggerHandoff?: boolean;
  handoffReason?: string;
}

export interface CampaignStatusEvent {
  tenantId: string;
  waMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: number;
  failureReason?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(shared-types): add channelId and campaign.status events"
```

---

## Task 3 — channel-service resolveChannel + AI gate + outbound token

**Files:**
- Modify: `apps/channel-service/src/webhook/webhook.service.ts`
- Modify: `apps/channel-service/src/messaging/meta-api.client.ts`
- Modify: `apps/channel-service/src/queue/outbound.consumer.ts`
- Test: `apps/channel-service/src/webhook/webhook.service.spec.ts` (create/extend)

**Interfaces:**
- Produces: `resolveChannel(phoneNumberId): Promise<{ tenantId, channelId, isAiEnabled, accessToken, whatsappPhoneId } | null>`
- AI publish only if `isPublished && isAiEnabled`

- [ ] **Step 1: Write failing tests** for resolveChannel (channel hit, tenant fallback, miss) and AI gate (persist always, publish only when both flags true).

- [ ] **Step 2: Implement resolveChannel** with Redis `channel:phone:{id}` TTL 3600; fallback:

```typescript
const channel = await this.prisma.whatsappChannel.findUnique({
  where: { whatsappPhoneId: phoneNumberId },
  select: { id: true, tenantId: true, isAiEnabled: true, metaAccessToken: true, whatsappPhoneId: true },
});
if (channel) return { tenantId: channel.tenantId, channelId: channel.id, isAiEnabled: channel.isAiEnabled, accessToken: channel.metaAccessToken, whatsappPhoneId: channel.whatsappPhoneId };

const tenant = await this.prisma.tenant.findFirst({
  where: { whatsappPhoneId: phoneNumberId },
  select: { id: true, metaAccessToken: true, whatsappPhoneId: true },
});
if (!tenant) return null;
return { tenantId: tenant.id, channelId: null, isAiEnabled: true, accessToken: tenant.metaAccessToken, whatsappPhoneId: tenant.whatsappPhoneId! };
```

- [ ] **Step 3: Wire processMessage** — set `conversation.channelId`; include `channelId` on `msg.inbound`; gate publish + inactivity on `published && isAiEnabled`.

- [ ] **Step 4: OutboundConsumer** — load token from channel by `channelId` or `waPhoneId`; pass token into Meta client per call.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @whatsagent/channel-service test
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(channel-service): resolve WhatsappChannel and per-channel AI gate"
```

---

## Task 4 — API Channels module + settings UI

**Files:**
- Create: `apps/api/src/modules/channels/*`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/web/src/features/channels/*`
- Modify: settings page / `TabIntegracoes` or new `TabNumeros.tsx`
- Test: `channels.service.spec.ts`

**Endpoints (OWNER/ADMIN):**
- `GET /channels`
- `POST /channels` — body: displayName, whatsappPhoneId, whatsappNumber?, metaAccessToken?, wabaId?, memberUserIds?, isAiEnabled?
- `PATCH /channels/:id`
- `DELETE /channels/:id` (block delete if sole default with active traffic — or allow with reassign default)
- `PUT /channels/:id/members` — `{ userIds: string[] }`
- `PATCH /channels/:id/ai` — `{ enabled: boolean }`

- [ ] **Step 1: Service + tests** (create requires displayName; unique phoneId; toggleAi; replace members).

- [ ] **Step 2: Controller + module registration.**

- [ ] **Step 3: Web UI** — list rows with displayName, number, badges IA/Blindado, members multi-select, add dialog (manual fields).

- [ ] **Step 4: Tests + commit**

```bash
pnpm --filter @whatsagent/api test -- channels
git commit -m "feat(channels): CRUD WhatsappChannel with members and AI toggle UI"
```

---

## Task 5 — Inbox visibility by membership + attending indicator

**Files:**
- Modify: `apps/api/src/modules/conversations/conversations.service.ts`
- Modify: `apps/api/src/modules/conversations/conversations.controller.ts`
- Modify: human reply path to set `sentByUserId`
- Modify: web inbox list to show attending label
- Test: `conversations.service.spec.ts`

**Produces:**
- `findAll(tenantId, user: { id, role })` filters AGENT by memberships
- DTO fields `attendingLabel`, `attendingUserId`

- [ ] **Step 1: Failing tests** — OWNER sees all; AGENT only member channels; attending from last human outbound; AI-only → `"IA"`.

- [ ] **Step 2: Implement filter**

```typescript
const where: Prisma.ConversationWhereInput = { tenantId };
if (user.role === "AGENT") {
  const memberships = await this.prisma.whatsappChannelMember.findMany({
    where: { userId: user.id },
    select: { channelId: true },
  });
  where.channelId = { in: memberships.map((m) => m.channelId) };
}
```

- [ ] **Step 3: attending helper** — last OUTBOUND by `sentAt desc`; if `isFromAi` and no prior human → label `"IA"`; if `sentByUserId` → user name.

- [ ] **Step 4: On agent reply**, set `sentByUserId: currentUser.id`, `isFromAi: false`.

- [ ] **Step 5: Tests + commit**

```bash
git commit -m "feat(inbox): channel membership visibility and derived attending indicator"
```

---

## Task 6 — Optional CRM progression

**Files:**
- Modify: `AgentConfig` already has field from Task 1
- Modify: `apps/api/src/modules/crm/crm-progression.service.ts`
- Modify: agent config DTO + UI toggle
- Test: `crm-progression.service.spec.ts`

- [ ] **Step 1: At start of `advanceToPosition` / `advanceToWon` / `advanceToLost`**, load `crmProgressionEnabled`; if false, log and return.

- [ ] **Step 2: Expose on agent config GET/PATCH + persona/settings toggle.**

- [ ] **Step 3: Tests + commit**

```bash
git commit -m "feat(crm): add crmProgressionEnabled tenant toggle"
```

---

## Task 7 — Messaging cost estimate

**Files:**
- Extend Meta status DTO + webhook status handler to store `pricingCategory`
- Seed default `MessagePricingRate` rows for BR categories (document cents as placeholders editable by admin later)
- `usage.service.ts` or analytics method: sum by channel/category/period
- Web: “Uso e custos” panel with **Estimativa** label
- Tests

- [ ] **Step 1: Extend `MetaStatus`**

```typescript
export interface MetaStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
  pricing?: { category?: string; pricing_model?: string };
  conversation?: { id?: string; origin?: { type?: string } };
}
```

- [ ] **Step 2: On status processing**, if `pricing?.category`, update message by `waMessageId` with `pricingCategory`.

- [ ] **Step 3: Aggregation API** `GET /analytics/messaging-cost?from=&to=` returns `{ byChannel, byCategory, totalBrlCents, isEstimate: true }`.

- [ ] **Step 4: UI + tests + commit**

```bash
git commit -m "feat(analytics): estimated Meta messaging cost by channel"
```

---

## Task 8 — Campaigns module (templates, audience, dispatch, status)

**Files:**
- `apps/api/src/modules/campaigns/*`
- BullMQ processor for send
- channel-service: on status, if `waMessageId` matches campaign recipient pattern OR always publish `campaign.status` for status updates (api no-ops if unknown id)
- Web `/campaigns`
- Update `CLAUDE.md`
- Tests: audience excludes opted-out; only APPROVED templates; status mapping

**Audience build:**

```typescript
async buildAudience(tenantId: string, query: { type: "all" } | { type: "crm_stage"; stageId: string }) {
  const base = { tenantId, isOptedOut: false, OR: [{ optOutAt: null }, /* prefer isOptedOut alone */] };
  // Prefer: where: { tenantId, isOptedOut: false }
  if (query.type === "all") {
    return this.prisma.contact.findMany({ where: { tenantId, isOptedOut: false } });
  }
  const deals = await this.prisma.deal.findMany({
    where: { tenantId, stageId: query.stageId },
    select: { contactId: true },
  });
  return this.prisma.contact.findMany({
    where: { tenantId, isOptedOut: false, id: { in: deals.map((d) => d.contactId) } },
  });
}
```

**Dispatch:** for each recipient, Meta send template with channel token; store `waMessageId`; mark SENT/FAILED.

**Status:** api consumer updates recipient by `waMessageId`.

- [ ] **Step 1: Templates sync service** (GET Meta message_templates by wabaId).

- [ ] **Step 2: Campaign CRUD + audience + processor.**

- [ ] **Step 3: campaign.status wire-up.**

- [ ] **Step 4: Frontend campaigns pages.**

- [ ] **Step 5: CLAUDE.md note** — campaigns module may send Meta templates; LangGraph remains reactive-only.

- [ ] **Step 6: Tests + commit**

```bash
git commit -m "feat(campaigns): Meta template sync, audience, dispatch and delivery tracking"
```

---

## Task 9 — Final unit test sweep

- [ ] Run:

```bash
pnpm --filter @whatsagent/api test
pnpm --filter @whatsagent/channel-service test
pnpm --filter @whatsagent/web test
cd apps/ai-orchestrator && .venv/Scripts/pytest -q
```

- [ ] Fix failures; commit any test-only fixes.

```bash
git commit -m "test: cover multicanal channels, visibility, CRM flag, campaigns"
```

---

## Spec coverage checklist

| Spec item | Task |
|---|---|
| WhatsappChannel + displayName + manual creds | 1, 4 |
| Members N:N optional | 1, 4 |
| Backfill isAiEnabled from isPublished | 1 |
| resolveChannel + fallback | 3 |
| AI gate persist/publish | 3 |
| channelId on events / outbound token | 2, 3 |
| Membership visibility | 5 |
| Attending + sentByUserId | 1, 5 |
| crmProgressionEnabled | 1, 6 |
| Pricing rates + estimate UI | 1, 7 |
| Campaigns + opt-out + APPROVED + status | 8 |
| CLAUDE.md exception | 8 |
| Unit tests + commits per feature | 3–9 |

## Self-review notes

- No saved audience segments (explicit non-goal).
- OAuth deferred.
- Tenant scalars kept with fallback in Task 3.
- VIEWER: unchanged (no new write paths for VIEWER).
