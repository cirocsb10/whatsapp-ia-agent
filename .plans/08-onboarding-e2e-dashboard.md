# WhatsAgent â€” Onboarding, E2E Validation & Dashboard Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the onboarding company wizard to the backend, validate the E2E message flow with integration tests + smoke script, and wire all dashboard pages to real API endpoints (including building the Agent Config/Knowledge/GuardRules backend).

**Architecture:** Four sequential phases: (1) extend SettingsModule with company config endpoints + connect onboarding form; (2) write pytest/jest integration tests for the full RabbitMQ chain plus a smoke script; (3) add ConversationsModule + AgentModule (AgentConfig, KnowledgeBase, GuardRules, ChatSimulator) to the API; (4) wire every dashboard page to its real endpoint.

**Tech Stack:** NestJS 10 (API port 3002), Next.js 14 App Router (port 3000), Python 3.12 FastAPI + LangGraph (port 8000), Prisma ORM, Clerk auth (JWT via `useAuth().getToken()`), aio_pika, Jest, pytest, openai npm package

---

## Context

Three gaps block a usable SaaS:
1. `/setup/company` form collects name/timezone but only `console.log`s the data â€” never calls the API.
2. The RabbitMQ message chain (channel-service â†’ orchestrator â†’ channel-service) has no automated tests.
3. All dashboard pages (Overview, Analytics, Orders, Inbox, Settings, Agent) display hardcoded zeros. The Agent page needs backend modules that don't exist yet.

**Existing patterns to follow:**
- Auth guards: `@UseGuards(ClerkAuthGuard, RolesGuard)` + `@Roles("OWNER", "ADMIN")` + `@CurrentTenantId() tenantId: string`
- Service tests: `Test.createTestingModule({ providers: [Service, { provide: PrismaService, useValue: mockPrisma }] })`
- Frontend API calls: `const token = await getToken(); fetch(API_URL + path, { headers: { Authorization: \`Bearer ${token}\` } })`
- `API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"`

---

## Phase 1: Onboarding Wizard

### Task 1: Company settings DTO + service methods

**Files:**
- Create: `apps/api/src/modules/settings/dto/update-company.dto.ts`
- Modify: `apps/api/src/modules/settings/settings.service.ts`
- Create: `apps/api/src/modules/settings/settings.service.spec.ts`

- [ ] **Step 1: Create UpdateCompanyDto**

```typescript
// apps/api/src/modules/settings/dto/update-company.dto.ts
import { IsString, IsOptional, MinLength, MaxLength } from "class-validator";

export class UpdateCompanyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  timezone?: string;
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// apps/api/src/modules/settings/settings.service.spec.ts
import { Test } from "@nestjs/testing";
import { SettingsService } from "./settings.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";

const mockPrisma = { tenant: { findUnique: jest.fn(), update: jest.fn() } };

describe("SettingsService", () => {
  let service: SettingsService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [SettingsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(SettingsService);
    jest.clearAllMocks();
  });

  describe("getCompanySettings", () => {
    it("returns tenant fields", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: "t-1", name: "Loja", slug: "loja-abc", timezone: "America/Sao_Paulo" });
      const result = await service.getCompanySettings("t-1");
      expect(result).toEqual({ id: "t-1", name: "Loja", slug: "loja-abc", timezone: "America/Sao_Paulo" });
    });
    it("throws NotFoundException when not found", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.getCompanySettings("bad")).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateCompanySettings", () => {
    it("updates name and timezone", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: "t-1" });
      mockPrisma.tenant.update.mockResolvedValue({ id: "t-1", name: "Nova", slug: "nova-abc", timezone: "America/Manaus" });
      const result = await service.updateCompanySettings("t-1", { name: "Nova", timezone: "America/Manaus" });
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: "t-1" },
        data: { name: "Nova", timezone: "America/Manaus" },
        select: { id: true, name: true, slug: true, timezone: true },
      });
      expect(result.name).toBe("Nova");
    });
    it("omits timezone when not provided", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: "t-1" });
      mockPrisma.tenant.update.mockResolvedValue({ id: "t-1", name: "Nova", slug: "nova-abc", timezone: "America/Sao_Paulo" });
      await service.updateCompanySettings("t-1", { name: "Nova" });
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: "Nova" } }),
      );
    });
  });
});
```

- [ ] **Step 3: Run tests â€” expect FAIL**

```bash
pnpm --filter @whatsagent/api test -- --testPathPattern=settings.service
```
Expected: FAIL â€” `getCompanySettings is not a function`

- [ ] **Step 4: Add methods to SettingsService**

Append inside `SettingsService` class in `apps/api/src/modules/settings/settings.service.ts`:

```typescript
  async getCompanySettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, timezone: true },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenant;
  }

  async updateCompanySettings(tenantId: string, dto: UpdateCompanyDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    const data: { name?: string; timezone?: string } = { name: dto.name };
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: { id: true, name: true, slug: true, timezone: true },
    });
  }
```

Also add the import at top of the file:
```typescript
import { UpdateCompanyDto } from "./dto/update-company.dto";
```

- [ ] **Step 5: Run tests â€” expect PASS**

```bash
pnpm --filter @whatsagent/api test -- --testPathPattern=settings.service
```
Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/settings/
git commit -m "feat(api): add getCompanySettings + updateCompanySettings to SettingsService"
```

---

### Task 2: Company settings controller endpoints

**Files:**
- Modify: `apps/api/src/modules/settings/settings.controller.ts`

- [ ] **Step 1: Replace full controller file**

```typescript
// apps/api/src/modules/settings/settings.controller.ts
import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { UpdateWhatsappSettingsDto } from "./dto/update-whatsapp-settings.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("settings")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get("company")
  @Roles("OWNER", "ADMIN")
  getCompany(@CurrentTenantId() tenantId: string) {
    return this.service.getCompanySettings(tenantId);
  }

  @Patch("company")
  @Roles("OWNER", "ADMIN")
  updateCompany(@CurrentTenantId() tenantId: string, @Body() dto: UpdateCompanyDto) {
    return this.service.updateCompanySettings(tenantId, dto);
  }

  @Patch("whatsapp")
  @Roles("OWNER", "ADMIN")
  updateWhatsapp(@CurrentTenantId() tenantId: string, @Body() dto: UpdateWhatsappSettingsDto) {
    return this.service.updateWhatsappSettings(tenantId, dto);
  }
}
```

- [ ] **Step 2: Run full API test suite â€” no regressions**

```bash
pnpm --filter @whatsagent/api test
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/settings/settings.controller.ts
git commit -m "feat(api): add GET /settings/company and PATCH /settings/company"
```

---

### Task 3: Frontend company page â€” connect to API

**Files:**
- Modify: `apps/web/src/app/(onboarding)/setup/company/page.tsx`

- [ ] **Step 1: Add useAuth import and API_URL constant**

At the top of the file, add to existing imports:
```typescript
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
```

Inside the component function, after the `useForm()` call, add:
```typescript
const { getToken } = useAuth();
const [apiError, setApiError] = useState<string | null>(null);
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
```

- [ ] **Step 2: Add useEffect to pre-fill form from API**

After the state declarations, add:
```typescript
useEffect(() => {
  async function load() {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/settings/company`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      form.reset({
        name: data.name ?? "",
        slug: data.slug ?? "",
        timezone: data.timezone ?? "America/Sao_Paulo",
      });
    } catch {
      // pre-fill is best-effort
    }
  }
  load();
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Replace onSubmit handler**

Find and replace the existing `onSubmit` function:
```typescript
async function onSubmit(data: F) {
  setApiError(null);
  try {
    const token = await getToken();
    const res = await fetch(`${API_URL}/settings/company`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: data.name, timezone: data.timezone }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setApiError((body as any).message ?? "Erro ao salvar configuraÃ§Ãµes.");
      return;
    }
    router.push("/setup/plan");
  } catch {
    setApiError("Erro de conexÃ£o. Tente novamente.");
  }
}
```

- [ ] **Step 4: Add error display in JSX**

Just before the submit `<Button>`, add:
```tsx
{apiError && (
  <p className="text-sm text-red-400 text-center">{apiError}</p>
)}
```

- [ ] **Step 5: Verify manually**

```bash
pnpm --filter @whatsagent/web dev
pnpm --filter @whatsagent/api dev
```
1. Navigate to `http://localhost:3000/setup/company`
2. Fill form and click Continue
3. Verify redirect to `/setup/plan` occurs
4. Verify in `pnpm db:studio` that `Tenant.name` and `Tenant.timezone` were updated

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(onboarding)/setup/company/page.tsx
git commit -m "feat(web): connect company setup form to GET/PATCH /settings/company"
```

---

## Phase 2: E2E Message Flow Validation

### Task 4: AI orchestrator integration tests (pytest)

**Files:**
- Create: `apps/ai-orchestrator/tests/test_consumer.py`
- Create: `apps/ai-orchestrator/tests/test_publisher.py`

- [ ] **Step 1: Create test_consumer.py**

```python
# apps/ai-orchestrator/tests/test_consumer.py
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from src.consumers.rabbitmq import process_inbound_message


def make_mock_message(payload: dict):
    msg = AsyncMock()
    msg.body = json.dumps(payload).encode()
    msg.process = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=None),
            __aexit__=AsyncMock(return_value=False),
        )
    )
    return msg


SAMPLE_EVENT = {
    "tenantId": "tenant-001",
    "from": "5511999990000",
    "whatsappPhoneId": "phone-001",
    "type": "text",
    "text": "Quero ver o cardÃ¡pio",
    "conversationId": "conv-001",
    "waMessageId": "wamid-001",
}

FAKE_FINAL_STATE = {
    "messages": [{"role": "user", "content": "Quero ver o cardÃ¡pio"}],
    "current_stage": "CATALOG",
    "cart": [],
    "final_messages": [{"type": "text", "text": "Aqui estÃ¡ nosso cardÃ¡pio!"}],
    "should_handoff": False,
    "handoff_reason": None,
}


@pytest.mark.asyncio
async def test_process_inbound_message_happy_path():
    mock_session_svc = AsyncMock()
    mock_session_svc.get_or_create.return_value = MagicMock(
        conversation_id="conv-001", messages=[], current_stage="START", cart=[]
    )
    mock_publisher = AsyncMock()
    mock_message = make_mock_message(SAMPLE_EVENT)

    with patch("src.consumers.rabbitmq.get_agent_graph") as mock_graph_fn, \
         patch("src.consumers.rabbitmq.PromptBuilderService") as mock_pb_cls:
        mock_graph = AsyncMock()
        mock_graph.ainvoke.return_value = FAKE_FINAL_STATE
        mock_graph_fn.return_value = mock_graph
        mock_pb_cls.return_value = AsyncMock(
            get_agent_config=AsyncMock(return_value={"agent_name": "Bot", "tone": "FRIENDLY"})
        )

        await process_inbound_message(mock_message, mock_session_svc, mock_publisher)

    mock_session_svc.get_or_create.assert_called_once_with("tenant-001", "5511999990000")
    initial_state = mock_graph.ainvoke.call_args[0][0]
    assert initial_state["current_message"] == "Quero ver o cardÃ¡pio"
    assert initial_state["tenant_id"] == "tenant-001"

    mock_publisher.publish_response.assert_called_once()
    published = mock_publisher.publish_response.call_args[0][0]
    assert published["toPhone"] == "5511999990000"
    assert published["waPhoneId"] == "phone-001"
    assert published["messages"] == [{"type": "text", "text": "Aqui estÃ¡ nosso cardÃ¡pio!"}]
    assert published["triggerHandoff"] is False


@pytest.mark.asyncio
async def test_process_inbound_uses_audio_transcript_when_text_missing():
    event = {**SAMPLE_EVENT, "text": None, "audioTranscript": "Quero saber o preÃ§o"}
    mock_session_svc = AsyncMock()
    mock_session_svc.get_or_create.return_value = MagicMock(
        conversation_id="conv-001", messages=[], current_stage="START", cart=[]
    )
    mock_publisher = AsyncMock()

    with patch("src.consumers.rabbitmq.get_agent_graph") as mock_graph_fn, \
         patch("src.consumers.rabbitmq.PromptBuilderService") as mock_pb_cls:
        mock_graph = AsyncMock()
        mock_graph.ainvoke.return_value = FAKE_FINAL_STATE
        mock_graph_fn.return_value = mock_graph
        mock_pb_cls.return_value = AsyncMock(get_agent_config=AsyncMock(return_value={}))

        await process_inbound_message(make_mock_message(event), mock_session_svc, mock_publisher)

    initial_state = mock_graph.ainvoke.call_args[0][0]
    assert initial_state["current_message"] == "Quero saber o preÃ§o"


@pytest.mark.asyncio
async def test_process_inbound_does_not_raise_on_graph_exception():
    mock_session_svc = AsyncMock()
    mock_session_svc.get_or_create.return_value = MagicMock(
        conversation_id="conv-001", messages=[], current_stage="START", cart=[]
    )
    mock_publisher = AsyncMock()

    with patch("src.consumers.rabbitmq.get_agent_graph") as mock_graph_fn, \
         patch("src.consumers.rabbitmq.PromptBuilderService") as mock_pb_cls:
        mock_graph = AsyncMock()
        mock_graph.ainvoke.side_effect = RuntimeError("LLM timeout")
        mock_graph_fn.return_value = mock_graph
        mock_pb_cls.return_value = AsyncMock(get_agent_config=AsyncMock(return_value={}))

        await process_inbound_message(make_mock_message(SAMPLE_EVENT), mock_session_svc, mock_publisher)

    mock_publisher.publish_response.assert_not_called()
```

- [ ] **Step 2: Create test_publisher.py**

```python
# apps/ai-orchestrator/tests/test_publisher.py
import json
import pytest
from unittest.mock import AsyncMock
from src.publishers.rabbitmq import RabbitMQPublisher


SAMPLE_RESPONSE = {
    "tenantId": "tenant-001",
    "conversationId": "conv-001",
    "waPhoneId": "phone-001",
    "toPhone": "5511999990000",
    "messages": [{"type": "text", "text": "OlÃ¡! Aqui estÃ¡ o cardÃ¡pio."}],
    "triggerHandoff": False,
    "handoffReason": None,
}


@pytest.mark.asyncio
async def test_publish_response_sends_json_to_exchange():
    publisher = RabbitMQPublisher(rabbitmq_url="amqp://test")
    mock_exchange = AsyncMock()
    publisher._exchange = mock_exchange

    await publisher.publish_response(SAMPLE_RESPONSE)

    mock_exchange.publish.assert_called_once()
    call_args = mock_exchange.publish.call_args
    message = call_args[0][0]
    routing_key = call_args[1]["routing_key"]

    body = json.loads(message.body.decode())
    assert body["toPhone"] == "5511999990000"
    assert body["messages"][0]["text"] == "OlÃ¡! Aqui estÃ¡ o cardÃ¡pio."
    assert routing_key == "ai.response"


@pytest.mark.asyncio
async def test_publish_response_raises_when_not_connected():
    publisher = RabbitMQPublisher(rabbitmq_url="amqp://test")
    with pytest.raises(RuntimeError, match="not connected"):
        await publisher.publish_response(SAMPLE_RESPONSE)
```

- [ ] **Step 3: Run tests**

```bash
cd apps/ai-orchestrator
.venv/Scripts/pytest tests/test_consumer.py tests/test_publisher.py -v
```
Expected: 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/ai-orchestrator/tests/
git commit -m "test(orchestrator): integration tests for consumer and publisher"
```

---

### Task 5: Channel-service outbound consumer â€” extract handler + test

**Files:**
- Modify: `apps/channel-service/src/queue/outbound.consumer.ts`
- Create: `apps/channel-service/src/queue/outbound.consumer.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/channel-service/src/queue/outbound.consumer.spec.ts
import { Test } from "@nestjs/testing";
import { OutboundConsumer } from "./outbound.consumer";
import { MessagingService } from "../messaging/messaging.service";
import { ConfigService } from "@nestjs/config";

const mockMessaging = { sendMessage: jest.fn().mockResolvedValue(undefined) };
const mockConfig = { get: jest.fn().mockReturnValue("amqp://localhost") };

describe("OutboundConsumer.handleOutboundMessage", () => {
  let consumer: OutboundConsumer;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OutboundConsumer,
        { provide: MessagingService, useValue: mockMessaging },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    consumer = module.get(OutboundConsumer);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => jest.useRealTimers());

  it("calls sendMessage for each message", async () => {
    const event = {
      waPhoneId: "phone-001",
      toPhone: "5511999990000",
      messages: [{ type: "text", text: "Msg 1" }, { type: "text", text: "Msg 2" }],
    };
    const promise = consumer.handleOutboundMessage(event);
    jest.runAllTimersAsync();
    await promise;

    expect(mockMessaging.sendMessage).toHaveBeenCalledTimes(2);
    expect(mockMessaging.sendMessage).toHaveBeenNthCalledWith(
      1, "phone-001", "5511999990000", { type: "text", text: "Msg 1" }
    );
  });

  it("handles image messages", async () => {
    const event = {
      waPhoneId: "phone-001", toPhone: "5511999990000",
      messages: [{ type: "image", imageUrl: "https://example.com/img.jpg" }],
    };
    const promise = consumer.handleOutboundMessage(event);
    jest.runAllTimersAsync();
    await promise;

    expect(mockMessaging.sendMessage).toHaveBeenCalledWith(
      "phone-001", "5511999990000", { type: "image", imageUrl: "https://example.com/img.jpg" }
    );
  });
});
```

- [ ] **Step 2: Run â€” expect FAIL**

```bash
pnpm --filter @whatsagent/channel-service test -- --testPathPattern=outbound.consumer
```
Expected: FAIL â€” `handleOutboundMessage is not a function`

- [ ] **Step 3: Refactor OutboundConsumer to extract handler**

```typescript
// apps/channel-service/src/queue/outbound.consumer.ts
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqplib from "amqplib";
import { MessagingService } from "../messaging/messaging.service";

interface OutboundEvent {
  waPhoneId: string;
  toPhone: string;
  messages: Array<{ type: string; text?: string; imageUrl?: string }>;
}

@Injectable()
export class OutboundConsumer implements OnModuleInit {
  private readonly logger = new Logger(OutboundConsumer.name);

  constructor(
    private readonly config: ConfigService,
    private readonly messaging: MessagingService,
  ) {}

  async handleOutboundMessage(event: OutboundEvent): Promise<void> {
    for (const m of event.messages) {
      await this.messaging.sendMessage(event.waPhoneId, event.toPhone, {
        type: m.type as "text" | "image" | "template",
        ...(m.text !== undefined && { text: m.text }),
        ...(m.imageUrl !== undefined && { imageUrl: m.imageUrl }),
      });
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>("rabbitmq.url") as string;
    try {
      const connection = await amqplib.connect(url);
      const channel = await connection.createChannel();
      await channel.assertExchange("ai", "topic", { durable: true });
      const q = await channel.assertQueue("channel.outbound", { durable: true });
      await channel.bindQueue(q.queue, "ai", "ai.response");
      channel.prefetch(1);
      channel.consume(q.queue, async (msg) => {
        if (!msg) return;
        try {
          const event = JSON.parse(msg.content.toString()) as OutboundEvent;
          await this.handleOutboundMessage(event);
          channel.ack(msg);
        } catch (err) {
          this.logger.error("Outbound error:", err);
          channel.nack(msg, false, false);
        }
      });
      this.logger.log("âœ… OutboundConsumer listening");
    } catch (err) {
      this.logger.warn("RabbitMQ not available, outbound consumer skipped:", err);
    }
  }
}
```

- [ ] **Step 4: Run tests â€” expect PASS**

```bash
pnpm --filter @whatsagent/channel-service test -- --testPathPattern=outbound.consumer
```
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/channel-service/src/queue/
git commit -m "test(channel): OutboundConsumer integration test + extract handleOutboundMessage"
```

---

### Task 6: E2E smoke test script

**Files:**
- Create: `scripts/e2e-smoke.py`

- [ ] **Step 1: Create script**

```python
#!/usr/bin/env python3
# scripts/e2e-smoke.py
# Usage: python scripts/e2e-smoke.py
# Requires: docker-compose up (RabbitMQ) + ai-orchestrator running
import asyncio, json, os, sys, uuid
from datetime import datetime
import aio_pika

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://whatsagent:rabbitmq_secret@localhost:5672")
TIMEOUT = 30

TEST_EVENT = {
    "tenantId": os.getenv("TEST_TENANT_ID", "test-tenant-001"),
    "from": "5511999990001",
    "whatsappPhoneId": os.getenv("TEST_PHONE_ID", "test-phone-001"),
    "type": "text",
    "text": "OlÃ¡, quero saber sobre vocÃªs",
    "conversationId": str(uuid.uuid4()),
    "contactId": "test-contact-001",
    "waMessageId": f"wamid-smoke-{uuid.uuid4().hex[:8]}",
    "timestamp": int(datetime.utcnow().timestamp()),
}


async def main():
    print(f"ðŸ”Œ Connecting to {RABBITMQ_URL}...")
    connection = await aio_pika.connect_robust(RABBITMQ_URL)
    channel = await connection.channel()

    out_exchange = await channel.declare_exchange("ai", aio_pika.ExchangeType.TOPIC, durable=True)
    tmp_queue = await channel.declare_queue(exclusive=True)
    await tmp_queue.bind(out_exchange, routing_key="ai.response")

    in_exchange = await channel.declare_exchange("messages", aio_pika.ExchangeType.TOPIC, durable=True)
    body = json.dumps(TEST_EVENT, ensure_ascii=False).encode()
    await in_exchange.publish(
        aio_pika.Message(body=body, content_type="application/json", delivery_mode=aio_pika.DeliveryMode.PERSISTENT),
        routing_key="msg.inbound",
    )
    print(f'ðŸ“¤ Published msg.inbound | tenant={TEST_EVENT["tenantId"]} | "{TEST_EVENT["text"]}"')
    print(f"â³ Waiting up to {TIMEOUT}s for ai.response...")

    try:
        async with asyncio.timeout(TIMEOUT):
            async with tmp_queue.iterator() as q:
                async for message in q:
                    async with message.process():
                        r = json.loads(message.body.decode())
                        print("\nâœ… Response received!")
                        print(f"   toPhone: {r.get('toPhone')}")
                        print(f"   triggerHandoff: {r.get('triggerHandoff')}")
                        for i, m in enumerate(r.get("messages", []), 1):
                            print(f"   [{i}] {m.get('type')}: {str(m.get('text',''))[:120]}")
                        await connection.close()
                        return 0
    except asyncio.TimeoutError:
        print(f"\nâŒ No response in {TIMEOUT}s â€” is the orchestrator running?")
        print("   Run: cd apps/ai-orchestrator && .venv/Scripts/uvicorn src.main:app --port 8000")
        await connection.close()
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
```

- [ ] **Step 2: Verify script runs without crashing**

```bash
python scripts/e2e-smoke.py
```
Expected: either `âœ… Response received!` (if full stack running) or `âŒ No response in 30s` (no orchestrator). Either is acceptable â€” script must not crash with an unhandled exception.

- [ ] **Step 3: Commit**

```bash
git add scripts/e2e-smoke.py
git commit -m "chore: add E2E smoke test script for RabbitMQ message flow"
```

---

## Phase 3: Dashboard Backend

### Task 7: Conversations API module

**Files:**
- Create: `apps/api/src/modules/conversations/conversations.service.ts`
- Create: `apps/api/src/modules/conversations/conversations.service.spec.ts`
- Create: `apps/api/src/modules/conversations/conversations.controller.ts`
- Create: `apps/api/src/modules/conversations/conversations.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/src/modules/conversations/conversations.service.spec.ts
import { Test } from "@nestjs/testing";
import { ConversationsService } from "./conversations.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";

const mockConvs = [{
  id: "conv-1", status: "ACTIVE", lastMessageAt: new Date(),
  contact: { id: "c-1", phone: "5511999990001", name: "JoÃ£o", avatarUrl: null },
  messages: [{ id: "m-1", text: "OlÃ¡", direction: "INBOUND", sentAt: new Date(), isFromAi: false }],
}];
const mockPrisma = {
  conversation: { findMany: jest.fn(), findUnique: jest.fn() },
  message: { findMany: jest.fn() },
};

describe("ConversationsService", () => {
  let service: ConversationsService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ConversationsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(ConversationsService);
    jest.clearAllMocks();
  });

  it("listConversations queries by tenantId", async () => {
    mockPrisma.conversation.findMany.mockResolvedValue(mockConvs);
    const result = await service.listConversations("t-1", {});
    expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "t-1" }) }),
    );
    expect(result[0].contact.name).toBe("JoÃ£o");
  });

  it("listMessages throws 404 for wrong tenant", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(null);
    await expect(service.listMessages("t-1", "bad-id", {})).rejects.toThrow(NotFoundException);
  });

  it("listMessages returns messages for valid conversation", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({ id: "conv-1", tenantId: "t-1" });
    mockPrisma.message.findMany.mockResolvedValue([{ id: "m-1", text: "Hi", direction: "INBOUND" }]);
    const result = await service.listMessages("t-1", "conv-1", {});
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run â€” expect FAIL**

```bash
pnpm --filter @whatsagent/api test -- --testPathPattern=conversations.service
```

- [ ] **Step 3: Create ConversationsService**

```typescript
// apps/api/src/modules/conversations/conversations.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  listConversations(tenantId: string, opts: { limit?: number; cursor?: string; status?: string }) {
    const { limit = 20, cursor, status } = opts;
    return this.prisma.conversation.findMany({
      where: { tenantId, ...(status && { status: status as any }), ...(cursor && { id: { lt: cursor } }) },
      take: limit,
      orderBy: { lastMessageAt: "desc" },
      include: {
        contact: { select: { id: true, phone: true, name: true, avatarUrl: true } },
        messages: { take: 1, orderBy: { sentAt: "desc" }, select: { id: true, text: true, direction: true, sentAt: true, isFromAi: true } },
      },
    });
  }

  async listMessages(tenantId: string, conversationId: string, opts: { limit?: number; cursor?: string }) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId }, select: { id: true, tenantId: true },
    });
    if (!conv || conv.tenantId !== tenantId) throw new NotFoundException("Conversation not found");
    const { limit = 50, cursor } = opts;
    return this.prisma.message.findMany({
      where: { conversationId, ...(cursor && { id: { lt: cursor } }) },
      take: limit,
      orderBy: { sentAt: "asc" },
      select: { id: true, text: true, direction: true, type: true, sentAt: true, isFromAi: true, audioTranscript: true, imageUrl: true },
    });
  }
}
```

- [ ] **Step 4: Create controller + module**

```typescript
// apps/api/src/modules/conversations/conversations.controller.ts
import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("conversations")
@UseGuards(ClerkAuthGuard)
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string, @Query("limit") limit?: string, @Query("cursor") cursor?: string, @Query("status") status?: string) {
    return this.service.listConversations(tenantId, { limit: limit ? +limit : 20, cursor, status });
  }

  @Get(":id/messages")
  messages(@CurrentTenantId() tenantId: string, @Param("id") id: string, @Query("limit") limit?: string, @Query("cursor") cursor?: string) {
    return this.service.listMessages(tenantId, id, { limit: limit ? +limit : 50, cursor });
  }
}
```

```typescript
// apps/api/src/modules/conversations/conversations.module.ts
import { Module } from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { ConversationsController } from "./conversations.controller";
import { PrismaModule } from "../../common/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
```

In `apps/api/src/app.module.ts`, add:
```typescript
import { ConversationsModule } from "./modules/conversations/conversations.module";
// add ConversationsModule to imports array
```

- [ ] **Step 5: Run tests + build**

```bash
pnpm --filter @whatsagent/api test -- --testPathPattern=conversations.service
pnpm --filter @whatsagent/api build
```
Expected: 3 tests PASS, build succeeds

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/conversations/ apps/api/src/app.module.ts
git commit -m "feat(api): add ConversationsModule with GET /conversations and /conversations/:id/messages"
```

---

### Task 8: Agent Config module

**Files:**
- Create: `apps/api/src/modules/agent/dto/update-agent-config.dto.ts`
- Create: `apps/api/src/modules/agent/agent-config.service.ts`
- Create: `apps/api/src/modules/agent/agent-config.service.spec.ts`
- Create: `apps/api/src/modules/agent/agent-config.controller.ts`
- Create: `apps/api/src/modules/agent/agent.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create UpdateAgentConfigDto**

```typescript
// apps/api/src/modules/agent/dto/update-agent-config.dto.ts
import { IsString, IsOptional, IsNumber, IsBoolean, Min, Max, IsEnum } from "class-validator";

export enum AgentTone { FORMAL = "FORMAL", INFORMAL = "INFORMAL", FRIENDLY = "FRIENDLY", TECHNICAL = "TECHNICAL", REGIONAL = "REGIONAL" }

export class UpdateAgentConfigDto {
  @IsOptional() @IsString() agentName?: string;
  @IsOptional() @IsEnum(AgentTone) tone?: AgentTone;
  @IsOptional() @IsString() greetingMessage?: string;
  @IsOptional() @IsString() inactivityMessage?: string;
  @IsOptional() @IsString() closingMessage?: string;
  @IsOptional() @IsString() outOfHoursMessage?: string;
  @IsOptional() @IsString() llmModel?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(2) llmTemperature?: number;
  @IsOptional() @IsNumber() @Min(100) @Max(2000) maxResponseLength?: number;
  @IsOptional() @IsString() handoffMessage?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) autoHandoffThreshold?: number;
  @IsOptional() @IsString() systemPromptBase?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// apps/api/src/modules/agent/agent-config.service.spec.ts
import { Test } from "@nestjs/testing";
import { AgentConfigService } from "./agent-config.service";
import { PrismaService } from "../../common/prisma/prisma.service";

const mockPrisma = { agentConfig: { upsert: jest.fn() } };

describe("AgentConfigService", () => {
  let service: AgentConfigService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AgentConfigService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(AgentConfigService);
    jest.clearAllMocks();
  });

  it("getConfig upserts defaults when no config exists", async () => {
    mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1", agentName: "Assistente" });
    const result = await service.getConfig("t-1");
    expect(mockPrisma.agentConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "t-1" }, create: expect.objectContaining({ tenantId: "t-1" }) }),
    );
    expect(result.agentName).toBe("Assistente");
  });

  it("updateConfig applies partial updates via upsert", async () => {
    mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1", agentName: "Bot Vendas" });
    const result = await service.updateConfig("t-1", { agentName: "Bot Vendas" });
    expect(result.agentName).toBe("Bot Vendas");
  });
});
```

- [ ] **Step 3: Run â€” expect FAIL**

```bash
pnpm --filter @whatsagent/api test -- --testPathPattern=agent-config.service
```

- [ ] **Step 4: Create AgentConfigService**

```typescript
// apps/api/src/modules/agent/agent-config.service.ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UpdateAgentConfigDto } from "./dto/update-agent-config.dto";

@Injectable()
export class AgentConfigService {
  constructor(private readonly prisma: PrismaService) {}

  getConfig(tenantId: string) {
    return this.prisma.agentConfig.upsert({ where: { tenantId }, create: { tenantId }, update: {} });
  }

  updateConfig(tenantId: string, dto: UpdateAgentConfigDto) {
    return this.prisma.agentConfig.upsert({ where: { tenantId }, create: { tenantId, ...dto }, update: dto });
  }
}
```

- [ ] **Step 5: Create controller**

```typescript
// apps/api/src/modules/agent/agent-config.controller.ts
import { Controller, Get, Patch, Post, Delete, Body, Param, Query, UseGuards } from "@nestjs/common";
import { AgentConfigService } from "./agent-config.service";
import { UpdateAgentConfigDto } from "./dto/update-agent-config.dto";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("agent")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class AgentConfigController {
  constructor(private readonly service: AgentConfigService) {}

  @Get("config")
  @Roles("OWNER", "ADMIN")
  getConfig(@CurrentTenantId() tenantId: string) {
    return this.service.getConfig(tenantId);
  }

  @Patch("config")
  @Roles("OWNER", "ADMIN")
  updateConfig(@CurrentTenantId() tenantId: string, @Body() dto: UpdateAgentConfigDto) {
    return this.service.updateConfig(tenantId, dto);
  }
}
```

- [ ] **Step 6: Create AgentModule + register in AppModule**

```typescript
// apps/api/src/modules/agent/agent.module.ts
import { Module } from "@nestjs/common";
import { AgentConfigService } from "./agent-config.service";
import { AgentConfigController } from "./agent-config.controller";
import { PrismaModule } from "../../common/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [AgentConfigController],
  providers: [AgentConfigService],
  exports: [AgentConfigService],
})
export class AgentModule {}
```

In `apps/api/src/app.module.ts`:
```typescript
import { AgentModule } from "./modules/agent/agent.module";
// add AgentModule to imports array
```

- [ ] **Step 7: Run tests**

```bash
pnpm --filter @whatsagent/api test -- --testPathPattern=agent-config.service
```
Expected: 2 tests PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/agent/ apps/api/src/app.module.ts
git commit -m "feat(api): add AgentModule with GET/PATCH /agent/config"
```

---

### Task 9: Knowledge Base + Guard Rules services

**Files:**
- Create: `apps/api/src/modules/agent/dto/create-knowledge.dto.ts`
- Create: `apps/api/src/modules/agent/dto/create-guard-rule.dto.ts`
- Create: `apps/api/src/modules/agent/knowledge.service.ts`
- Create: `apps/api/src/modules/agent/knowledge.service.spec.ts`
- Create: `apps/api/src/modules/agent/guard-rules.service.ts`
- Create: `apps/api/src/modules/agent/guard-rules.service.spec.ts`
- Modify: `apps/api/src/modules/agent/agent-config.controller.ts`
- Modify: `apps/api/src/modules/agent/agent.module.ts`

- [ ] **Step 1: Create DTOs**

```typescript
// apps/api/src/modules/agent/dto/create-knowledge.dto.ts
import { IsString, IsEnum, IsNotEmpty, IsOptional, MinLength } from "class-validator";
export enum KnowledgeType { TEXT = "TEXT", URL = "URL" }
export class CreateKnowledgeDto {
  @IsString() @IsNotEmpty() name: string;
  @IsEnum(KnowledgeType) type: KnowledgeType;
  @IsString() @MinLength(10) content: string;
  @IsOptional() @IsString() fileUrl?: string;
}
```

```typescript
// apps/api/src/modules/agent/dto/create-guard-rule.dto.ts
import { IsString, IsEnum, IsOptional, IsBoolean, IsInt, IsObject, Min, Max } from "class-validator";
export enum GuardRuleType { TEXT_BLOCK="TEXT_BLOCK", SEMANTIC_BLOCK="SEMANTIC_BLOCK", NUMERIC_CAP="NUMERIC_CAP", PRODUCT_RESTRICT="PRODUCT_RESTRICT", HANDOFF_TRIGGER="HANDOFF_TRIGGER", REGEX_MATCH="REGEX_MATCH" }
export enum GuardRuleAction { BLOCK="BLOCK", REWRITE="REWRITE", HANDOFF="HANDOFF", LOG_ONLY="LOG_ONLY" }
export class CreateGuardRuleDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(GuardRuleType) type: GuardRuleType;
  @IsEnum(GuardRuleAction) action: GuardRuleAction;
  @IsOptional() @IsInt() @Min(1) @Max(1000) priority?: number;
  @IsObject() config: Record<string, unknown>;
  @IsOptional() @IsString() fallbackMessage?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
```

- [ ] **Step 2: Write failing tests for KnowledgeService**

```typescript
// apps/api/src/modules/agent/knowledge.service.spec.ts
import { Test } from "@nestjs/testing";
import { KnowledgeService } from "./knowledge.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";

const mockPrisma = { knowledgeBase: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() } };

describe("KnowledgeService", () => {
  let service: KnowledgeService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [KnowledgeService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(KnowledgeService);
    jest.clearAllMocks();
  });

  it("list queries by tenantId", async () => {
    mockPrisma.knowledgeBase.findMany.mockResolvedValue([{ id: "kb-1" }]);
    await service.list("t-1");
    expect(mockPrisma.knowledgeBase.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "t-1" } }));
  });

  it("create saves entry", async () => {
    mockPrisma.knowledgeBase.create.mockResolvedValue({ id: "kb-2", name: "FAQ" });
    const r = await service.create("t-1", { name: "FAQ", type: "TEXT" as any, content: "Our return policy is 30 days..." });
    expect(r.id).toBe("kb-2");
  });

  it("delete throws 404 when not found", async () => {
    mockPrisma.knowledgeBase.findUnique.mockResolvedValue(null);
    await expect(service.delete("t-1", "bad")).rejects.toThrow(NotFoundException);
  });

  it("delete removes entry", async () => {
    mockPrisma.knowledgeBase.findUnique.mockResolvedValue({ id: "kb-1", tenantId: "t-1" });
    mockPrisma.knowledgeBase.delete.mockResolvedValue({ id: "kb-1" });
    await service.delete("t-1", "kb-1");
    expect(mockPrisma.knowledgeBase.delete).toHaveBeenCalledWith({ where: { id: "kb-1" } });
  });
});
```

- [ ] **Step 3: Write failing tests for GuardRulesService**

```typescript
// apps/api/src/modules/agent/guard-rules.service.spec.ts
import { Test } from "@nestjs/testing";
import { GuardRulesService } from "./guard-rules.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";

const mockPrisma = { guardRule: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() } };

describe("GuardRulesService", () => {
  let service: GuardRulesService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [GuardRulesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(GuardRulesService);
    jest.clearAllMocks();
  });

  it("list orders by priority", async () => {
    mockPrisma.guardRule.findMany.mockResolvedValue([]);
    await service.list("t-1");
    expect(mockPrisma.guardRule.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { priority: "asc" } }));
  });

  it("create saves rule", async () => {
    mockPrisma.guardRule.create.mockResolvedValue({ id: "r-1" });
    const r = await service.create("t-1", { name: "Block prices", type: "TEXT_BLOCK" as any, action: "BLOCK" as any, config: {} });
    expect(r.id).toBe("r-1");
  });

  it("update throws 404 when not found", async () => {
    mockPrisma.guardRule.findUnique.mockResolvedValue(null);
    await expect(service.update("t-1", "bad", {})).rejects.toThrow(NotFoundException);
  });

  it("delete removes rule", async () => {
    mockPrisma.guardRule.findUnique.mockResolvedValue({ id: "r-1", tenantId: "t-1" });
    mockPrisma.guardRule.delete.mockResolvedValue({ id: "r-1" });
    await service.delete("t-1", "r-1");
    expect(mockPrisma.guardRule.delete).toHaveBeenCalledWith({ where: { id: "r-1" } });
  });
});
```

- [ ] **Step 4: Run â€” expect FAIL both**

```bash
pnpm --filter @whatsagent/api test -- --testPathPattern="knowledge.service|guard-rules.service"
```

- [ ] **Step 5: Create KnowledgeService**

```typescript
// apps/api/src/modules/agent/knowledge.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateKnowledgeDto } from "./dto/create-knowledge.dto";

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.knowledgeBase.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, type: true, isIndexed: true, chunkCount: true, createdAt: true },
    });
  }

  create(tenantId: string, dto: CreateKnowledgeDto) {
    return this.prisma.knowledgeBase.create({
      data: { tenantId, name: dto.name, type: dto.type, content: dto.content, fileUrl: dto.fileUrl },
    });
  }

  async delete(tenantId: string, id: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id }, select: { id: true, tenantId: true } });
    if (!kb || kb.tenantId !== tenantId) throw new NotFoundException("Knowledge base entry not found");
    return this.prisma.knowledgeBase.delete({ where: { id } });
  }
}
```

- [ ] **Step 6: Create GuardRulesService**

```typescript
// apps/api/src/modules/agent/guard-rules.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateGuardRuleDto } from "./dto/create-guard-rule.dto";

@Injectable()
export class GuardRulesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.guardRule.findMany({ where: { tenantId }, orderBy: { priority: "asc" } });
  }

  create(tenantId: string, dto: CreateGuardRuleDto) {
    return this.prisma.guardRule.create({
      data: { tenantId, name: dto.name, description: dto.description, type: dto.type as any, action: dto.action as any, priority: dto.priority ?? 100, config: dto.config, fallbackMessage: dto.fallbackMessage, isActive: dto.isActive ?? true },
    });
  }

  async update(tenantId: string, id: string, dto: Partial<CreateGuardRuleDto>) {
    const rule = await this.prisma.guardRule.findUnique({ where: { id }, select: { id: true, tenantId: true } });
    if (!rule || rule.tenantId !== tenantId) throw new NotFoundException("Guard rule not found");
    const { type, action, ...rest } = dto;
    return this.prisma.guardRule.update({
      where: { id },
      data: { ...rest, ...(type && { type: type as any }), ...(action && { action: action as any }) },
    });
  }

  async delete(tenantId: string, id: string) {
    const rule = await this.prisma.guardRule.findUnique({ where: { id }, select: { id: true, tenantId: true } });
    if (!rule || rule.tenantId !== tenantId) throw new NotFoundException("Guard rule not found");
    return this.prisma.guardRule.delete({ where: { id } });
  }
}
```

- [ ] **Step 7: Extend AgentConfigController with knowledge + rules routes**

Replace full controller file:

```typescript
// apps/api/src/modules/agent/agent-config.controller.ts
import { Controller, Get, Patch, Post, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { AgentConfigService } from "./agent-config.service";
import { KnowledgeService } from "./knowledge.service";
import { GuardRulesService } from "./guard-rules.service";
import { UpdateAgentConfigDto } from "./dto/update-agent-config.dto";
import { CreateKnowledgeDto } from "./dto/create-knowledge.dto";
import { CreateGuardRuleDto } from "./dto/create-guard-rule.dto";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("agent")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class AgentConfigController {
  constructor(
    private readonly service: AgentConfigService,
    private readonly knowledge: KnowledgeService,
    private readonly guardRules: GuardRulesService,
  ) {}

  @Get("config")
  @Roles("OWNER", "ADMIN")
  getConfig(@CurrentTenantId() tenantId: string) { return this.service.getConfig(tenantId); }

  @Patch("config")
  @Roles("OWNER", "ADMIN")
  updateConfig(@CurrentTenantId() tenantId: string, @Body() dto: UpdateAgentConfigDto) { return this.service.updateConfig(tenantId, dto); }

  @Get("knowledge")
  @Roles("OWNER", "ADMIN", "AGENT")
  listKnowledge(@CurrentTenantId() tenantId: string) { return this.knowledge.list(tenantId); }

  @Post("knowledge")
  @Roles("OWNER", "ADMIN")
  createKnowledge(@CurrentTenantId() tenantId: string, @Body() dto: CreateKnowledgeDto) { return this.knowledge.create(tenantId, dto); }

  @Delete("knowledge/:id")
  @Roles("OWNER", "ADMIN")
  deleteKnowledge(@CurrentTenantId() tenantId: string, @Param("id") id: string) { return this.knowledge.delete(tenantId, id); }

  @Get("rules")
  @Roles("OWNER", "ADMIN", "AGENT")
  listRules(@CurrentTenantId() tenantId: string) { return this.guardRules.list(tenantId); }

  @Post("rules")
  @Roles("OWNER", "ADMIN")
  createRule(@CurrentTenantId() tenantId: string, @Body() dto: CreateGuardRuleDto) { return this.guardRules.create(tenantId, dto); }

  @Patch("rules/:id")
  @Roles("OWNER", "ADMIN")
  updateRule(@CurrentTenantId() tenantId: string, @Param("id") id: string, @Body() dto: Partial<CreateGuardRuleDto>) { return this.guardRules.update(tenantId, id, dto); }

  @Delete("rules/:id")
  @Roles("OWNER", "ADMIN")
  deleteRule(@CurrentTenantId() tenantId: string, @Param("id") id: string) { return this.guardRules.delete(tenantId, id); }
}
```

Update `AgentModule` providers:
```typescript
providers: [AgentConfigService, KnowledgeService, GuardRulesService],
```

- [ ] **Step 8: Run all agent tests**

```bash
pnpm --filter @whatsagent/api test -- --testPathPattern="knowledge.service|guard-rules.service|agent-config.service"
```
Expected: 8 tests PASS

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/agent/
git commit -m "feat(api): add KnowledgeService and GuardRulesService with full CRUD endpoints"
```

---

### Task 10: Agent chat simulator endpoint

**Files:**
- Create: `apps/api/src/modules/agent/chat-simulator.service.ts`
- Create: `apps/api/src/modules/agent/chat-simulator.service.spec.ts`
- Modify: `apps/api/src/modules/agent/agent-config.controller.ts`
- Modify: `apps/api/src/modules/agent/agent.module.ts`

- [ ] **Step 1: Install openai package**

```bash
pnpm --filter @whatsagent/api add openai
```

- [ ] **Step 2: Write failing test**

```typescript
// apps/api/src/modules/agent/chat-simulator.service.spec.ts
import { Test } from "@nestjs/testing";
import { ChatSimulatorService } from "./chat-simulator.service";
import { AgentConfigService } from "./agent-config.service";
import { ConfigService } from "@nestjs/config";

jest.mock("openai", () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn().mockResolvedValue({
      choices: [{ message: { content: "OlÃ¡! Posso ajudar." } }],
    }) } },
  })),
}));

const mockAgentSvc = { getConfig: jest.fn().mockResolvedValue({ agentName: "Bot", tone: "FRIENDLY", greetingMessage: "OlÃ¡!", llmModel: "gpt-4o-mini", maxResponseLength: 500, systemPromptBase: null }) };
const mockConfigSvc = { get: jest.fn().mockReturnValue("sk-test") };

describe("ChatSimulatorService", () => {
  let service: ChatSimulatorService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ChatSimulatorService, { provide: AgentConfigService, useValue: mockAgentSvc }, { provide: ConfigService, useValue: mockConfigSvc }],
    }).compile();
    service = module.get(ChatSimulatorService);
  });

  it("returns reply and latencyMs", async () => {
    const r = await service.chat("t-1", "Qual o preÃ§o?");
    expect(r.reply).toBe("OlÃ¡! Posso ajudar.");
    expect(typeof r.latencyMs).toBe("number");
  });
});
```

- [ ] **Step 3: Run â€” expect FAIL**

```bash
pnpm --filter @whatsagent/api test -- --testPathPattern=chat-simulator
```

- [ ] **Step 4: Create ChatSimulatorService**

```typescript
// apps/api/src/modules/agent/chat-simulator.service.ts
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { AgentConfigService } from "./agent-config.service";

@Injectable()
export class ChatSimulatorService {
  private openai: OpenAI;
  constructor(private readonly agentConfig: AgentConfigService, private readonly config: ConfigService) {
    this.openai = new OpenAI({ apiKey: this.config.get<string>("OPENAI_API_KEY") });
  }

  async chat(tenantId: string, message: string): Promise<{ reply: string; latencyMs: number }> {
    const cfg = await this.agentConfig.getConfig(tenantId);
    const systemPrompt = cfg.systemPromptBase
      ?? `VocÃª Ã© ${cfg.agentName}, um assistente de vendas com tom ${cfg.tone.toLowerCase()}. ${cfg.greetingMessage}`;
    const start = Date.now();
    const completion = await this.openai.chat.completions.create({
      model: cfg.llmModel,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: message }],
      max_tokens: cfg.maxResponseLength,
    });
    return { reply: completion.choices[0]?.message?.content ?? "(sem resposta)", latencyMs: Date.now() - start };
  }
}
```

- [ ] **Step 5: Add POST /agent/chat to controller**

Add to the existing controller (append after the `deleteRule` handler):
```typescript
// Additional import at top:
import { ChatSimulatorService } from "./chat-simulator.service";

// Add to constructor params:
private readonly chatSimulator: ChatSimulatorService,

// Add handler:
@Post("chat")
@Roles("OWNER", "ADMIN")
chat(@CurrentTenantId() tenantId: string, @Body() body: { message: string }) {
  return this.chatSimulator.chat(tenantId, body.message);
}
```

Update `AgentModule`:
```typescript
import { ChatSimulatorService } from "./chat-simulator.service";
// add to providers: ChatSimulatorService
// add ConfigModule to imports if not already available via forRoot global
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @whatsagent/api test -- --testPathPattern=chat-simulator
pnpm --filter @whatsagent/api build
```
Expected: 1 test PASS, build succeeds

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/agent/
git commit -m "feat(api): add POST /agent/chat test simulator using OpenAI"
```

---

## Phase 4: Dashboard Frontend Wiring

### Task 11: Overview + Analytics pages

**Files:**
- Modify: `apps/web/src/app/(dashboard)/overview/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/analytics/page.tsx`

Both pages call `GET /analytics/kpis` and `GET /analytics/conversations-chart`. Pattern to apply to both:

- [ ] **Step 1: Wire Overview page**

Add to `overview/page.tsx` inside the component:
```tsx
"use client";
// Add to existing imports:
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

// Inside component:
const { getToken } = useAuth();
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
const [kpis, setKpis] = useState<Record<string, number>>({});
const [chartData, setChartData] = useState<any[]>([]);

useEffect(() => {
  async function load() {
    const token = await getToken();
    const h = { Authorization: `Bearer ${token}` };
    const [k, c] = await Promise.all([
      fetch(`${API_URL}/analytics/kpis`, { headers: h }),
      fetch(`${API_URL}/analytics/conversations-chart?days=7`, { headers: h }),
    ]);
    if (k.ok) setKpis(await k.json());
    if (c.ok) setChartData(await c.json());
  }
  load();
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

Replace all hardcoded `"0"` stat values:
- `conversations_today` â†’ `kpis.conversations_today ?? 0`
- `pending_handoffs` â†’ `kpis.pending_handoffs ?? 0`
- `revenue_today` / 100 (cents to BRL) â†’ `((kpis.revenue_today ?? 0) / 100).toFixed(2)`
- `new_contacts_today` â†’ `kpis.new_contacts_today ?? 0`
- Chart `data={[]}` â†’ `data={chartData}`

- [ ] **Step 2: Wire Analytics page with period selector**

Add to `analytics/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

const { getToken } = useAuth();
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
const [period, setPeriod] = useState<7 | 30 | 90>(30);
const [kpis, setKpis] = useState<Record<string, number>>({});
const [chartData, setChartData] = useState<any[]>([]);

useEffect(() => {
  async function load() {
    const token = await getToken();
    const h = { Authorization: `Bearer ${token}` };
    const [k, c] = await Promise.all([
      fetch(`${API_URL}/analytics/kpis`, { headers: h }),
      fetch(`${API_URL}/analytics/conversations-chart?days=${period}`, { headers: h }),
    ]);
    if (k.ok) setKpis(await k.json());
    if (c.ok) setChartData(await c.json());
  }
  load();
}, [period]); // eslint-disable-line react-hooks/exhaustive-deps
```

Wire the period buttons (Hoje/7 dias/30 dias) to call `setPeriod(7)`, `setPeriod(30)`, `setPeriod(90)`. Replace static KPI values with `kpis.*` fields. Replace chart `data` with `chartData`.

- [ ] **Step 3: Verify in browser**

```bash
pnpm --filter @whatsagent/web dev & pnpm --filter @whatsagent/api dev
```
Open `http://localhost:3000/overview` â€” Network tab should show `/analytics/kpis` returning 200. Values are real (0s if empty DB, not hardcoded strings). Open `/analytics`, switch period buttons â€” chart re-fetches.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/overview/page.tsx apps/web/src/app/(dashboard)/analytics/page.tsx
git commit -m "feat(web): wire Overview and Analytics pages to real analytics API"
```

---

### Task 12: Orders page + Inbox initial load

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx`
- Modify: `apps/web/src/lib/store/inbox.store.ts`
- Modify: `apps/web/src/app/(dashboard)/inbox/page.tsx`

- [ ] **Step 1: Wire Orders page**

Add to `orders/page.tsx` inside the component:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

const { getToken } = useAuth();
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
const [orders, setOrders] = useState<any[]>([]);
const [page, setPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function load() {
    setLoading(true);
    const token = await getToken();
    const res = await fetch(`${API_URL}/orders?page=${page}&limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setOrders(data.items);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  }
  load();
}, [page]); // eslint-disable-line react-hooks/exhaustive-deps
```

Replace `isEmpty = true` with `isEmpty = orders.length === 0 && !loading`. Replace static order list with `orders.map(o => ...)`. Wire pagination buttons to `setPage`.

- [ ] **Step 2: Add hydration actions to inbox store**

In `apps/web/src/lib/store/inbox.store.ts`, add to the interface and implementation:

```typescript
// Interface additions:
hydrateConversations: (conversations: Conversation[]) => void;
hydrateMessages: (conversationId: string, messages: Message[]) => void;

// Implementation:
hydrateConversations: (conversations) => set({ conversations }),
hydrateMessages: (conversationId, messages) =>
  set((s) => ({ messages: { ...s.messages, [conversationId]: messages } })),
```

- [ ] **Step 3: Wire Inbox initial load**

In `apps/web/src/app/(dashboard)/inbox/page.tsx`, add:
```tsx
import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

const { getToken } = useAuth();
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
const { hydrateConversations, hydrateMessages, activeConversationId } = useInboxStore();

// Load conversation list on mount
useEffect(() => {
  async function load() {
    const token = await getToken();
    const res = await fetch(`${API_URL}/conversations?limit=30`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const convs = await res.json();
    hydrateConversations(convs.map((c: any) => ({
      id: c.id,
      contact: { name: c.contact?.name, phone: c.contact?.phone },
      status: c.status,
      lastMessage: c.messages?.[0]?.text,
      lastMessageAt: c.messages?.[0]?.sentAt,
      unreadCount: 0,
      isHandoff: c.status === "HUMAN_HANDOFF",
    })));
  }
  load();
}, []); // eslint-disable-line react-hooks/exhaustive-deps

// Load messages when active conversation changes
useEffect(() => {
  if (!activeConversationId) return;
  async function loadMessages() {
    const token = await getToken();
    const res = await fetch(`${API_URL}/conversations/${activeConversationId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const msgs = await res.json();
    hydrateMessages(activeConversationId, msgs.map((m: any) => ({
      id: m.id, conversationId: activeConversationId,
      direction: m.direction.toLowerCase(), type: m.type.toLowerCase(),
      text: m.text, sentAt: m.sentAt, isFromAi: m.isFromAi,
    })));
  }
  loadMessages();
}, [activeConversationId]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/orders/page.tsx apps/web/src/lib/store/inbox.store.ts apps/web/src/app/(dashboard)/inbox/page.tsx
git commit -m "feat(web): wire Orders page and Inbox initial load to real API"
```

---

### Task 13: Settings page + Agent page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/agent/page.tsx`
- Create: `apps/web/src/app/(dashboard)/agent/persona/page.tsx`
- Create: `apps/web/src/app/(dashboard)/agent/knowledge/page.tsx`
- Create: `apps/web/src/app/(dashboard)/agent/rules/page.tsx`

- [ ] **Step 1: Wire Settings company section**

In `settings/page.tsx`, replace the static save and add prefill:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

const { getToken } = useAuth();
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
const [companyForm, setCompanyForm] = useState({ name: "", timezone: "America/Sao_Paulo" });
const [saving, setSaving] = useState(false);

useEffect(() => {
  async function load() {
    const token = await getToken();
    const res = await fetch(`${API_URL}/settings/company`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setCompanyForm({ name: d.name ?? "", timezone: d.timezone ?? "America/Sao_Paulo" }); }
  }
  load();
}, []); // eslint-disable-line react-hooks/exhaustive-deps

async function handleSave() {
  setSaving(true);
  const token = await getToken();
  await fetch(`${API_URL}/settings/company`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(companyForm),
  });
  setSaving(false);
}
```

Wire name input and timezone selector to `companyForm` state (replace hardcoded `defaultValue` with controlled `value` + `onChange`).

- [ ] **Step 2: Wire Agent overview page**

In `agent/page.tsx`, add:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

const { getToken } = useAuth();
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
const [config, setConfig] = useState<any>(null);
const [simMsg, setSimMsg] = useState("");
const [simReply, setSimReply] = useState<string | null>(null);
const [simLoading, setSimLoading] = useState(false);

useEffect(() => {
  async function load() {
    const token = await getToken();
    const res = await fetch(`${API_URL}/agent/config`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setConfig(await res.json());
  }
  load();
}, []); // eslint-disable-line react-hooks/exhaustive-deps

async function handleSimSend() {
  if (!simMsg.trim()) return;
  setSimLoading(true);
  setSimReply(null);
  const token = await getToken();
  const res = await fetch(`${API_URL}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: simMsg }),
  });
  if (res.ok) { const d = await res.json(); setSimReply(d.reply); }
  setSimLoading(false);
}
```

Replace static config stats with `config?.agentName`, `config?.llmModel`. Replace the TestSimulator's submit handler with `handleSimSend`. Show `simLoading` spinner and `simReply` in the simulator panel.

- [ ] **Step 3: Create persona sub-page**

```tsx
// apps/web/src/app/(dashboard)/agent/persona/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const TONES = ["FORMAL","INFORMAL","FRIENDLY","TECHNICAL","REGIONAL"];
const MODELS = ["gpt-4o-mini","gpt-4o","gpt-4-turbo"];
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export default function PersonaPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ agentName:"Assistente", tone:"FRIENDLY", greetingMessage:"OlÃ¡! Como posso ajudar?", inactivityMessage:"Ainda estÃ¡ por aqui?", closingMessage:"AtÃ© logo!", llmModel:"gpt-4o-mini", llmTemperature:0.3, maxResponseLength:500, systemPromptBase:"", isPublished:false });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const token = await getToken();
      const res = await fetch(`${API_URL}/agent/config`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setForm(await res.json());
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setSaving(true);
    const token = await getToken();
    await fetch(`${API_URL}/agent/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">â† Voltar</button>
        <h1 className="text-xl font-semibold text-white">Persona do Agente</h1>
      </div>
      <div className="space-y-4">
        {[
          { label: "Nome do agente", key: "agentName" },
          { label: "Mensagem de boas-vindas", key: "greetingMessage" },
          { label: "Mensagem de inatividade", key: "inactivityMessage" },
          { label: "Mensagem de encerramento", key: "closingMessage" },
        ].map(({ label, key }) => (
          <label key={key} className="block">
            <span className="text-sm text-slate-400">{label}</span>
            <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm" />
          </label>
        ))}
        <label className="block">
          <span className="text-sm text-slate-400">Tom de voz</span>
          <select value={form.tone} onChange={e => setForm(f => ({ ...f, tone: e.target.value }))}
            className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm">
            {TONES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-slate-400">Modelo LLM</span>
          <select value={form.llmModel} onChange={e => setForm(f => ({ ...f, llmModel: e.target.value }))}
            className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm">
            {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-slate-400">Prompt de sistema (opcional)</span>
          <textarea value={form.systemPromptBase ?? ""} onChange={e => setForm(f => ({ ...f, systemPromptBase: e.target.value }))}
            rows={4} placeholder="Deixe em branco para usar o prompt gerado automaticamente."
            className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm font-mono" />
        </label>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="pub" checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} className="w-4 h-4" />
          <label htmlFor="pub" className="text-sm text-slate-300">Publicar agente (ativo para atendimento)</label>
        </div>
      </div>
      <button onClick={handleSave} disabled={saving}
        className="w-full py-2 rounded-lg bg-green-500 hover:bg-green-600 text-black font-semibold text-sm disabled:opacity-50">
        {saving ? "Salvando..." : saved ? "Salvo âœ“" : "Salvar persona"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create knowledge sub-page**

```tsx
// apps/web/src/app/(dashboard)/agent/knowledge/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
interface KB { id: string; name: string; type: string; isIndexed: boolean; chunkCount?: number; }

export default function KnowledgePage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<KB[]>([]);
  const [form, setForm] = useState({ name: "", type: "TEXT", content: "" });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const token = await getToken();
    const res = await fetch(`${API_URL}/agent/knowledge`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setItems(await res.json());
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    setSaving(true);
    const token = await getToken();
    const res = await fetch(`${API_URL}/agent/knowledge`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    if (res.ok) { setForm({ name: "", type: "TEXT", content: "" }); setAdding(false); await load(); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const token = await getToken();
    await fetch(`${API_URL}/agent/knowledge/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    await load();
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">â† Voltar</button>
          <h1 className="text-xl font-semibold text-white">Base de Conhecimento</h1>
        </div>
        <button onClick={() => setAdding(a => !a)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">+ Adicionar</button>
      </div>
      {adding && (
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-4 space-y-3">
          <input placeholder="Nome (ex: FAQ, CardÃ¡pio)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm" />
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm">
            <option value="TEXT">Texto livre</option>
            <option value="URL">URL</option>
          </select>
          <textarea placeholder="Cole o conteÃºdo aqui..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            rows={5} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm font-mono" />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !form.name || !form.content}
              className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-black text-sm font-semibold disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm">Cancelar</button>
          </div>
        </div>
      )}
      {items.length === 0 && !adding && <p className="text-slate-500 text-sm text-center py-12">Nenhuma base de conhecimento.</p>}
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-900 border border-slate-700 px-4 py-3">
            <div>
              <p className="text-white text-sm font-medium">{item.name}</p>
              <p className="text-slate-500 text-xs">{item.type} Â· {item.isIndexed ? `${item.chunkCount ?? 0} chunks` : "aguardando indexaÃ§Ã£o"}</p>
            </div>
            <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create rules sub-page**

```tsx
// apps/web/src/app/(dashboard)/agent/rules/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
const TYPES = ["TEXT_BLOCK","SEMANTIC_BLOCK","NUMERIC_CAP","PRODUCT_RESTRICT","HANDOFF_TRIGGER","REGEX_MATCH"];
const ACTIONS = ["BLOCK","REWRITE","HANDOFF","LOG_ONLY"];
interface Rule { id: string; name: string; type: string; action: string; isActive: boolean; priority: number; }

export default function RulesPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name:"", type:"TEXT_BLOCK", action:"BLOCK", config:"{}", fallbackMessage:"", priority:100 });
  const [saving, setSaving] = useState(false);
  const [cfgErr, setCfgErr] = useState<string|null>(null);

  async function load() {
    const token = await getToken();
    const res = await fetch(`${API_URL}/agent/rules`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setRules(await res.json());
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    setCfgErr(null);
    let config: any;
    try { config = JSON.parse(form.config); } catch { setCfgErr("Config deve ser JSON vÃ¡lido"); return; }
    setSaving(true);
    const token = await getToken();
    const res = await fetch(`${API_URL}/agent/rules`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, config }),
    });
    if (res.ok) { setAdding(false); setForm({ name:"", type:"TEXT_BLOCK", action:"BLOCK", config:"{}", fallbackMessage:"", priority:100 }); await load(); }
    setSaving(false);
  }

  async function handleToggle(rule: Rule) {
    const token = await getToken();
    await fetch(`${API_URL}/agent/rules/${rule.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    const token = await getToken();
    await fetch(`${API_URL}/agent/rules/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    await load();
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">â† Voltar</button>
          <h1 className="text-xl font-semibold text-white">Guard Rules</h1>
        </div>
        <button onClick={() => setAdding(a => !a)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">+ Nova regra</button>
      </div>
      {adding && (
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-4 space-y-3">
          <input placeholder="Nome da regra" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm">
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm">
              {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <input type="number" placeholder="Prioridade" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: +e.target.value || 100 }))}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm" />
          <div>
            <textarea placeholder='Config JSON (ex: {"terms":["desconto"]})' value={form.config} onChange={e => setForm(f => ({ ...f, config: e.target.value }))}
              rows={3} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm font-mono" />
            {cfgErr && <p className="text-red-400 text-xs mt-1">{cfgErr}</p>}
          </div>
          <input placeholder="Mensagem de fallback (opcional)" value={form.fallbackMessage} onChange={e => setForm(f => ({ ...f, fallbackMessage: e.target.value }))}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm" />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !form.name}
              className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-black text-sm font-semibold disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm">Cancelar</button>
          </div>
        </div>
      )}
      {rules.length === 0 && !adding && <p className="text-slate-500 text-sm text-center py-12">Nenhuma guard rule configurada.</p>}
      <div className="space-y-2">
        {rules.map(rule => (
          <div key={rule.id} className="flex items-center justify-between rounded-xl bg-slate-900 border border-slate-700 px-4 py-3">
            <div>
              <p className="text-white text-sm font-medium">{rule.name}</p>
              <p className="text-slate-500 text-xs">{rule.type} Â· {rule.action} Â· prioridade {rule.priority}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => handleToggle(rule)}
                className={`text-xs px-2 py-1 rounded ${rule.isActive ? "bg-green-900/50 text-green-400" : "bg-slate-700 text-slate-400"}`}>
                {rule.isActive ? "Ativa" : "Inativa"}
              </button>
              <button onClick={() => handleDelete(rule.id)} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify all pages in browser**

1. `/settings` â€” shows real tenant name, saving persists to DB
2. `/agent` â€” shows real config, test simulator returns AI response (requires `OPENAI_API_KEY` in `.env.local`)
3. `/agent/persona` â€” form pre-fills from DB, saving updates config
4. `/agent/knowledge` â€” can add entries (TEXT/URL) and delete them
5. `/agent/rules` â€” can create, toggle active/inactive, and delete rules

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/(dashboard)/settings/page.tsx apps/web/src/app/(dashboard)/agent/
git commit -m "feat(web): wire Settings company section + Agent page + persona/knowledge/rules sub-pages"
```

---

## Verification

### Full end-to-end smoke test

```bash
# 1. Infrastructure
pnpm docker:up

# 2. All services
pnpm dev

# 3. Run all tests
pnpm test
cd apps/ai-orchestrator && .venv/Scripts/pytest tests/ -v

# 4. E2E smoke (with orchestrator running)
python scripts/e2e-smoke.py
```

**Checklist:**
- [ ] All Jest tests pass: `pnpm test`
- [ ] All pytest tests pass: `pytest tests/ -v`
- [ ] `/setup/company` form saves to DB (verify via Prisma Studio)
- [ ] `/setup/plan` â†’ Stripe checkout redirect still works
- [ ] `e2e-smoke.py` prints `âœ… Response received!`
- [ ] `/overview` â€” KPI cards show real numbers (0 if empty DB, no hardcoded strings)
- [ ] `/analytics` â€” period buttons re-fetch chart data
- [ ] `/orders` â€” empty state or real orders, pagination buttons present
- [ ] `/inbox` â€” conversation list loads from DB on page mount
- [ ] `/settings` â€” shows real tenant name, save button persists changes
- [ ] `/agent` â€” test simulator returns AI response
- [ ] `/agent/persona` â€” pre-fills from DB, changes persist
- [ ] `/agent/knowledge` â€” add/delete entries work
- [ ] `/agent/rules` â€” add/toggle/delete rules work

