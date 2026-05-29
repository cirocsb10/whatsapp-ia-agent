# WhatsAgent — Plan 1: Channel Service (WhatsApp Integration)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o Channel Service NestJS que integra com Meta Cloud API (webhooks + envio de mensagens), classifica mensagens recebidas, baixa e transcreve áudios via Whisper, e publica eventos no RabbitMQ para processamento pelo AI Orchestrator.

**Architecture:** NestJS 10 como serviço standalone na porta 3001. Recebe webhooks HTTPS da Meta Cloud API com validação HMAC-SHA256. Classifica mensagens por tipo (text/audio/image/document). Baixa mídias via API Meta, salva no S3/MinIO. Para áudios: envia para OpenAI Whisper e anexa transcrição. Publica eventos `msg.inbound` no RabbitMQ. Consome `msg.outbound` e envia via Meta API. Usa Redis para deduplicação de mensagens.

**Tech Stack:** NestJS 10 · TypeScript 5 · BullMQ · ioredis · amqplib · axios · @nestjs/bull · multer · node-fetch · OpenAI SDK · Meta Cloud API · MinIO SDK

**Pré-requisito:** Plan 0 concluído (Docker Compose rodando, tipos compartilhados disponíveis)

---

## Estrutura de Arquivos

```
apps/channel-service/src/
├── main.ts                           # Bootstrap NestJS
├── app.module.ts                     # Módulo raiz
├── health/
│   └── health.controller.ts          # GET /health
├── webhook/
│   ├── webhook.module.ts
│   ├── webhook.controller.ts         # POST /webhooks/meta
│   ├── webhook.service.ts
│   └── dto/
│       └── meta-webhook.dto.ts       # DTOs dos payloads Meta
├── messaging/
│   ├── messaging.module.ts
│   ├── messaging.service.ts          # Envio de mensagens via Meta API
│   └── meta-api.client.ts            # HTTP client para Meta Cloud API
├── audio/
│   ├── audio.module.ts
│   ├── audio.service.ts              # Download + upload S3 + Whisper
│   └── whisper.client.ts             # OpenAI Whisper wrapper
├── session/
│   ├── session.module.ts
│   └── session.service.ts            # Redis: TTL de sessão, dedup
├── queue/
│   ├── queue.module.ts
│   ├── inbound.producer.ts           # Publica msg.inbound no RabbitMQ
│   └── outbound.consumer.ts          # Consome msg.outbound do RabbitMQ
├── config/
│   └── configuration.ts              # Config tipada via @nestjs/config
└── common/
    ├── guards/
    │   └── hmac.guard.ts             # Valida assinatura Meta webhook
    └── interceptors/
        └── logging.interceptor.ts
```

---

### Task 1: Bootstrap NestJS Channel Service

**Files:**
- Modify: `apps/channel-service/src/main.ts`
- Modify: `apps/channel-service/src/app.module.ts`
- Create: `apps/channel-service/src/config/configuration.ts`

- [ ] **Step 1: Escrever teste de bootstrap**

```typescript
// apps/channel-service/test/app.e2e-spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Channel Service Bootstrap", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health → 200 com status ok", async () => {
    const res = await request(app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
```

- [ ] **Step 2: Rodar teste para confirmar falha**

```bash
cd apps/channel-service
pnpm test:e2e
```

Expected: FAIL — "Cannot GET /health"

- [ ] **Step 3: Criar configuration.ts (config tipado)**

```typescript
// apps/channel-service/src/config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT ?? "3001", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",

  meta: {
    appId: process.env.META_APP_ID ?? "",
    appSecret: process.env.META_APP_SECRET ?? "",
    verifyToken: process.env.META_VERIFY_TOKEN ?? "",
    webhookSecret: process.env.META_WEBHOOK_SECRET ?? "",
    graphApiVersion: "v21.0",
    graphApiBaseUrl: "https://graph.facebook.com",
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    whisperModel: process.env.OPENAI_WHISPER_MODEL ?? "whisper-1",
  },

  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
    sessionTtlSeconds: 86400, // 24h
    deduplicationTtlSeconds: 60,
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? "amqp://localhost:5672",
    exchanges: {
      messages: "messages",
      ai: "ai",
      notifications: "notifications",
    },
  },

  storage: {
    endpoint: process.env.MINIO_ENDPOINT ?? "localhost",
    port: parseInt(process.env.MINIO_PORT ?? "9000", 10),
    accessKey: process.env.MINIO_ACCESS_KEY ?? "",
    secretKey: process.env.MINIO_SECRET_KEY ?? "",
    bucket: process.env.MINIO_BUCKET ?? "whatsagent-media",
    useSSL: process.env.NODE_ENV === "production",
  },
});
```

- [ ] **Step 4: Criar app.module.ts**

```typescript
// apps/channel-service/src/app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import configuration from "./config/configuration";
import { HealthModule } from "./health/health.module";
import { WebhookModule } from "./webhook/webhook.module";
import { MessagingModule } from "./messaging/messaging.module";
import { AudioModule } from "./audio/audio.module";
import { SessionModule } from "./session/session.module";
import { QueueModule } from "./queue/queue.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get("redis.url"),
        },
      }),
    }),
    HealthModule,
    WebhookModule,
    MessagingModule,
    AudioModule,
    SessionModule,
    QueueModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 5: Criar main.ts**

```typescript
// apps/channel-service/src/main.ts
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,  // Necessário para validação HMAC do webhook
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>("port") ?? 3001;

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS: apenas back-office API pode chamar internamente
  app.enableCors({
    origin: process.env.BACKOFFICE_API_URL ?? "http://localhost:3002",
  });

  await app.listen(port);
  Logger.log(`🚀 Channel Service running on http://localhost:${port}`, "Bootstrap");
}

bootstrap();
```

- [ ] **Step 6: Criar health module**

```typescript
// apps/channel-service/src/health/health.module.ts
import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";

@Module({ controllers: [HealthController] })
export class HealthModule {}

// apps/channel-service/src/health/health.controller.ts
import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return { status: "ok", service: "channel-service", timestamp: new Date().toISOString() };
  }
}
```

- [ ] **Step 7: Rodar teste — deve passar**

```bash
cd apps/channel-service
pnpm test:e2e
```

Expected: PASS — "GET /health → 200 com status ok"

- [ ] **Step 8: Commit**

```bash
git add apps/channel-service/
git commit -m "feat(channel): bootstrap nestjs channel service with health endpoint"
```

---

### Task 2: HMAC Guard — Validação de Webhook Meta

**Files:**
- Create: `apps/channel-service/src/common/guards/hmac.guard.ts`
- Test: `apps/channel-service/src/common/guards/hmac.guard.spec.ts`

- [ ] **Step 1: Escrever testes**

```typescript
// apps/channel-service/src/common/guards/hmac.guard.spec.ts
import { createHmac } from "crypto";
import { HmacGuard } from "./hmac.guard";
import { ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

function makeContext(body: string, signature: string): ExecutionContext {
  const req = {
    rawBody: Buffer.from(body),
    headers: { "x-hub-signature-256": signature },
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function sign(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("HmacGuard", () => {
  const secret = "test_webhook_secret";
  const configService = {
    get: (key: string) => (key === "meta.webhookSecret" ? secret : null),
  } as unknown as ConfigService;

  const guard = new HmacGuard(configService);

  it("deve retornar true quando assinatura é válida", () => {
    const body = JSON.stringify({ test: "data" });
    const sig = sign(secret, body);
    expect(guard.canActivate(makeContext(body, sig))).toBe(true);
  });

  it("deve lançar ForbiddenException quando assinatura é inválida", () => {
    const body = JSON.stringify({ test: "data" });
    expect(() =>
      guard.canActivate(makeContext(body, "sha256=invalidsignature")),
    ).toThrow();
  });

  it("deve lançar ForbiddenException quando header está ausente", () => {
    const req = { rawBody: Buffer.from("{}"), headers: {} };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow();
  });
});
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
cd apps/channel-service
pnpm test hmac.guard
```

Expected: FAIL — "Cannot find module './hmac.guard'"

- [ ] **Step 3: Implementar HmacGuard**

```typescript
// apps/channel-service/src/common/guards/hmac.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";
import { Request } from "express";

@Injectable()
export class HmacGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { rawBody: Buffer }>();
    const signature = req.headers["x-hub-signature-256"] as string | undefined;

    if (!signature) {
      throw new ForbiddenException("Missing X-Hub-Signature-256 header");
    }

    const secret = this.config.get<string>("meta.webhookSecret");
    if (!secret) {
      throw new ForbiddenException("Webhook secret not configured");
    }

    const expectedSig =
      "sha256=" +
      createHmac("sha256", secret)
        .update(req.rawBody)
        .digest("hex");

    // timingSafeEqual previne timing attacks
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      throw new ForbiddenException("Invalid webhook signature");
    }

    return true;
  }
}
```

- [ ] **Step 4: Rodar — deve passar**

```bash
pnpm test hmac.guard
```

Expected: PASS — 3 testes passando

- [ ] **Step 5: Commit**

```bash
git add apps/channel-service/src/common/
git commit -m "feat(channel): add HMAC signature guard for Meta webhook validation"
```

---

### Task 3: Webhook Controller e DTOs

**Files:**
- Create: `apps/channel-service/src/webhook/dto/meta-webhook.dto.ts`
- Create: `apps/channel-service/src/webhook/webhook.service.ts`
- Create: `apps/channel-service/src/webhook/webhook.controller.ts`
- Test: `apps/channel-service/src/webhook/webhook.service.spec.ts`

- [ ] **Step 1: Criar DTOs da Meta API**

```typescript
// apps/channel-service/src/webhook/dto/meta-webhook.dto.ts
// Baseado em https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples

export interface MetaWebhookBody {
  object: "whatsapp_business_account";
  entry: MetaEntry[];
}

export interface MetaEntry {
  id: string;
  changes: MetaChange[];
}

export interface MetaChange {
  value: MetaValue;
  field: "messages";
}

export interface MetaValue {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: MetaContact[];
  messages?: MetaMessage[];
  statuses?: MetaStatus[];
}

export interface MetaContact {
  profile: { name: string };
  wa_id: string;
}

export interface MetaMessage {
  from: string;             // Número sem "+" ex: 5511999999999
  id: string;               // wamid.xxx
  timestamp: string;        // Unix string
  type: "text" | "audio" | "image" | "document" | "sticker" | "reaction" | "location";
  text?: { body: string };
  audio?: { id: string; mime_type: string };
  image?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; filename: string; mime_type: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  context?: { from: string; id: string };  // Resposta a outra mensagem
}

export interface MetaStatus {
  id: string;               // Message ID
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}
```

- [ ] **Step 2: Escrever testes do WebhookService**

```typescript
// apps/channel-service/src/webhook/webhook.service.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { WebhookService } from "./webhook.service";
import { InboundProducer } from "../queue/inbound.producer";
import { SessionService } from "../session/session.service";
import { AudioService } from "../audio/audio.service";
import { MetaWebhookBody } from "./dto/meta-webhook.dto";

const mockInboundProducer = { publishInbound: jest.fn() };
const mockSessionService = { isDuplicate: jest.fn().mockResolvedValue(false) };
const mockAudioService = { downloadAndTranscribe: jest.fn() };

describe("WebhookService", () => {
  let service: WebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: InboundProducer, useValue: mockInboundProducer },
        { provide: SessionService, useValue: mockSessionService },
        { provide: AudioService, useValue: mockAudioService },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    jest.clearAllMocks();
  });

  it("deve publicar evento inbound para mensagem de texto", async () => {
    const payload: MetaWebhookBody = {
      object: "whatsapp_business_account",
      entry: [{
        id: "tenant_waba_id",
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "11999999999", phone_number_id: "phone_id_123" },
            contacts: [{ profile: { name: "João Silva" }, wa_id: "5511999999999" }],
            messages: [{
              from: "5511999999999",
              id: "wamid.test123",
              timestamp: "1700000000",
              type: "text",
              text: { body: "Olá, quero comprar uma camiseta" },
            }],
          },
        }],
      }],
    };

    await service.processWebhook(payload);

    expect(mockInboundProducer.publishInbound).toHaveBeenCalledWith(
      expect.objectContaining({
        waMessageId: "wamid.test123",
        type: "text",
        text: "Olá, quero comprar uma camiseta",
        from: "5511999999999",
      }),
    );
  });

  it("deve ignorar mensagem duplicada", async () => {
    mockSessionService.isDuplicate.mockResolvedValue(true);
    
    const payload: MetaWebhookBody = {
      object: "whatsapp_business_account",
      entry: [{
        id: "test",
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "11999999999", phone_number_id: "phone_id" },
            messages: [{
              from: "5511999999999",
              id: "wamid.dup",
              timestamp: "1700000000",
              type: "text",
              text: { body: "dup" },
            }],
          },
        }],
      }],
    };

    await service.processWebhook(payload);
    expect(mockInboundProducer.publishInbound).not.toHaveBeenCalled();
  });

  it("deve transcrever áudio antes de publicar", async () => {
    mockAudioService.downloadAndTranscribe.mockResolvedValue({
      audioUrl: "https://s3.../audio.ogg",
      transcript: "Me mostra as camisetas disponíveis",
    });

    const payload: MetaWebhookBody = {
      object: "whatsapp_business_account",
      entry: [{
        id: "test",
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "11999999999", phone_number_id: "phone_id" },
            messages: [{
              from: "5511999999999",
              id: "wamid.audio1",
              timestamp: "1700000000",
              type: "audio",
              audio: { id: "audio_media_id_xyz", mime_type: "audio/ogg; codecs=opus" },
            }],
          },
        }],
      }],
    };

    await service.processWebhook(payload);

    expect(mockAudioService.downloadAndTranscribe).toHaveBeenCalledWith(
      "audio_media_id_xyz",
      "phone_id",
    );
    expect(mockInboundProducer.publishInbound).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "audio",
        audioTranscript: "Me mostra as camisetas disponíveis",
      }),
    );
  });
});
```

- [ ] **Step 3: Rodar para confirmar falha**

```bash
pnpm test webhook.service
```

Expected: FAIL — módulos não existem

- [ ] **Step 4: Implementar WebhookService**

```typescript
// apps/channel-service/src/webhook/webhook.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InboundProducer } from "../queue/inbound.producer";
import { SessionService } from "../session/session.service";
import { AudioService } from "../audio/audio.service";
import { MetaWebhookBody, MetaMessage } from "./dto/meta-webhook.dto";
import type { InboundMessageEvent } from "@whatsagent/shared-types";

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly inboundProducer: InboundProducer,
    private readonly sessionService: SessionService,
    private readonly audioService: AudioService,
  ) {}

  async processWebhook(body: MetaWebhookBody): Promise<void> {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages") continue;

        const { value } = change;
        const phoneNumberId = value.metadata.phone_number_id;

        // Processar mensagens recebidas
        if (value.messages) {
          for (const msg of value.messages) {
            await this.processMessage(msg, phoneNumberId, entry.id);
          }
        }

        // Processar status de mensagens enviadas (delivered/read/failed)
        if (value.statuses) {
          for (const status of value.statuses) {
            this.logger.debug(`Message ${status.id} status: ${status.status}`);
            // TODO Plan 3: atualizar status da mensagem no DB via back-office API
          }
        }
      }
    }
  }

  private async processMessage(
    msg: MetaMessage,
    phoneNumberId: string,
    wabaId: string,
  ): Promise<void> {
    // Deduplicação: webhook pode reenviar a mesma mensagem
    const isDup = await this.sessionService.isDuplicate(msg.id);
    if (isDup) {
      this.logger.warn(`Duplicate message ignored: ${msg.id}`);
      return;
    }

    // Resolver tenantId a partir do phoneNumberId
    // Em produção: consultar DB via back-office API
    const tenantId = await this.resolveTenantId(phoneNumberId);
    if (!tenantId) {
      this.logger.error(`No tenant found for phoneNumberId: ${phoneNumberId}`);
      return;
    }

    let event: InboundMessageEvent = {
      tenantId,
      whatsappPhoneId: phoneNumberId,
      waMessageId: msg.id,
      from: msg.from,
      timestamp: parseInt(msg.timestamp, 10),
      type: msg.type,
    };

    // Processar por tipo
    switch (msg.type) {
      case "text":
        event = { ...event, text: msg.text?.body };
        break;

      case "audio":
        if (msg.audio?.id) {
          try {
            const { audioUrl, transcript } = await this.audioService.downloadAndTranscribe(
              msg.audio.id,
              phoneNumberId,
            );
            event = { ...event, audioId: msg.audio.id, audioTranscript: transcript, audioUrl };
          } catch (err) {
            this.logger.error(`Audio transcription failed for ${msg.id}:`, err);
            // Continua com o evento sem transcrição — agente lidará com fallback
            event = { ...event, type: "audio", audioId: msg.audio.id };
          }
        }
        break;

      case "image":
        event = { ...event, imageId: msg.image?.id };
        break;

      case "document":
        event = { ...event, documentId: msg.document?.id, documentName: msg.document?.filename };
        break;

      case "location":
        if (msg.location) {
          event = {
            ...event,
            locationLat: msg.location.latitude,
            locationLng: msg.location.longitude,
          };
        }
        break;

      default:
        this.logger.warn(`Unsupported message type: ${msg.type}`);
        return;
    }

    await this.inboundProducer.publishInbound(event);
    this.logger.log(`📨 Inbound published: ${msg.type} from ${msg.from}`);
  }

  // Resolve tenantId pelo phoneNumberId (cache Redis + DB fallback)
  private async resolveTenantId(phoneNumberId: string): Promise<string | null> {
    const cacheKey = `tenant:phone:${phoneNumberId}`;
    const cached = await this.sessionService.get(cacheKey);
    if (cached) return cached;

    // Em produção: HTTP call para back-office API
    // Aqui retornamos o tenant de dev para testes
    const devTenantId = process.env.DEV_TENANT_ID ?? "dev-tenant-uuid";
    await this.sessionService.set(cacheKey, devTenantId, 3600);
    return devTenantId;
  }

  // Verificação do webhook (GET para Meta validar endpoint)
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = this.config.get<string>("meta.verifyToken");
    if (mode === "subscribe" && token === verifyToken) {
      return challenge;
    }
    return null;
  }
}
```

- [ ] **Step 5: Implementar WebhookController**

```typescript
// apps/channel-service/src/webhook/webhook.controller.ts
import {
  Controller, Post, Get, Body, Query, HttpCode,
  UseGuards, HttpException, HttpStatus, Logger,
} from "@nestjs/common";
import { HmacGuard } from "../common/guards/hmac.guard";
import { WebhookService } from "./webhook.service";
import { MetaWebhookBody } from "./dto/meta-webhook.dto";

@Controller("webhooks")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  // GET: Meta verifica o endpoint na configuração inicial
  @Get("meta")
  verifyWebhook(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
  ): string {
    const result = this.webhookService.verifyWebhook(mode, token, challenge);
    if (!result) {
      throw new HttpException("Verification failed", HttpStatus.FORBIDDEN);
    }
    this.logger.log("✅ Meta webhook verified successfully");
    return result;
  }

  // POST: Mensagens recebidas dos clientes via WhatsApp
  @Post("meta")
  @HttpCode(200)           // Meta espera 200 em < 5 segundos
  @UseGuards(HmacGuard)
  async receiveMessage(@Body() body: MetaWebhookBody): Promise<{ received: boolean }> {
    // Responde 200 imediatamente, processa de forma assíncrona
    // NÃO aguardar a promise — evita timeout no Meta (5s limit)
    this.webhookService.processWebhook(body).catch((err) => {
      this.logger.error("Error processing webhook:", err);
    });
    return { received: true };
  }
}
```

- [ ] **Step 6: Rodar testes**

```bash
pnpm test webhook.service
```

Expected: PASS — 3 testes passando

- [ ] **Step 7: Commit**

```bash
git add apps/channel-service/src/webhook/
git commit -m "feat(channel): add webhook controller with HMAC validation and message routing"
```

---

### Task 4: Audio Service — Download + Whisper Transcription

**Files:**
- Create: `apps/channel-service/src/audio/audio.service.ts`
- Create: `apps/channel-service/src/audio/whisper.client.ts`
- Test: `apps/channel-service/src/audio/audio.service.spec.ts`

- [ ] **Step 1: Escrever testes**

```typescript
// apps/channel-service/src/audio/audio.service.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { AudioService } from "./audio.service";
import { WhisperClient } from "./whisper.client";
import { ConfigService } from "@nestjs/config";

const mockWhisperClient = {
  transcribe: jest.fn().mockResolvedValue("Quero comprar uma camiseta preta tamanho M"),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const cfg: Record<string, string> = {
      "meta.graphApiBaseUrl": "https://graph.facebook.com",
      "meta.graphApiVersion": "v21.0",
    };
    return cfg[key];
  }),
};

describe("AudioService", () => {
  let service: AudioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudioService,
        { provide: WhisperClient, useValue: mockWhisperClient },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AudioService>(AudioService);
    jest.clearAllMocks();
  });

  it("deve retornar URL do S3 e transcrição ao processar áudio", async () => {
    // Mock do download e upload
    jest.spyOn(service as any, "downloadFromMeta").mockResolvedValue(
      Buffer.from("fake-audio-data"),
    );
    jest.spyOn(service as any, "uploadToStorage").mockResolvedValue(
      "https://s3.amazonaws.com/whatsagent-media/audio/test123.ogg",
    );

    const result = await service.downloadAndTranscribe("media_id_123", "phone_id_abc");

    expect(result.audioUrl).toBe("https://s3.amazonaws.com/whatsagent-media/audio/test123.ogg");
    expect(result.transcript).toBe("Quero comprar uma camiseta preta tamanho M");
    expect(mockWhisperClient.transcribe).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Implementar WhisperClient**

```typescript
// apps/channel-service/src/audio/whisper.client.ts
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { Readable } from "stream";
import { toFile } from "openai";

@Injectable()
export class WhisperClient {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(WhisperClient.name);

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: config.get<string>("openai.apiKey"),
    });
  }

  async transcribe(audioBuffer: Buffer, mimeType = "audio/ogg"): Promise<string> {
    const model = this.config.get<string>("openai.whisperModel") ?? "whisper-1";

    // Converter Buffer para File compatível com OpenAI SDK
    const audioFile = await toFile(
      Readable.from(audioBuffer),
      "audio.ogg",
      { type: mimeType },
    );

    const response = await this.openai.audio.transcriptions.create({
      file: audioFile,
      model,
      language: "pt",  // Força PT-BR para melhor acurácia
      response_format: "text",
      prompt: "Transcrição de áudio de cliente em conversa com assistente de vendas.",
    });

    this.logger.debug(`Transcribed ${audioBuffer.length} bytes: "${response.substring(0, 50)}..."`);
    return response;
  }
}
```

- [ ] **Step 3: Implementar AudioService**

```typescript
// apps/channel-service/src/audio/audio.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WhisperClient } from "./whisper.client";
import axios from "axios";
import { Client as MinioClient } from "minio";
import { randomUUID } from "crypto";

interface AudioResult {
  audioUrl: string;
  transcript: string;
}

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);
  private readonly minio: MinioClient;

  constructor(
    private readonly config: ConfigService,
    private readonly whisper: WhisperClient,
  ) {
    this.minio = new MinioClient({
      endPoint: config.get("storage.endpoint") as string,
      port: config.get("storage.port") as number,
      useSSL: config.get("storage.useSSL") as boolean,
      accessKey: config.get("storage.accessKey") as string,
      secretKey: config.get("storage.secretKey") as string,
    });
  }

  async downloadAndTranscribe(
    mediaId: string,
    phoneNumberId: string,
  ): Promise<AudioResult> {
    this.logger.log(`Processing audio: mediaId=${mediaId}`);

    // 1. Obter URL do arquivo de mídia via Meta Graph API
    const audioBuffer = await this.downloadFromMeta(mediaId, phoneNumberId);

    // 2. Upload para MinIO/S3
    const audioUrl = await this.uploadToStorage(audioBuffer, mediaId);

    // 3. Transcrever com Whisper
    const transcript = await this.whisper.transcribe(audioBuffer, "audio/ogg");

    return { audioUrl, transcript };
  }

  private async downloadFromMeta(mediaId: string, phoneNumberId: string): Promise<Buffer> {
    const baseUrl = this.config.get<string>("meta.graphApiBaseUrl");
    const apiVersion = this.config.get<string>("meta.graphApiVersion");
    
    // Buscar URL de download da mídia
    const urlResponse = await axios.get(
      `${baseUrl}/${apiVersion}/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
        },
      },
    );

    const mediaUrl: string = urlResponse.data.url;

    // Baixar o arquivo binário
    const audioResponse = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      headers: {
        Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
      },
    });

    return Buffer.from(audioResponse.data as ArrayBuffer);
  }

  private async uploadToStorage(buffer: Buffer, mediaId: string): Promise<string> {
    const bucket = this.config.get<string>("storage.bucket") as string;
    const objectName = `audio/${randomUUID()}-${mediaId}.ogg`;
    
    await this.minio.putObject(bucket, objectName, buffer, buffer.length, {
      "Content-Type": "audio/ogg",
    });

    // Gerar URL pré-assinada (1h de validade para processamento)
    const url = await this.minio.presignedGetObject(bucket, objectName, 3600);
    return url;
  }
}
```

- [ ] **Step 4: Rodar testes**

```bash
pnpm test audio.service
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/channel-service/src/audio/
git commit -m "feat(channel): add audio download and whisper transcription service"
```

---

### Task 5: RabbitMQ — Inbound Producer + Outbound Consumer

**Files:**
- Create: `apps/channel-service/src/queue/inbound.producer.ts`
- Create: `apps/channel-service/src/queue/outbound.consumer.ts`
- Create: `apps/channel-service/src/queue/queue.module.ts`
- Test: `apps/channel-service/src/queue/inbound.producer.spec.ts`

- [ ] **Step 1: Escrever testes**

```typescript
// apps/channel-service/src/queue/inbound.producer.spec.ts
import { Test } from "@nestjs/testing";
import { InboundProducer } from "./inbound.producer";
import { ConfigService } from "@nestjs/config";
import type { InboundMessageEvent } from "@whatsagent/shared-types";

// Mock amqplib connection
const mockChannel = {
  assertExchange: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockReturnValue(true),
};
const mockConnection = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
};
jest.mock("amqplib", () => ({
  connect: jest.fn().mockResolvedValue(mockConnection),
}));

describe("InboundProducer", () => {
  let producer: InboundProducer;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InboundProducer,
        {
          provide: ConfigService,
          useValue: { get: () => "amqp://localhost:5672" },
        },
      ],
    }).compile();

    producer = module.get<InboundProducer>(InboundProducer);
    await producer.onModuleInit();  // Conectar ao RabbitMQ
  });

  it("deve publicar evento no exchange correto", async () => {
    const event: InboundMessageEvent = {
      tenantId: "tenant-uuid-123",
      whatsappPhoneId: "phone_id_abc",
      waMessageId: "wamid.test",
      from: "5511999999999",
      timestamp: 1700000000,
      type: "text",
      text: "Olá",
    };

    await producer.publishInbound(event);

    expect(mockChannel.publish).toHaveBeenCalledWith(
      "messages",
      "msg.inbound",
      expect.any(Buffer),
      expect.objectContaining({ persistent: true }),
    );

    // Verificar conteúdo do evento
    const publishedBuffer = mockChannel.publish.mock.calls[0][2] as Buffer;
    const published = JSON.parse(publishedBuffer.toString()) as InboundMessageEvent;
    expect(published.tenantId).toBe("tenant-uuid-123");
    expect(published.text).toBe("Olá");
  });
});
```

- [ ] **Step 2: Implementar InboundProducer**

```typescript
// apps/channel-service/src/queue/inbound.producer.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqplib from "amqplib";
import type { InboundMessageEvent } from "@whatsagent/shared-types";
import { EXCHANGES, ROUTING_KEYS } from "@whatsagent/shared-types";

@Injectable()
export class InboundProducer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboundProducer.name);
  private connection!: amqplib.Connection;
  private channel!: amqplib.Channel;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>("rabbitmq.url") as string;
    
    let retries = 5;
    while (retries > 0) {
      try {
        this.connection = await amqplib.connect(url);
        this.channel = await this.connection.createChannel();
        
        // Declarar exchange como durable (persiste restart)
        await this.channel.assertExchange(EXCHANGES.MESSAGES, "topic", { durable: true });
        await this.channel.assertExchange(EXCHANGES.AI, "topic", { durable: true });
        
        this.logger.log("✅ RabbitMQ InboundProducer connected");
        return;
      } catch (err) {
        retries--;
        this.logger.warn(`RabbitMQ connection failed, retrying... (${retries} left)`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    throw new Error("Failed to connect to RabbitMQ after 5 retries");
  }

  async publishInbound(event: InboundMessageEvent): Promise<void> {
    const payload = Buffer.from(JSON.stringify(event));
    
    const published = this.channel.publish(
      EXCHANGES.MESSAGES,
      ROUTING_KEYS.MSG_INBOUND,
      payload,
      {
        persistent: true,         // Mensagem sobrevive restart do broker
        contentType: "application/json",
        headers: {
          tenantId: event.tenantId,
          messageType: event.type,
        },
      },
    );

    if (!published) {
      // Canal com backpressure — aguardar drain
      await new Promise<void>((resolve) => this.channel.once("drain", resolve));
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
```

- [ ] **Step 3: Implementar OutboundConsumer**

```typescript
// apps/channel-service/src/queue/outbound.consumer.ts
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqplib from "amqplib";
import { MessagingService } from "../messaging/messaging.service";
import type { AiResponseEvent } from "@whatsagent/shared-types";
import { EXCHANGES, ROUTING_KEYS } from "@whatsagent/shared-types";

@Injectable()
export class OutboundConsumer implements OnModuleInit {
  private readonly logger = new Logger(OutboundConsumer.name);

  constructor(
    private readonly config: ConfigService,
    private readonly messagingService: MessagingService,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>("rabbitmq.url") as string;
    const connection = await amqplib.connect(url);
    const channel = await connection.createChannel();

    // Exchange e fila para respostas do AI
    await channel.assertExchange(EXCHANGES.AI, "topic", { durable: true });
    const queue = await channel.assertQueue("channel.outbound", { durable: true });
    await channel.bindQueue(queue.queue, EXCHANGES.AI, ROUTING_KEYS.AI_RESPONSE);

    // Processar 1 mensagem por vez (prefetch = 1)
    channel.prefetch(1);

    channel.consume(queue.queue, async (msg) => {
      if (!msg) return;
      
      try {
        const event: AiResponseEvent = JSON.parse(msg.content.toString());
        this.logger.log(`📤 Sending ${event.messages.length} messages to ${event.toPhone}`);
        
        for (const outMsg of event.messages) {
          await this.messagingService.sendMessage(event.waPhoneId, event.toPhone, outMsg);
          // Pequeno delay entre mensagens para parecer mais natural
          await new Promise((r) => setTimeout(r, 500));
        }
        
        channel.ack(msg);
      } catch (err) {
        this.logger.error("Failed to process outbound message:", err);
        // Nack sem requeue após erro — evitar loop infinito
        channel.nack(msg, false, false);
      }
    });

    this.logger.log("✅ OutboundConsumer listening on channel.outbound queue");
  }
}
```

- [ ] **Step 4: Rodar testes**

```bash
pnpm test inbound.producer
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/channel-service/src/queue/
git commit -m "feat(channel): add RabbitMQ inbound producer and outbound consumer"
```

---

### Task 6: Meta API Client — Envio de Mensagens

**Files:**
- Create: `apps/channel-service/src/messaging/meta-api.client.ts`
- Create: `apps/channel-service/src/messaging/messaging.service.ts`
- Test: `apps/channel-service/src/messaging/messaging.service.spec.ts`

- [ ] **Step 1: Escrever testes**

```typescript
// apps/channel-service/src/messaging/messaging.service.spec.ts
import { Test } from "@nestjs/testing";
import { MessagingService } from "./messaging.service";
import { MetaApiClient } from "./meta-api.client";

const mockMetaClient = { sendTextMessage: jest.fn(), sendImageMessage: jest.fn() };

describe("MessagingService", () => {
  let service: MessagingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: MetaApiClient, useValue: mockMetaClient },
      ],
    }).compile();
    service = module.get<MessagingService>(MessagingService);
    jest.clearAllMocks();
  });

  it("deve enviar mensagem de texto", async () => {
    mockMetaClient.sendTextMessage.mockResolvedValue({ messages: [{ id: "wamid.sent" }] });
    await service.sendMessage("phone_id", "5511999999999", { type: "text", text: "Olá!" });
    expect(mockMetaClient.sendTextMessage).toHaveBeenCalledWith(
      "phone_id", "5511999999999", "Olá!",
    );
  });
});
```

- [ ] **Step 2: Implementar MetaApiClient**

```typescript
// apps/channel-service/src/messaging/meta-api.client.ts
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

@Injectable()
export class MetaApiClient {
  private readonly logger = new Logger(MetaApiClient.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const baseUrl = config.get<string>("meta.graphApiBaseUrl");
    const version = config.get<string>("meta.graphApiVersion");
    
    this.http = axios.create({
      baseURL: `${baseUrl}/${version}`,
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${process.env.META_SYSTEM_USER_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  }

  async sendTextMessage(phoneNumberId: string, to: string, text: string): Promise<unknown> {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: text },
    };

    const res = await this.http.post(`/${phoneNumberId}/messages`, payload);
    this.logger.debug(`Text sent to ${to}: wamid=${res.data.messages[0].id}`);
    return res.data;
  }

  async sendImageMessage(
    phoneNumberId: string,
    to: string,
    imageUrl: string,
    caption?: string,
  ): Promise<unknown> {
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl, caption },
    };

    const res = await this.http.post(`/${phoneNumberId}/messages`, payload);
    return res.data;
  }

  async markAsRead(phoneNumberId: string, messageId: string): Promise<void> {
    await this.http.post(`/${phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    });
  }
}
```

- [ ] **Step 3: Implementar MessagingService**

```typescript
// apps/channel-service/src/messaging/messaging.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { MetaApiClient } from "./meta-api.client";
import type { OutboundMessage } from "@whatsagent/shared-types";

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(private readonly metaClient: MetaApiClient) {}

  async sendMessage(
    phoneNumberId: string,
    to: string,
    message: OutboundMessage,
  ): Promise<void> {
    try {
      switch (message.type) {
        case "text":
          if (message.text) {
            await this.metaClient.sendTextMessage(phoneNumberId, to, message.text);
          }
          break;

        case "image":
          if (message.imageUrl) {
            await this.metaClient.sendImageMessage(phoneNumberId, to, message.imageUrl);
          }
          break;

        default:
          this.logger.warn(`Unsupported outbound message type: ${message.type}`);
      }
    } catch (err) {
      this.logger.error(`Failed to send message to ${to}:`, err);
      throw err;
    }
  }
}
```

- [ ] **Step 4: Rodar testes**

```bash
pnpm test messaging.service
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/channel-service/src/messaging/
git commit -m "feat(channel): add meta api client and messaging service"
```

---

## Verificação do Plan 1

- [ ] Channel Service sobe: `pnpm --filter @whatsagent/channel-service start:dev` → porta 3001
- [ ] `curl http://localhost:3001/health` → `{"status":"ok"}`
- [ ] `GET http://localhost:3001/webhooks/meta?hub.mode=subscribe&hub.verify_token=whatsagent_verify_2025&hub.challenge=test123` → retorna `test123`
- [ ] Simular webhook com signature válida:
  ```bash
  BODY='{"object":"whatsapp_business_account","entry":[]}'
  SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "seu_webhook_secret" | awk '{print "sha256="$2}')
  curl -X POST http://localhost:3001/webhooks/meta \
    -H "Content-Type: application/json" \
    -H "X-Hub-Signature-256: $SIG" \
    -d "$BODY"
  # Expected: {"received":true}
  ```
- [ ] Simular webhook com signature inválida → 403 Forbidden
- [ ] Mensagem de áudio → AudioService chama Whisper e retorna transcrição
- [ ] Evento publicado aparece no RabbitMQ Management: http://localhost:15672
- [ ] Todos os testes passando: `pnpm --filter @whatsagent/channel-service test`
