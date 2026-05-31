# Meta/WhatsApp — Gaps de Código Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os 3 gaps que impedem o fluxo ponta-a-ponta: configurar whatsappPhoneId do tenant, persistir Contact/Conversation no banco ao receber mensagens, e persistir opt-out.

**Architecture:** Dois serviços são modificados. Na API, um novo `SettingsModule` expõe `PATCH /settings/whatsapp` para configurar o número do tenant. No channel-service, o `WebhookService` passa a fazer upsert de Contact, criar/buscar Conversation, salvar Message no banco e persistir opt-out — tudo antes de publicar no RabbitMQ.

**Tech Stack:** NestJS, Prisma, Jest

---

## Arquivo Map

| Ação | Arquivo |
|---|---|
| Criar | `apps/api/src/modules/settings/settings.controller.ts` |
| Criar | `apps/api/src/modules/settings/settings.service.ts` |
| Criar | `apps/api/src/modules/settings/settings.module.ts` |
| Criar | `apps/api/src/modules/settings/dto/update-whatsapp-settings.dto.ts` |
| Criar | `apps/api/src/modules/settings/settings.service.spec.ts` |
| Modificar | `apps/api/src/app.module.ts` |
| Modificar | `apps/channel-service/src/webhook/webhook.service.ts` |
| Modificar | `apps/channel-service/src/webhook/webhook.service.spec.ts` |

---

## Task 1: SettingsService com testes

**Files:**
- Create: `apps/api/src/modules/settings/settings.service.ts`
- Create: `apps/api/src/modules/settings/settings.service.spec.ts`

- [ ] **Step 1: Escrever os testes**

Criar `apps/api/src/modules/settings/settings.service.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { SettingsService } from "./settings.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe("SettingsService", () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
  });

  describe("updateWhatsappSettings", () => {
    it("deve atualizar whatsappPhoneId e metaAccessToken do tenant", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: "t-1", name: "Loja" });
      mockPrisma.tenant.update.mockResolvedValue({ id: "t-1", whatsappPhoneId: "1168626729666802", metaAccessToken: "tok123" });

      const result = await service.updateWhatsappSettings("t-1", {
        whatsappPhoneId: "1168626729666802",
        metaAccessToken: "tok123",
      });

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: "t-1" },
        data: { whatsappPhoneId: "1168626729666802", metaAccessToken: "tok123" },
        select: { id: true, whatsappPhoneId: true, whatsappStatus: true },
      });
      expect(result.whatsappPhoneId).toBe("1168626729666802");
    });

    it("deve lançar NotFoundException se tenant não existe", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.updateWhatsappSettings("nao-existe", { whatsappPhoneId: "123" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("deve atualizar apenas whatsappPhoneId quando metaAccessToken nao fornecido", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: "t-1", name: "Loja" });
      mockPrisma.tenant.update.mockResolvedValue({ id: "t-1", whatsappPhoneId: "999" });

      await service.updateWhatsappSettings("t-1", { whatsappPhoneId: "999" });

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: "t-1" },
        data: { whatsappPhoneId: "999" },
        select: { id: true, whatsappPhoneId: true, whatsappStatus: true },
      });
    });
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
pnpm --filter @whatsagent/api test -- --testPathPattern=settings.service
```

Expected: FAIL — `Cannot find module './settings.service'`

- [ ] **Step 3: Implementar o service**

Criar `apps/api/src/modules/settings/settings.service.ts`:

```ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

interface UpdateWhatsappSettingsDto {
  whatsappPhoneId: string;
  metaAccessToken?: string;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateWhatsappSettings(tenantId: string, dto: UpdateWhatsappSettingsDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");

    const data: Record<string, string> = { whatsappPhoneId: dto.whatsappPhoneId };
    if (dto.metaAccessToken) data["metaAccessToken"] = dto.metaAccessToken;

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: { id: true, whatsappPhoneId: true, whatsappStatus: true },
    });
  }
}
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
pnpm --filter @whatsagent/api test -- --testPathPattern=settings.service
```

Expected: PASS — 3 testes passando

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/settings/
git commit -m "feat(api): adiciona SettingsService para configurar whatsappPhoneId do tenant"
```

---

## Task 2: SettingsController, DTO e Module

**Files:**
- Create: `apps/api/src/modules/settings/dto/update-whatsapp-settings.dto.ts`
- Create: `apps/api/src/modules/settings/settings.controller.ts`
- Create: `apps/api/src/modules/settings/settings.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Criar o DTO**

Criar `apps/api/src/modules/settings/dto/update-whatsapp-settings.dto.ts`:

```ts
import { IsString, IsOptional, MinLength } from "class-validator";

export class UpdateWhatsappSettingsDto {
  @IsString()
  @MinLength(1)
  whatsappPhoneId: string;

  @IsOptional()
  @IsString()
  metaAccessToken?: string;
}
```

- [ ] **Step 2: Criar o controller**

Criar `apps/api/src/modules/settings/settings.controller.ts`:

```ts
import { Controller, Patch, Body, UseGuards } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { UpdateWhatsappSettingsDto } from "./dto/update-whatsapp-settings.dto";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("settings")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Patch("whatsapp")
  @Roles("OWNER", "ADMIN")
  updateWhatsapp(
    @CurrentTenantId() tenantId: string,
    @Body() dto: UpdateWhatsappSettingsDto,
  ) {
    return this.service.updateWhatsappSettings(tenantId, dto);
  }
}
```

- [ ] **Step 3: Criar o module**

Criar `apps/api/src/modules/settings/settings.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
```

- [ ] **Step 4: Registrar no AppModule**

Modificar `apps/api/src/app.module.ts` — adicionar import:

```ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./common/prisma/prisma.module";
import { ProductsModule } from "./modules/products/products.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { GatewaysModule } from "./gateways/gateways.module";
import { BillingModule } from "./modules/billing/billing.module";
import { SuperAdminModule } from "./modules/super-admin/super-admin.module";
import { ClerkWebhookModule } from "./modules/clerk/clerk-webhook.module";
import { SettingsModule } from "./modules/settings/settings.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule, ProductsModule, OrdersModule, PaymentsModule,
    AnalyticsModule, GatewaysModule, BillingModule, SuperAdminModule,
    ClerkWebhookModule, SettingsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 5: Rodar todos os testes da API e build**

```bash
pnpm --filter @whatsagent/api test
pnpm --filter @whatsagent/api build
```

Expected: todos os testes passando, build sem erros

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/settings/ apps/api/src/app.module.ts
git commit -m "feat(api): adiciona SettingsModule com endpoint PATCH /settings/whatsapp"
```

---

## Task 3: Configurar tenant de teste no banco

**Contexto:** Para testar o fluxo completo, o tenant criado pelo Clerk precisa ter `whatsappPhoneId = "1168626729666802"` (o Phone Number ID do número de teste da Meta).

**Files:** nenhum arquivo de código — apenas comandos

- [ ] **Step 1: Descobrir o ID do tenant no banco**

Com o Prisma Studio aberto (`pnpm db:studio`), navegue até a tabela `Tenant` e copie o `id` do tenant que você criou ao fazer login.

Ou via psql/terminal:
```bash
pnpm --filter @whatsagent/database studio
```

Abrir `http://localhost:5555`, clicar em `Tenant`, copiar o `id`.

- [ ] **Step 2: Atualizar o tenant com o Phone Number ID**

Substituir `<TENANT_ID>` pelo id copiado e rodar no terminal:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://whatsagent:whatsagent_secret@localhost:5433/whatsagent' } } });
p.tenant.update({ where: { id: '<TENANT_ID>' }, data: { whatsappPhoneId: '1168626729666802' } }).then(t => { console.log('Updated:', t.whatsappPhoneId); p.\$disconnect(); });
"
```

Expected: `Updated: 1168626729666802`

- [ ] **Step 3: Verificar no Prisma Studio**

Abrir `http://localhost:5555`, verificar que `Tenant.whatsappPhoneId = "1168626729666802"`.

---

## Task 4: Contact/Conversation upsert e opt-out no WebhookService

**Files:**
- Modify: `apps/channel-service/src/webhook/webhook.service.ts`
- Modify: `apps/channel-service/src/webhook/webhook.service.spec.ts`

### Contexto do schema Prisma

```prisma
model Contact {
  @@unique([tenantId, phone])
  isOptedOut Boolean @default(false)
  optOutAt   DateTime?
  lastSeenAt DateTime @default(now())
}

model Conversation {
  status ConversationStatus @default(ACTIVE)
  lastMessageAt DateTime?
}

model Message {
  direction MessageDirection  // INBOUND | OUTBOUND
  waMessageId String? @unique
}
```

- [ ] **Step 1: Adicionar testes para os novos comportamentos**

Modificar `apps/channel-service/src/webhook/webhook.service.spec.ts` — adicionar ao `mockPrisma` e novos testes:

```ts
import { Test } from "@nestjs/testing";
import { WebhookService } from "./webhook.service";
import { InboundProducer } from "../queue/inbound.producer";
import { SessionService } from "../session/session.service";
import { AudioService } from "../audio/audio.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

const mockProducer = { publishInbound: jest.fn() };
const mockSession = {
  isDuplicate: jest.fn().mockResolvedValue(false),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn(),
};
const mockAudio = { downloadAndTranscribe: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue("test_token") };
const mockContact = { id: "contact-1", isOptedOut: false, phone: "5511999" };
const mockConversation = { id: "conv-1", status: "ACTIVE" };
const mockPrisma = {
  tenant: {
    findFirst: jest.fn().mockResolvedValue({ id: "tenant-uuid-123" }),
  },
  contact: {
    upsert: jest.fn().mockResolvedValue(mockContact),
    update: jest.fn().mockResolvedValue({ ...mockContact, isOptedOut: true }),
  },
  conversation: {
    findFirst: jest.fn().mockResolvedValue(mockConversation),
    create: jest.fn().mockResolvedValue(mockConversation),
    update: jest.fn(),
  },
  message: {
    create: jest.fn(),
  },
};

function makeTextPayload(text: string) {
  return {
    object: "whatsapp_business_account" as const,
    entry: [{
      id: "waba",
      changes: [{
        field: "messages" as const,
        value: {
          messaging_product: "whatsapp" as const,
          metadata: { display_phone_number: "11999", phone_number_id: "pid" },
          messages: [{
            from: "5511999", id: "wamid.1", timestamp: "1700000000", type: "text" as const,
            text: { body: text },
          }],
        },
      }],
    }],
  };
}

describe("WebhookService", () => {
  let service: WebhookService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: InboundProducer, useValue: mockProducer },
        { provide: SessionService, useValue: mockSession },
        { provide: AudioService, useValue: mockAudio },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(WebhookService);
    jest.clearAllMocks();
    mockSession.isDuplicate.mockResolvedValue(false);
    mockSession.get.mockResolvedValue(null);
    mockPrisma.tenant.findFirst.mockResolvedValue({ id: "tenant-uuid-123" });
    mockPrisma.contact.upsert.mockResolvedValue(mockContact);
    mockPrisma.conversation.findFirst.mockResolvedValue(mockConversation);
    mockPrisma.conversation.create.mockResolvedValue(mockConversation);
  });

  it("publishes inbound event for text message", async () => {
    await service.processWebhook(makeTextPayload("Quero comprar"));
    expect(mockProducer.publishInbound).toHaveBeenCalledWith(
      expect.objectContaining({ type: "text", text: "Quero comprar" }),
    );
  });

  it("skips duplicate messages", async () => {
    mockSession.isDuplicate.mockResolvedValue(true);
    await service.processWebhook(makeTextPayload("dup"));
    expect(mockProducer.publishInbound).not.toHaveBeenCalled();
  });

  it("rejects webhook when no tenant found for phone number", async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue(null);
    await service.processWebhook(makeTextPayload("Quero comprar"));
    expect(mockProducer.publishInbound).not.toHaveBeenCalled();
  });

  it("uses cached tenant ID from Redis without hitting DB", async () => {
    mockSession.get.mockResolvedValue("cached-tenant-id");
    await service.processWebhook(makeTextPayload("Olá"));
    expect(mockPrisma.tenant.findFirst).not.toHaveBeenCalled();
    expect(mockProducer.publishInbound).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "cached-tenant-id" }),
    );
  });

  it("faz upsert de Contact antes de publicar", async () => {
    await service.processWebhook(makeTextPayload("Olá"));
    expect(mockPrisma.contact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_phone: { tenantId: "tenant-uuid-123", phone: "5511999" } },
      }),
    );
  });

  it("cria Conversation se nao existe", async () => {
    mockPrisma.conversation.findFirst.mockResolvedValue(null);
    await service.processWebhook(makeTextPayload("Olá"));
    expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-uuid-123",
          contactId: "contact-1",
          status: "ACTIVE",
        }),
      }),
    );
  });

  it("salva Message no banco antes de publicar", async () => {
    await service.processWebhook(makeTextPayload("Olá"));
    expect(mockPrisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: "INBOUND",
          type: "TEXT",
          text: "Olá",
          waMessageId: "wamid.1",
        }),
      }),
    );
  });

  it("opt-out persiste isOptedOut no banco e nao publica", async () => {
    await service.processWebhook(makeTextPayload("parar"));
    expect(mockPrisma.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isOptedOut: true }),
      }),
    );
    expect(mockProducer.publishInbound).not.toHaveBeenCalled();
  });

  it("transcribes audio before publishing", async () => {
    mockAudio.downloadAndTranscribe.mockResolvedValue({ audioUrl: "http://s3/a.ogg", transcript: "camiseta" });
    const payload = {
      object: "whatsapp_business_account" as const,
      entry: [{
        id: "waba",
        changes: [{
          field: "messages" as const,
          value: {
            messaging_product: "whatsapp" as const,
            metadata: { display_phone_number: "11999", phone_number_id: "pid" },
            messages: [{
              from: "5511999", id: "wamid.2", timestamp: "1700000000", type: "audio" as const,
              audio: { id: "media_id", mime_type: "audio/ogg" },
            }],
          },
        }],
      }],
    };
    await service.processWebhook(payload);
    expect(mockAudio.downloadAndTranscribe).toHaveBeenCalledWith("media_id", "pid");
    expect(mockProducer.publishInbound).toHaveBeenCalledWith(
      expect.objectContaining({ audioTranscript: "camiseta" }),
    );
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar que os novos falham**

```bash
pnpm --filter @whatsagent/channel-service test -- --testPathPattern=webhook.service
```

Expected: os testes existentes passam, os 4 novos falham.

- [ ] **Step 3: Implementar as mudanças no WebhookService**

Substituir o conteúdo de `apps/channel-service/src/webhook/webhook.service.ts`:

```ts
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InboundProducer } from "../queue/inbound.producer";
import { SessionService } from "../session/session.service";
import { AudioService } from "../audio/audio.service";
import { PrismaService } from "../prisma/prisma.service";
import { MetaWebhookBody, MetaMessage } from "./dto/meta-webhook.dto";

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly optOutKeywords = ["parar", "stop", "cancelar", "sair", "não quero"];

  constructor(
    private readonly config: ConfigService,
    private readonly inbound: InboundProducer,
    private readonly session: SessionService,
    private readonly audio: AudioService,
    private readonly prisma: PrismaService,
  ) {}

  async processWebhook(body: MetaWebhookBody): Promise<void> {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages") continue;
        const { value } = change;
        if (value.messages) {
          for (const msg of value.messages) {
            await this.processMessage(msg, value.metadata.phone_number_id);
          }
        }
      }
    }
  }

  private async processMessage(msg: MetaMessage, phoneNumberId: string): Promise<void> {
    if (await this.session.isDuplicate(msg.id)) {
      this.logger.warn(`Duplicate: ${msg.id}`);
      return;
    }

    const tenantId = await this.resolveTenantId(phoneNumberId);
    if (!tenantId) {
      this.logger.warn(`Rejecting webhook — no tenant for phone number ID: ${phoneNumberId}`);
      return;
    }

    const contact = await this.prisma.contact.upsert({
      where: { tenantId_phone: { tenantId, phone: msg.from } },
      update: { lastSeenAt: new Date() },
      create: { tenantId, phone: msg.from, firstSeenAt: new Date(), lastSeenAt: new Date() },
    });

    if (msg.text?.body && this.optOutKeywords.some((k) => msg.text?.body.toLowerCase().includes(k))) {
      this.logger.log(`Opt-out detected from ${msg.from}`);
      await this.prisma.contact.update({
        where: { tenantId_phone: { tenantId, phone: msg.from } },
        data: { isOptedOut: true, optOutAt: new Date() },
      });
      return;
    }

    let conversation = await this.prisma.conversation.findFirst({
      where: { contactId: contact.id, status: { in: ["ACTIVE", "HUMAN_HANDOFF"] } },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { tenantId, contactId: contact.id, status: "ACTIVE", startedAt: new Date() },
      });
    }

    const msgType = msg.type.toUpperCase() as "TEXT" | "AUDIO" | "IMAGE" | "DOCUMENT";

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        tenantId,
        waMessageId: msg.id,
        direction: "INBOUND",
        type: msgType,
        text: msg.text?.body ?? null,
        sentAt: new Date(parseInt(msg.timestamp, 10) * 1000),
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    const event: Record<string, unknown> = {
      tenantId,
      whatsappPhoneId: phoneNumberId,
      waMessageId: msg.id,
      from: msg.from,
      timestamp: parseInt(msg.timestamp, 10),
      type: msg.type,
      conversationId: conversation.id,
      contactId: contact.id,
    };

    if (msg.type === "text") {
      event["text"] = msg.text?.body;
    } else if (msg.type === "audio" && msg.audio?.id) {
      try {
        const { audioUrl, transcript } = await this.audio.downloadAndTranscribe(
          msg.audio.id,
          phoneNumberId,
        );
        event["audioId"] = msg.audio.id;
        event["audioUrl"] = audioUrl;
        event["audioTranscript"] = transcript;
      } catch (err) {
        this.logger.error(`Audio failed for ${msg.id}:`, err);
        event["audioId"] = msg.audio.id;
      }
    } else if (msg.type === "image") {
      event["imageId"] = msg.image?.id;
    } else if (msg.type === "document") {
      event["documentId"] = msg.document?.id;
      event["documentName"] = msg.document?.filename;
    }

    await this.inbound.publishInbound(event);
    this.logger.log(`Published: ${msg.type} from ${msg.from} (conv: ${conversation.id})`);
  }

  private async resolveTenantId(phoneNumberId: string): Promise<string | null> {
    const key = `tenant:phone:${phoneNumberId}`;
    const cached = await this.session.get(key);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findFirst({
      where: { whatsappPhoneId: phoneNumberId },
      select: { id: true },
    });

    if (!tenant) {
      this.logger.warn(`No tenant found for phone number ID: ${phoneNumberId}`);
      return null;
    }

    await this.session.set(key, tenant.id, 3600);
    return tenant.id;
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = this.config.get<string>("meta.verifyToken");
    return mode === "subscribe" && token === verifyToken ? challenge : null;
  }
}
```

- [ ] **Step 4: Rodar todos os testes**

```bash
pnpm --filter @whatsagent/channel-service test -- --testPathPattern=webhook.service
```

Expected: PASS — todos os testes passando (novos incluídos)

- [ ] **Step 5: Commit**

```bash
git add apps/channel-service/src/webhook/webhook.service.ts apps/channel-service/src/webhook/webhook.service.spec.ts
git commit -m "feat(channel): persiste Contact, Conversation e Message ao receber webhook; persiste opt-out"
```

---

## Task 5: Teste ponta-a-ponta

**Pré-requisitos:**
- Docker rodando (`pnpm docker:up`)
- API rodando (`pnpm --filter @whatsagent/api dev`)
- Channel-service rodando (`pnpm --filter @whatsagent/channel-service dev`)
- ngrok rodando (`ngrok http 3001`)
- Tenant configurado com `whatsappPhoneId = "1168626729666802"` (Task 3)

- [ ] **Step 1: Enviar payload de teste pelo painel da Meta**

No painel da Meta → Casos de uso → Etapa 2 → Campos do webhook → `messages` → **Teste** → **Enviar para servidor v25.0**

- [ ] **Step 2: Verificar logs do channel-service**

Expected nos logs:
```
[WebhookService] Published: text from 16315551181 (conv: <uuid>)
```

- [ ] **Step 3: Verificar dados no banco**

```bash
pnpm db:studio
```

Abrir `http://localhost:5555` e verificar:
- Tabela `Contact`: deve ter 1 registro com `phone = "16315551181"`
- Tabela `Conversation`: deve ter 1 registro com `status = "ACTIVE"`
- Tabela `Message`: deve ter 1 registro com `direction = "INBOUND"`, `text = "this is a text message"`

- [ ] **Step 4: Testar opt-out**

No painel da Meta → Etapa 2 → `messages` → **Teste** → mudar o `body` do payload para `"parar"` → **Enviar para servidor**

Expected nos logs:
```
[WebhookService] Opt-out detected from 16315551181
```

No Prisma Studio: `Contact.isOptedOut = true`, `Contact.optOutAt` preenchido.
