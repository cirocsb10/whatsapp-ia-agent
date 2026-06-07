# Auto-Lead CRM: Inserção e progressão automática de contatos WhatsApp no funil de vendas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada contato WhatsApp é automaticamente inserido e avança no funil de vendas conforme a conversa evolui — sem intervenção manual.

**Mapeamento completo de stages:**

| Trigger | Stage CRM | Position/Flag |
|---------|-----------|---------------|
| 1ª mensagem recebida | Novo Lead | position 0 |
| Bot responde (AI "discovery") | Contato Feito | position 1 |
| AI "catalog" ou "negotiation" (interesse em produto) | Qualificado | position 2 |
| Pedido criado / AI "payment" | Proposta Enviada | position 3 |
| HUMAN_HANDOFF (agente humano assume) | Negociação | position 4 |
| Pagamento confirmado | Ganho | `isWon = true` |
| Contato faz opt-out | Perdido | `isLost = true` |

> A progressão nunca volta atrás: `advanceToPosition` só avança se a stage alvo tiver `position` maior que a atual.

> **Critério de "Qualificado" neste plano (fixo):** AI stage `"catalog"` (mais de 3 trocas de mensagem) ou `"negotiation"` (item no carrinho). **Scoring configurável por IA** (critérios ponderados por agente: intenção de compra, urgência, orçamento, autoridade, engajamento) será implementado no **plano 22 — AI Lead Scoring**.

**Architecture:**
- **channel-service** `webhook.service.ts`: detecta contato novo → cria Deal em "Novo Lead"; detecta opt-out → move para "Perdido"
- **ai-orchestrator** `rabbitmq.py`: inclui `currentStage` no payload `response_event`
- **channel-service** `outbound.consumer.ts`: lê `currentStage` da resposta IA e emite evento RabbitMQ `crm.advance`
- **api** `CrmProgressionService`: centraliza avanço de stage — chamado via RabbitMQ event e diretamente por outros serviços do api
- **api** `inbox-events.consumer.ts`: consome `crm.advance` e chama `CrmProgressionService`
- **api** `orders.service.ts`: ao criar pedido → avança para "Proposta Enviada" (pos 3)
- **api** `conversations.service.ts`: ao disparar HUMAN_HANDOFF → avança para "Negociação" (pos 4)
- **api** `payments.service.ts`: ao confirmar pagamento → avança para "Ganho" (`isWon`)

**Tech Stack:** NestJS, Prisma, RabbitMQ (amqplib + aio_pika), Python (ai-orchestrator), TypeScript, Jest

---

## File Map

| Ação | Arquivo |
|------|---------|
| **Modify** | `apps/channel-service/src/webhook/webhook.service.ts` |
| **Modify** | `apps/channel-service/src/webhook/webhook.service.spec.ts` |
| **Modify** | `apps/channel-service/src/app.module.ts` |
| **Modify** | `apps/channel-service/src/queue/outbound.consumer.ts` |
| **Modify** | `apps/channel-service/src/queue/inbound.producer.ts` |
| **Create** | `apps/channel-service/src/crm/crm-auto-lead.service.ts` |
| **Create** | `apps/channel-service/src/crm/crm-auto-lead.service.spec.ts` |
| **Modify** | `apps/ai-orchestrator/src/consumers/rabbitmq.py` |
| **Create** | `apps/api/src/modules/crm/crm-progression.service.ts` |
| **Create** | `apps/api/src/modules/crm/crm-progression.service.spec.ts` |
| **Modify** | `apps/api/src/modules/crm/crm.module.ts` |
| **Modify** | `apps/api/src/queue/inbox-events.consumer.ts` |
| **Modify** | `apps/api/src/modules/orders/orders.service.ts` |
| **Modify** | `apps/api/src/modules/conversations/conversations.service.ts` |
| **Modify** | `apps/api/src/modules/payments/payments.service.ts` |

---

## Task 1: Refatorar contact upsert para detectar contato novo

**Context:** `webhook.service.ts:85-90` usa `tx.contact.upsert()`. O Prisma não retorna se o registro foi criado ou atualizado. Precisamos de `findUnique + create/update` para saber se é o primeiro contato e para detectar opt-out no mesmo fluxo.

**Files:**
- Modify: `apps/channel-service/src/webhook/webhook.service.ts`

- [ ] **Step 1: Substituir o bloco upsert (linhas 85-90) por findUnique + create/update**

```typescript
let isNewContact = false;
let contact = await tx.contact.findUnique({
  where: { tenantId_phone: { tenantId, phone: msg.from } },
});
if (!contact) {
  isNewContact = true;
  contact = await tx.contact.create({
    data: { tenantId, phone: msg.from, firstSeenAt: new Date(), lastSeenAt: new Date() },
  });
} else {
  await tx.contact.update({
    where: { id: contact.id },
    data: { lastSeenAt: new Date() },
  });
}
```

- [ ] **Step 2: Propagar `isNewContact` e `justOptedOut` nos três pontos de retorno da transaction**

Early-return de opt-out já existente (linha ~95):
```typescript
return { contact, conversation: null, isNewContact: false, justOptedOut: false };
```

Bloco de detecção de opt-out — após `tx.contact.update({ isOptedOut: true })` (linha ~103):
```typescript
return { contact, conversation: null, isNewContact, justOptedOut: true };
```

Retorno normal (linha ~147):
```typescript
return { contact, conversation, isNewContact, justOptedOut: false };
```

- [ ] **Step 3: Desestruturar no resultado da transaction**

```typescript
const { contact, conversation, isNewContact, justOptedOut } = await this.prisma.$transaction(async (tx) => {
```

- [ ] **Step 4: Build**

```bash
pnpm --filter @whatsagent/channel-service build
```

Expected: zero erros de tipo.

---

## Task 2: Criar CrmAutoLeadService no channel-service

**Context:** Encapsula toda a lógica CRM do channel-service: criar o deal inicial em "Novo Lead" e mover para "Perdido" no opt-out. Usa Prisma diretamente (channel-service já tem acesso).

**Files:**
- Create: `apps/channel-service/src/crm/crm-auto-lead.service.ts`
- Create: `apps/channel-service/src/crm/crm-auto-lead.service.spec.ts`

- [ ] **Step 1: Escrever os testes (TDD — escrever antes da implementação)**

Criar `apps/channel-service/src/crm/crm-auto-lead.service.spec.ts`:

```typescript
import { Test } from "@nestjs/testing";
import { CrmAutoLeadService } from "./crm-auto-lead.service";
import { PrismaService } from "../prisma/prisma.service";

const mockFirstStage = { id: "stage-0", name: "Novo Lead", position: 0 };
const mockLostStage  = { id: "stage-lost", name: "Perdido", isLost: true };
const mockDeal       = { id: "deal-1", title: "5511999", stageId: "stage-0" };

const mockPrisma = {
  funnelStage: { findFirst: jest.fn() },
  deal: { count: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
};

describe("CrmAutoLeadService", () => {
  let service: CrmAutoLeadService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CrmAutoLeadService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(CrmAutoLeadService);
  });

  describe("maybeCreateLead", () => {
    it("cria deal em Novo Lead quando contato é novo e stage existe", async () => {
      mockPrisma.deal.count.mockResolvedValue(0);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(mockFirstStage);
      mockPrisma.deal.create.mockResolvedValue(mockDeal);

      await service.maybeCreateLead("tenant-1", "contact-1", "5511999");

      expect(mockPrisma.deal.create).toHaveBeenCalledWith({
        data: { tenantId: "tenant-1", stageId: "stage-0", contactId: "contact-1", title: "5511999", valueCents: 0 },
      });
    });

    it("usa nome do contato como título quando disponível", async () => {
      mockPrisma.deal.count.mockResolvedValue(0);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(mockFirstStage);
      mockPrisma.deal.create.mockResolvedValue(mockDeal);

      await service.maybeCreateLead("tenant-1", "contact-1", "5511999", "João Silva");

      expect(mockPrisma.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: "João Silva" }) }),
      );
    });

    it("não cria deal quando contato já tem deals", async () => {
      mockPrisma.deal.count.mockResolvedValue(2);
      await service.maybeCreateLead("tenant-1", "contact-1", "5511999");
      expect(mockPrisma.deal.create).not.toHaveBeenCalled();
    });

    it("não cria deal quando não existem stages", async () => {
      mockPrisma.deal.count.mockResolvedValue(0);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(null);
      await service.maybeCreateLead("tenant-1", "contact-1", "5511999");
      expect(mockPrisma.deal.create).not.toHaveBeenCalled();
    });
  });

  describe("advanceToLost", () => {
    it("move deal para stage isLost quando opt-out", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(mockLostStage);
      mockPrisma.deal.update.mockResolvedValue({});

      await service.advanceToLost("tenant-1", "contact-1");

      expect(mockPrisma.deal.update).toHaveBeenCalledWith({
        where: { id: "deal-1" },
        data: { stageId: "stage-lost", closedAt: expect.any(Date) },
      });
    });

    it("não faz nada quando contato não tem deal", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(null);
      await service.advanceToLost("tenant-1", "contact-1");
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });

    it("não faz nada quando não existe stage isLost configurado", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(null);
      await service.advanceToLost("tenant-1", "contact-1");
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
pnpm --filter @whatsagent/channel-service test -- crm-auto-lead
```

Expected: FAIL — "Cannot find module './crm-auto-lead.service'"

- [ ] **Step 3: Implementar o serviço**

Criar `apps/channel-service/src/crm/crm-auto-lead.service.ts`:

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CrmAutoLeadService {
  private readonly logger = new Logger(CrmAutoLeadService.name);

  constructor(private readonly prisma: PrismaService) {}

  async maybeCreateLead(tenantId: string, contactId: string, phone: string, name?: string | null): Promise<void> {
    const existingDeals = await this.prisma.deal.count({ where: { tenantId, contactId } });
    if (existingDeals > 0) return;

    const firstStage = await this.prisma.funnelStage.findFirst({
      where: { tenantId },
      orderBy: { position: "asc" },
    });
    if (!firstStage) {
      this.logger.debug(`No funnel stages for tenant ${tenantId} — skipping auto-lead`);
      return;
    }

    await this.prisma.deal.create({
      data: { tenantId, stageId: firstStage.id, contactId, title: name ?? phone, valueCents: 0 },
    });
    this.logger.log(`Auto-lead created for contact ${phone} → stage "${firstStage.name}"`);
  }

  async advanceToLost(tenantId: string, contactId: string): Promise<void> {
    const deal = await this.prisma.deal.findFirst({ where: { tenantId, contactId } });
    if (!deal) return;

    const lostStage = await this.prisma.funnelStage.findFirst({ where: { tenantId, isLost: true } });
    if (!lostStage) {
      this.logger.debug(`No isLost stage for tenant ${tenantId} — skipping opt-out advance`);
      return;
    }

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { stageId: lostStage.id, closedAt: new Date() },
    });
    this.logger.log(`Deal ${deal.id} marked as Lost (opt-out)`);
  }
}
```

- [ ] **Step 4: Rodar testes**

```bash
pnpm --filter @whatsagent/channel-service test -- crm-auto-lead
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/channel-service/src/crm/
git commit -m "feat(channel): add CrmAutoLeadService with maybeCreateLead and advanceToLost"
```

---

## Task 3: Injetar CrmAutoLeadService no WebhookService

**Files:**
- Modify: `apps/channel-service/src/webhook/webhook.service.ts`
- Modify: `apps/channel-service/src/app.module.ts`

- [ ] **Step 1: Adicionar import e injeção**

```typescript
import { CrmAutoLeadService } from "../crm/crm-auto-lead.service";

// constructor:
private readonly crmAutoLead: CrmAutoLeadService,
```

- [ ] **Step 2: Chamar os métodos após a transaction**

Após `if (!conversation) return;` (linha ~151), adicionar:

```typescript
// Novo contato → criar lead em "Novo Lead"
if (isNewContact) {
  await this.crmAutoLead.maybeCreateLead(tenantId, contact.id, contact.phone, contact.name ?? undefined);
}

// Opt-out → mover para "Perdido"
if (justOptedOut) {
  await this.crmAutoLead.advanceToLost(tenantId, contact.id);
}
```

- [ ] **Step 3: Registrar no AppModule**

```typescript
import { CrmAutoLeadService } from "./crm/crm-auto-lead.service";

providers: [
  WebhookService, SessionService, AudioService, WhisperClient,
  MetaApiClient, MessagingService, InboundProducer, OutboundConsumer,
  HmacGuard, ConfigService, CrmAutoLeadService,
],
```

- [ ] **Step 4: Build**

```bash
pnpm --filter @whatsagent/channel-service build
```

---

## Task 4: Adicionar currentStage e contactId ao payload da resposta do AI orchestrator

**Context:** `rabbitmq.py:143-151` — o `response_event` não inclui `currentStage` nem `contactId`. São necessários para que o channel-service saiba qual stage CRM avançar.

**Files:**
- Modify: `apps/ai-orchestrator/src/consumers/rabbitmq.py`

- [ ] **Step 1: Adicionar `currentStage` e `contactId` ao response_event (linha ~143)**

```python
response_event = {
    "tenantId": tenant_id,
    "conversationId": session.conversation_id,
    "waPhoneId": wa_phone_id,
    "toPhone": contact_phone,
    "messages": final_state["final_messages"],
    "triggerHandoff": final_state.get("should_handoff", False),
    "handoffReason": final_state.get("handoff_reason"),
    "currentStage": final_state.get("current_stage"),  # ← novo
    "contactId": event.contact_id,                     # ← novo (já existe no InboundMessageEvent)
}
```

- [ ] **Step 2: Rodar testes do AI orchestrator**

```bash
cd apps/ai-orchestrator && pytest -v
```

Expected: todos PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/ai-orchestrator/src/consumers/rabbitmq.py
git commit -m "feat(ai): include currentStage and contactId in AI response event for CRM progression"
```

---

## Task 5: Emitir evento crm.advance no OutboundConsumer

**Context:** O `outbound.consumer.ts` já consome os eventos `ai.response`. Agora que o payload inclui `currentStage` e `contactId`, mapeamos o stage IA → position CRM e emitimos `crm.advance`.

**Mapeamento AI stage → CRM position:**
- `"greeting"` / `"discovery"` → position 1 (Contato Feito)
- `"catalog"` / `"negotiation"` → position 2 (Qualificado)
- `"payment"` → position 3 (Proposta Enviada)

**Files:**
- Modify: `apps/channel-service/src/queue/inbound.producer.ts`
- Modify: `apps/channel-service/src/queue/outbound.consumer.ts`

- [ ] **Step 1: Adicionar publishCrmAdvance ao InboundProducer**

Em `inbound.producer.ts`, verificar o padrão de `channel.publish` nos métodos existentes e adicionar:

```typescript
async publishCrmAdvance(payload: {
  tenantId: string;
  contactId: string;
  targetPosition: number;
}): Promise<void> {
  await this.channel.publish(
    "crm",
    "crm.advance",
    Buffer.from(JSON.stringify(payload)),
    { persistent: true },
  );
}
```

- [ ] **Step 2: Declarar o exchange "crm" no InboundProducer**

No `onModuleInit` (onde os outros exchanges são declarados), adicionar:

```typescript
await channel.assertExchange("crm", "topic", { durable: true });
```

- [ ] **Step 3: Ampliar o tipo do evento no OutboundConsumer e emitir crm.advance**

Em `outbound.consumer.ts`, adicionar `currentStage` e `contactId` ao tipo do evento parseado (linhas 85-91):

```typescript
const event = JSON.parse(msg.content.toString()) as {
  tenantId?: string;
  conversationId?: string;
  waPhoneId: string;
  toPhone: string;
  messages: Array<{ type: string; text?: string; imageUrl?: string }>;
  currentStage?: string;   // ← novo
  contactId?: string;      // ← novo
};
```

Após `await this.handleOutboundMessage(event)`, adicionar:

```typescript
if (event.tenantId && event.contactId && event.currentStage) {
  const targetPosition = this.resolveCrmPosition(event.currentStage);
  if (targetPosition !== null) {
    await this.inbound.publishCrmAdvance({
      tenantId: event.tenantId,
      contactId: event.contactId,
      targetPosition,
    }).catch((err) => this.logger.warn("crm.advance publish failed", err));
  }
}
```

Adicionar o método privado de mapeamento:

```typescript
private resolveCrmPosition(aiStage: string): number | null {
  switch (aiStage) {
    case "greeting":
    case "discovery":
      return 1; // Contato Feito
    case "catalog":
    case "negotiation":
      return 2; // Qualificado
    case "payment":
      return 3; // Proposta Enviada
    default:
      return null;
  }
}
```

- [ ] **Step 4: Build do channel-service**

```bash
pnpm --filter @whatsagent/channel-service build
```

- [ ] **Step 5: Commit**

```bash
git add apps/channel-service/src/queue/
git commit -m "feat(channel): emit crm.advance event based on AI conversation stage"
```

---

## Task 6: Criar CrmProgressionService no api

**Context:** Serviço central no api que avança o deal de um contato para uma stage alvo, nunca voltando atrás. Chamado via evento RabbitMQ e diretamente por outros módulos.

**Files:**
- Create: `apps/api/src/modules/crm/crm-progression.service.ts`
- Create: `apps/api/src/modules/crm/crm-progression.service.spec.ts`
- Modify: `apps/api/src/modules/crm/crm.module.ts`

- [ ] **Step 1: Escrever os testes**

Criar `apps/api/src/modules/crm/crm-progression.service.spec.ts`:

```typescript
import { Test } from "@nestjs/testing";
import { CrmProgressionService } from "./crm-progression.service";
import { PrismaService } from "../../prisma/prisma.service";

const mockDeal     = { id: "deal-1", stageId: "stage-0", stage: { position: 0, isWon: false } };
const mockStage1   = { id: "stage-1", position: 1, isWon: false };
const mockWonStage = { id: "stage-won", position: 5, isWon: true };

const mockPrisma = {
  deal: { findFirst: jest.fn(), update: jest.fn() },
  funnelStage: { findFirst: jest.fn() },
};

describe("CrmProgressionService", () => {
  let service: CrmProgressionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CrmProgressionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(CrmProgressionService);
  });

  describe("advanceToPosition", () => {
    it("avança deal quando position atual é menor que alvo", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(mockStage1);
      mockPrisma.deal.update.mockResolvedValue({});

      await service.advanceToPosition("tenant-1", "contact-1", 1);

      expect(mockPrisma.deal.update).toHaveBeenCalledWith({
        where: { id: "deal-1" },
        data: { stageId: "stage-1" },
      });
    });

    it("não avança quando deal já está em position igual ou maior", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({ ...mockDeal, stage: { position: 2, isWon: false } });
      await service.advanceToPosition("tenant-1", "contact-1", 1);
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });

    it("não faz nada quando contato não tem deal", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(null);
      await service.advanceToPosition("tenant-1", "contact-1", 1);
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });

    it("não faz nada quando stage alvo não existe", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(null);
      await service.advanceToPosition("tenant-1", "contact-1", 1);
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });
  });

  describe("advanceToWon", () => {
    it("move deal para stage isWon e seta closedAt", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(mockWonStage);
      mockPrisma.deal.update.mockResolvedValue({});

      await service.advanceToWon("tenant-1", "contact-1");

      expect(mockPrisma.deal.update).toHaveBeenCalledWith({
        where: { id: "deal-1" },
        data: { stageId: "stage-won", closedAt: expect.any(Date) },
      });
    });

    it("não avança quando deal já está em isWon", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({ ...mockDeal, stage: { position: 5, isWon: true } });
      await service.advanceToWon("tenant-1", "contact-1");
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });

    it("não faz nada quando não existe stage isWon configurado", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(null);
      await service.advanceToWon("tenant-1", "contact-1");
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
pnpm --filter @whatsagent/api test -- crm-progression
```

Expected: FAIL — "Cannot find module './crm-progression.service'"

- [ ] **Step 3: Implementar o serviço**

Criar `apps/api/src/modules/crm/crm-progression.service.ts`:

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CrmProgressionService {
  private readonly logger = new Logger(CrmProgressionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async advanceToPosition(tenantId: string, contactId: string, targetPosition: number): Promise<void> {
    const deal = await this.prisma.deal.findFirst({
      where: { tenantId, contactId },
      include: { stage: true },
    });
    if (!deal) return;
    if (deal.stage.position >= targetPosition) return;

    const targetStage = await this.prisma.funnelStage.findFirst({
      where: { tenantId, position: targetPosition },
    });
    if (!targetStage) {
      this.logger.debug(`Stage at position ${targetPosition} not found for tenant ${tenantId}`);
      return;
    }

    await this.prisma.deal.update({ where: { id: deal.id }, data: { stageId: targetStage.id } });
    this.logger.log(`Deal ${deal.id} advanced to position ${targetPosition} ("${targetStage.name}")`);
  }

  async advanceToWon(tenantId: string, contactId: string): Promise<void> {
    const deal = await this.prisma.deal.findFirst({
      where: { tenantId, contactId },
      include: { stage: true },
    });
    if (!deal || deal.stage.isWon) return;

    const wonStage = await this.prisma.funnelStage.findFirst({ where: { tenantId, isWon: true } });
    if (!wonStage) {
      this.logger.debug(`No isWon stage for tenant ${tenantId}`);
      return;
    }

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { stageId: wonStage.id, closedAt: new Date() },
    });
    this.logger.log(`Deal ${deal.id} marked as Won`);
  }
}
```

- [ ] **Step 4: Registrar e exportar no CrmModule**

Em `apps/api/src/modules/crm/crm.module.ts`:

```typescript
import { CrmProgressionService } from "./crm-progression.service";

@Module({
  providers: [CrmService, CrmProgressionService],
  exports: [CrmService, CrmProgressionService],
  controllers: [CrmController],
})
export class CrmModule {}
```

- [ ] **Step 5: Rodar testes**

```bash
pnpm --filter @whatsagent/api test -- crm-progression
```

Expected: 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/crm/crm-progression.service.ts apps/api/src/modules/crm/crm-progression.service.spec.ts apps/api/src/modules/crm/crm.module.ts
git commit -m "feat(api): add CrmProgressionService for automatic funnel stage advancement"
```

---

## Task 7: Consumir evento crm.advance no api

**Context:** O `inbox-events.consumer.ts` do api já consome eventos RabbitMQ. Precisamos que ele também escute o exchange "crm" routing key "crm.advance" e chame `CrmProgressionService.advanceToPosition()`.

**Files:**
- Modify: `apps/api/src/queue/inbox-events.consumer.ts`

- [ ] **Step 1: Injetar CrmProgressionService**

```typescript
import { CrmProgressionService } from "../modules/crm/crm-progression.service";

// constructor: adicionar
private readonly crmProgression: CrmProgressionService,
```

- [ ] **Step 2: Declarar exchange "crm" e binding no setup do consumer**

No método de setup (onde os outros bindings existem), adicionar:

```typescript
await channel.assertExchange("crm", "topic", { durable: true });
await channel.bindQueue(queueName, "crm", "crm.advance");
```

- [ ] **Step 3: Handler para crm.advance**

No switch/if de routing keys, adicionar:

```typescript
if (routingKey === "crm.advance") {
  const { tenantId, contactId, targetPosition } = JSON.parse(msg.content.toString());
  await this.crmProgression.advanceToPosition(tenantId, contactId, targetPosition);
  return;
}
```

- [ ] **Step 4: Garantir que CrmModule está importado no módulo do consumer**

Verificar o módulo que declara o `inbox-events.consumer` e adicionar `CrmModule` aos `imports` se não estiver.

- [ ] **Step 5: Build**

```bash
pnpm --filter @whatsagent/api build
```

---

## Task 8: Avançar para "Proposta Enviada" ao criar pedido

**Context:** Quando o bot gera um link de pagamento, o api cria um `Order`. O deal avança para position 3 ("Proposta Enviada").

**Files:**
- Modify: `apps/api/src/modules/orders/orders.service.ts`

- [ ] **Step 1: Injetar CrmProgressionService**

```typescript
import { CrmProgressionService } from "../crm/crm-progression.service";

private readonly crmProgression: CrmProgressionService,
```

- [ ] **Step 2: Avançar após criar o order**

No método de criação de pedido (ex: `createInternal()` ou `create()`), após `prisma.order.create()`:

```typescript
const conversation = await this.prisma.conversation.findUnique({
  where: { id: order.conversationId },
  select: { contactId: true },
});
if (conversation?.contactId) {
  await this.crmProgression.advanceToPosition(order.tenantId, conversation.contactId, 3);
}
```

- [ ] **Step 3: Adicionar CrmModule aos imports do OrdersModule**

```typescript
imports: [CrmModule],
```

- [ ] **Step 4: Build**

```bash
pnpm --filter @whatsagent/api build
```

---

## Task 9: Avançar para "Negociação" ao assumir conversa (HUMAN_HANDOFF)

**Context:** Quando agente humano assume via `PATCH /conversations/:id/assume`, o deal avança para position 4 ("Negociação").

**Files:**
- Modify: `apps/api/src/modules/conversations/conversations.service.ts`

- [ ] **Step 1: Injetar CrmProgressionService**

```typescript
import { CrmProgressionService } from "../crm/crm-progression.service";

private readonly crmProgression: CrmProgressionService,
```

- [ ] **Step 2: Avançar após assumeConversation()**

No método `assumeConversation()`, após a transaction que muda o status para HUMAN_HANDOFF:

```typescript
await this.crmProgression.advanceToPosition(tenantId, conversation.contactId, 4);
```

- [ ] **Step 3: Adicionar CrmModule aos imports do ConversationsModule**

```typescript
imports: [CrmModule],
```

- [ ] **Step 4: Build**

```bash
pnpm --filter @whatsagent/api build
```

---

## Task 10: Avançar para "Ganho" ao confirmar pagamento

**Context:** Quando o webhook do Mercado Pago/Stripe confirma o pagamento, o deal avança para `isWon = true` ("Ganho") com `closedAt`.

**Files:**
- Modify: `apps/api/src/modules/payments/payments.service.ts`

- [ ] **Step 1: Injetar CrmProgressionService**

```typescript
import { CrmProgressionService } from "../crm/crm-progression.service";

private readonly crmProgression: CrmProgressionService,
```

- [ ] **Step 2: Avançar após confirmar pagamento**

No handler do webhook (método que processa `payment.approved`), após atualizar o Order para pago:

```typescript
const conversation = await this.prisma.conversation.findUnique({
  where: { id: order.conversationId },
  select: { contactId: true },
});
if (conversation?.contactId) {
  await this.crmProgression.advanceToWon(order.tenantId, conversation.contactId);
}
```

- [ ] **Step 3: Adicionar CrmModule aos imports do PaymentsModule**

```typescript
imports: [CrmModule],
```

- [ ] **Step 4: Build final completo**

```bash
pnpm build
```

Expected: zero erros em todos os apps.

- [ ] **Step 5: Commit**

```bash
git add -p
git commit -m "feat(crm): wire complete funnel progression — orders, handoff, and payments"
```

---

## Task 11: Atualizar testes do WebhookService

**Files:**
- Modify: `apps/channel-service/src/webhook/webhook.service.spec.ts`

- [ ] **Step 1: Atualizar mocks — substituir upsert por findUnique + create**

```typescript
contact: {
  findUnique: jest.fn().mockResolvedValue(null), // null = contato novo por padrão
  create: jest.fn().mockResolvedValue(mockContact),
  update: jest.fn().mockResolvedValue({ ...mockContact, isOptedOut: true }),
},
```

Adicionar mock do CrmAutoLeadService:
```typescript
const mockCrmAutoLead = {
  maybeCreateLead: jest.fn().mockResolvedValue(undefined),
  advanceToLost: jest.fn().mockResolvedValue(undefined),
};
```

- [ ] **Step 2: Adicionar CrmAutoLeadService ao TestingModule**

```typescript
import { CrmAutoLeadService } from "../crm/crm-auto-lead.service";

// providers:
{ provide: CrmAutoLeadService, useValue: mockCrmAutoLead },
```

- [ ] **Step 3: Adicionar testes de auto-lead e opt-out**

```typescript
it("chama maybeCreateLead quando contato é novo", async () => {
  mockPrisma.contact.findUnique.mockResolvedValue(null);
  mockPrisma.contact.create.mockResolvedValue(mockContact);
  mockPrisma.conversation.findFirst.mockResolvedValue(mockConversation);
  mockPrisma.message.create.mockResolvedValue({});
  mockPrisma.conversation.update.mockResolvedValue(mockConversation);
  mockPrisma.agentConfig.findFirst.mockResolvedValue({ isPublished: true });

  await service.processWebhook(makeTextPayload("olá"));

  expect(mockCrmAutoLead.maybeCreateLead).toHaveBeenCalledWith(
    "tenant-uuid-123", "contact-1", "5511999", undefined,
  );
});

it("não chama maybeCreateLead quando contato já existe", async () => {
  mockPrisma.contact.findUnique.mockResolvedValue(mockContact);
  mockPrisma.conversation.findFirst.mockResolvedValue(mockConversation);
  mockPrisma.message.create.mockResolvedValue({});
  mockPrisma.conversation.update.mockResolvedValue(mockConversation);
  mockPrisma.agentConfig.findFirst.mockResolvedValue({ isPublished: true });

  await service.processWebhook(makeTextPayload("olá"));

  expect(mockCrmAutoLead.maybeCreateLead).not.toHaveBeenCalled();
});

it("chama advanceToLost quando contato faz opt-out", async () => {
  mockPrisma.contact.findUnique.mockResolvedValue(mockContact);
  mockPrisma.contact.update.mockResolvedValue({ ...mockContact, isOptedOut: true });

  await service.processWebhook(makeTextPayload("parar"));

  expect(mockCrmAutoLead.advanceToLost).toHaveBeenCalledWith("tenant-uuid-123", "contact-1");
});
```

- [ ] **Step 4: Rodar toda a suite**

```bash
pnpm --filter @whatsagent/channel-service test
pnpm --filter @whatsagent/api test
```

Expected: 100% PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/channel-service/src/webhook/webhook.service.spec.ts
git commit -m "test(channel): update webhook service specs for CRM auto-lead and opt-out flow"
```

---

## Verification (end-to-end)

1. Subir o stack:
   ```bash
   pnpm docker:up && pnpm dev
   ```

2. **"Novo Lead"** — 1ª mensagem de número novo → deal aparece em "Novo Lead" em `http://localhost:3000/crm`.

3. **"Contato Feito"** — Bot responde → deal avança automaticamente.

4. **"Qualificado"** — Contato pesquisa produto (AI entra em stage "catalog") → deal avança.

5. **"Proposta Enviada"** — Bot gera link de pagamento (order criada) → deal avança.

6. **"Negociação"** — Agente humano assume a conversa via inbox → deal avança.

7. **"Ganho"** — Webhook de pagamento confirmado → deal vai para "Ganho" com `closedAt`.

8. **"Perdido"** — Contato envia "parar" → deal vai para "Perdido".

9. **Sem duplicatas** — 2ª mensagem do mesmo número → nenhum deal novo.

10. **Sem retrocesso** — Deal em "Qualificado" não volta para "Contato Feito".

11. Testes:
    ```bash
    pnpm test
    ```
    Expected: 100% PASS.

---

## Edge Cases Cobertos

| Caso | Comportamento |
|------|---------------|
| Contato novo, stages existem | Deal criado em "Novo Lead" (position 0) |
| Contato existente (2ª+ mensagem) | Nenhum deal criado |
| Contato novo, sem stages ainda | Skip silencioso (log debug) |
| Contato já tem deal(s) | Nenhum deal duplicado |
| AI stage avança → deal já à frente | `advanceToPosition` ignora (não volta) |
| HUMAN_HANDOFF → deal em pos > 4 | Ignorado (não volta) |
| Pagamento confirmado | Deal marcado Ganho + `closedAt` |
| Deal já em isWon | `advanceToWon` ignora |
| Contato faz opt-out | Deal marcado Perdido + `closedAt` |
| Sem stage isLost/isWon configurado | Skip silencioso |
| Nome do contato disponível | Usado como título do deal |
| Nome ausente | Usa o número de telefone como título |

---

## Próximo passo

**Plano 22 — AI Lead Scoring:** Sistema de scoring configurável por agente com critérios ponderados (intenção de compra, urgência, orçamento, autoridade, engajamento). O score final determina automaticamente se o lead avança para "Qualificado" com critérios customizáveis por tenant.
