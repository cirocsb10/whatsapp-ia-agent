# Plano 22 — AI Lead Scoring: Classificação automática de leads com critérios ponderados

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Após cada troca de mensagens com o chatbot, a IA avalia a conversa e atribui um score 0-100 ao lead com base em critérios configuráveis por agente. O score classifica o lead em uma de 3 temperaturas — **Lead Frio**, **Lead Morno** ou **Qualificado** — exibidas visualmente no kanban CRM. Somente **Qualificado** avança automaticamente para a stage "Qualificado" do funil.

**Mapeamento de temperatura:**

| Score | Temperatura | Comportamento CRM |
|-------|-------------|-------------------|
| 0–33 | Lead Frio 🔵 | Deal permanece na stage atual; badge azul no card |
| 34–66 | Lead Morno 🟡 | Deal permanece na stage atual; badge amarelo no card |
| 67–100 | Qualificado 🟢 | Deal avança para "Qualificado" (position 2); badge verde |

> Thresholds configuráveis por agente. Critérios e pesos também configuráveis. Scoring só acontece após `triggerAfterMessages` trocas (padrão: 3).

**Critérios padrão (customizáveis):**

| Critério | Peso padrão | O que avalia |
|----------|-------------|--------------|
| Intenção de Compra | 25% | Quão claramente o prospect quer comprar |
| Urgência | 20% | Com que urgência precisa do produto |
| Orçamento | 20% | Capacidade financeira demonstrada |
| Autoridade | 20% | Poder de decisão sobre a compra |
| Engajamento | 15% | Qualidade da interação na conversa |

**Score calculation:** `score = Σ(score_critério × peso) / Σ(pesos) × 10` onde cada critério retorna 0-10.

**Architecture:**
- **Prisma**: `AgentConfig.leadScoringConfig Json?` + `Deal.leadScore Int?` + `Deal.leadScoreDetails Json?` + `Deal.leadTemperature LeadTemperature?` (enum)
- **ai-orchestrator** `lead_scorer.py`: chamada LLM estruturada com `.with_structured_output()` retornando scores por critério
- **ai-orchestrator** `rabbitmq.py`: dispara scoring após `triggerAfterMessages` exchanges; publica evento `crm.score`
- **api** `LeadScoringService`: consome `crm.score`, salva score no Deal, chama `CrmProgressionService.advanceToPosition(2)` se Qualificado
- **api** `lead-scoring.controller.ts`: CRUD `GET/PUT /agent/lead-scoring` para configurar critérios
- **web** `/agent/lead-scoring/page.tsx`: página de configuração com editor de critérios e sliders de threshold
- **web** `DealCard.tsx`: exibe badge de temperatura no card do kanban

**Tech Stack:** NestJS, Prisma, Python (aio_pika, pydantic, langchain), TypeScript, React, Jest, pytest

---

## File Map

| Ação | Arquivo |
|------|---------|
| **Modify** | `packages/database/prisma/schema.prisma` |
| **Create** | `packages/database/prisma/migrations/YYYYMMDD_add_lead_scoring/` |
| **Create** | `apps/ai-orchestrator/src/services/lead_scorer.py` |
| **Create** | `apps/ai-orchestrator/tests/test_lead_scorer.py` |
| **Modify** | `apps/ai-orchestrator/src/consumers/rabbitmq.py` |
| **Create** | `apps/api/src/modules/crm/lead-scoring.service.ts` |
| **Create** | `apps/api/src/modules/crm/lead-scoring.service.spec.ts` |
| **Create** | `apps/api/src/modules/crm/lead-scoring.controller.ts` |
| **Create** | `apps/api/src/modules/crm/dto/lead-scoring.dto.ts` |
| **Modify** | `apps/api/src/modules/crm/crm.module.ts` |
| **Modify** | `apps/api/src/queue/inbox-events.consumer.ts` |
| **Modify** | `apps/web/src/app/(dashboard)/agent/page.tsx` |
| **Create** | `apps/web/src/app/(dashboard)/agent/lead-scoring/page.tsx` |
| **Modify** | `apps/web/src/components/crm/DealCard.tsx` |
| **Modify** | `apps/web/src/types/crm.ts` |

---

## Task 1: Prisma Schema — adicionar LeadTemperature e campos ao Deal e AgentConfig

**Context:** Precisamos de um enum `LeadTemperature` e 3 novos campos no `Deal`. O `AgentConfig` recebe `leadScoringConfig Json?` para armazenar critérios e thresholds por agente.

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Adicionar o enum LeadTemperature (após os outros enums)**

```prisma
enum LeadTemperature {
  COLD
  WARM
  QUALIFIED
}
```

- [ ] **Step 2: Adicionar campos ao model Deal**

Após o campo `closedAt DateTime?`, adicionar:

```prisma
leadScore         Int?             // 0-100 pontuação do score de qualificação
leadTemperature   LeadTemperature? // COLD | WARM | QUALIFIED
leadScoreDetails  Json?            // {scores:[{criterion,score,reasoning}], scoredAt}
```

- [ ] **Step 3: Adicionar campo ao model AgentConfig**

Após o campo `systemPromptBase String?`, adicionar:

```prisma
leadScoringConfig Json?  // {isEnabled,triggerAfterMessages,coldMaxScore,warmMaxScore,criteria:[{id,name,description,weight}]}
```

- [ ] **Step 4: Gerar e rodar a migração**

```bash
pnpm --filter @whatsagent/database migrate:dev -- --name add_lead_scoring
```

Expected: migração criada e aplicada sem erros.

- [ ] **Step 5: Verificar que o Prisma client gerou os novos tipos**

```bash
pnpm --filter @whatsagent/database generate
```

Expected: `LeadTemperature` disponível no client exportado.

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/
git commit -m "feat(db): add LeadTemperature enum and lead scoring fields to Deal and AgentConfig"
```

---

## Task 2: API — DTOs e endpoint CRUD de configuração de scoring

**Context:** O `AgentConfig` já existe. Precisamos de endpoints para ler e salvar a config de scoring, seguindo o mesmo padrão dos outros endpoints do agente (`/agent/persona`, `/agent/rules`, etc.).

**Files:**
- Create: `apps/api/src/modules/crm/dto/lead-scoring.dto.ts`
- Create: `apps/api/src/modules/crm/lead-scoring.controller.ts`

- [ ] **Step 1: Criar os DTOs**

Criar `apps/api/src/modules/crm/dto/lead-scoring.dto.ts`:

```typescript
import { IsArray, IsBoolean, IsInt, IsString, Max, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class LeadScoringCriterionDto {
  @IsString() id: string;
  @IsString() name: string;
  @IsString() description: string;
  @IsInt() @Min(1) @Max(100) weight: number;
}

export class SaveLeadScoringConfigDto {
  @IsBoolean() isEnabled: boolean;
  @IsInt() @Min(1) @Max(20) triggerAfterMessages: number;
  @IsInt() @Min(1) @Max(99) coldMaxScore: number;
  @IsInt() @Min(2) @Max(99) warmMaxScore: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LeadScoringCriterionDto)
  criteria: LeadScoringCriterionDto[];
}
```

- [ ] **Step 2: Criar o controller**

Criar `apps/api/src/modules/crm/lead-scoring.controller.ts`:

```typescript
import { Body, Controller, Get, HttpCode, Put, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../../auth/clerk-auth.guard";
import { CurrentTenant } from "../../auth/current-tenant.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { SaveLeadScoringConfigDto } from "./dto/lead-scoring.dto";

const DEFAULT_CONFIG = {
  isEnabled: false,
  triggerAfterMessages: 3,
  coldMaxScore: 33,
  warmMaxScore: 66,
  criteria: [
    { id: "purchase_intent", name: "Intenção de Compra",  description: "Quão claramente o prospect expressou interesse em comprar?",    weight: 25 },
    { id: "urgency",         name: "Urgência",            description: "Com que urgência o prospect precisa do produto/serviço?",        weight: 20 },
    { id: "budget",          name: "Orçamento",           description: "O prospect demonstrou capacidade financeira para a compra?",     weight: 20 },
    { id: "authority",       name: "Autoridade",          description: "O prospect tem poder de decisão sobre a compra?",               weight: 20 },
    { id: "engagement",      name: "Engajamento",         description: "Qual o nível de engajamento do prospect na conversa?",          weight: 15 },
  ],
};

@Controller("agent/lead-scoring")
@UseGuards(ClerkAuthGuard)
export class LeadScoringController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getConfig(@CurrentTenant() tenantId: string) {
    const config = await this.prisma.agentConfig.findFirst({
      where: { tenantId },
      select: { leadScoringConfig: true },
    });
    return (config?.leadScoringConfig as object) ?? DEFAULT_CONFIG;
  }

  @Put()
  @HttpCode(200)
  async saveConfig(
    @CurrentTenant() tenantId: string,
    @Body() dto: SaveLeadScoringConfigDto,
  ) {
    await this.prisma.agentConfig.update({
      where: { tenantId },
      data: { leadScoringConfig: dto as unknown as import("@prisma/client").Prisma.InputJsonValue },
    });
    return dto;
  }
}
```

- [ ] **Step 3: Registrar no CrmModule**

Em `apps/api/src/modules/crm/crm.module.ts`, adicionar:

```typescript
import { LeadScoringController } from "./lead-scoring.controller";

controllers: [CrmController, LeadScoringController],
```

- [ ] **Step 4: Build**

```bash
pnpm --filter @whatsagent/api build
```

Expected: zero erros.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/crm/dto/lead-scoring.dto.ts apps/api/src/modules/crm/lead-scoring.controller.ts apps/api/src/modules/crm/crm.module.ts
git commit -m "feat(api): add lead scoring config CRUD endpoint GET/PUT /agent/lead-scoring"
```

---

## Task 3: AI Orchestrator — LeadScorerService

**Context:** Serviço Python que busca a config de scoring do DB, monta o prompt com os critérios do agente, chama a LLM com `.with_structured_output()` para obter scores estruturados por critério, e calcula o score total ponderado.

**Files:**
- Create: `apps/ai-orchestrator/src/services/lead_scorer.py`
- Create: `apps/ai-orchestrator/tests/test_lead_scorer.py`

- [ ] **Step 1: Escrever o teste que vai falhar**

Criar `apps/ai-orchestrator/tests/test_lead_scorer.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from src.services.lead_scorer import LeadScorerService, LeadScoringResult, CriterionScore

MOCK_CONFIG = {
    "isEnabled": True,
    "triggerAfterMessages": 3,
    "coldMaxScore": 33,
    "warmMaxScore": 66,
    "criteria": [
        {"id": "purchase_intent", "name": "Intenção de Compra", "description": "...", "weight": 60},
        {"id": "urgency",         "name": "Urgência",           "description": "...", "weight": 40},
    ],
}

MOCK_MESSAGES = [
    {"role": "user",      "content": "Quero comprar agora, tenho orçamento"},
    {"role": "assistant", "content": "Ótimo! Temos o produto X disponível"},
]


@pytest.mark.asyncio
async def test_score_returns_qualified_for_high_scores():
    service = LeadScorerService()
    mock_result = LeadScoringResult(
        scores=[
            CriterionScore(criterion_id="purchase_intent", score=9, reasoning="Expressou intenção clara"),
            CriterionScore(criterion_id="urgency",         score=8, reasoning="Urgência demonstrada"),
        ]
    )

    with patch.object(service, "_call_llm", return_value=mock_result):
        result = await service.score(MOCK_CONFIG, MOCK_MESSAGES, "tenant-1")

    # score = (9×60 + 8×40) / (60+40) × 10 = (540+320)/100×10 = 86
    assert result["total_score"] == 86
    assert result["temperature"] == "QUALIFIED"


@pytest.mark.asyncio
async def test_score_returns_cold_for_low_scores():
    service = LeadScorerService()
    mock_result = LeadScoringResult(
        scores=[
            CriterionScore(criterion_id="purchase_intent", score=2, reasoning="Pouco interesse"),
            CriterionScore(criterion_id="urgency",         score=1, reasoning="Sem urgência"),
        ]
    )

    with patch.object(service, "_call_llm", return_value=mock_result):
        result = await service.score(MOCK_CONFIG, MOCK_MESSAGES, "tenant-1")

    # score = (2×60 + 1×40) / 100 × 10 = (120+40)/100×10 = 16
    assert result["total_score"] == 16
    assert result["temperature"] == "COLD"


@pytest.mark.asyncio
async def test_score_returns_warm_for_medium_scores():
    service = LeadScorerService()
    mock_result = LeadScoringResult(
        scores=[
            CriterionScore(criterion_id="purchase_intent", score=5, reasoning="Interesse moderado"),
            CriterionScore(criterion_id="urgency",         score=5, reasoning="Urgência média"),
        ]
    )

    with patch.object(service, "_call_llm", return_value=mock_result):
        result = await service.score(MOCK_CONFIG, MOCK_MESSAGES, "tenant-1")

    # score = 5×10 = 50
    assert result["total_score"] == 50
    assert result["temperature"] == "WARM"


def test_temperature_from_score_boundaries():
    service = LeadScorerService()
    assert service._temperature_from_score(0,  33, 66) == "COLD"
    assert service._temperature_from_score(33, 33, 66) == "COLD"
    assert service._temperature_from_score(34, 33, 66) == "WARM"
    assert service._temperature_from_score(66, 33, 66) == "WARM"
    assert service._temperature_from_score(67, 33, 66) == "QUALIFIED"
    assert service._temperature_from_score(100, 33, 66) == "QUALIFIED"
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
cd apps/ai-orchestrator && pytest tests/test_lead_scorer.py -v
```

Expected: FAIL — "ModuleNotFoundError: No module named 'src.services.lead_scorer'"

- [ ] **Step 3: Implementar o serviço**

Criar `apps/ai-orchestrator/src/services/lead_scorer.py`:

```python
from typing import Any
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from src.services.llm import get_llm
from src.config import settings
import structlog

log = structlog.get_logger(__name__)


class CriterionScore(BaseModel):
    criterion_id: str
    score: int          # 0-10
    reasoning: str


class LeadScoringResult(BaseModel):
    scores: list[CriterionScore]


class LeadScorerService:

    async def score(
        self,
        config: dict,
        messages: list[dict],
        tenant_id: str,
    ) -> dict[str, Any]:
        """Score the conversation and return total_score (0-100), temperature, and details."""
        criteria = config.get("criteria", [])
        cold_max = config.get("coldMaxScore", 33)
        warm_max = config.get("warmMaxScore", 66)

        if not criteria:
            return {"total_score": 0, "temperature": "COLD", "scores": []}

        result = await self._call_llm(criteria, messages)

        total_weight = sum(c["weight"] for c in criteria)
        if total_weight == 0:
            return {"total_score": 0, "temperature": "COLD", "scores": []}

        weight_map = {c["id"]: c["weight"] for c in criteria}
        weighted_sum = sum(
            s.score * weight_map.get(s.criterion_id, 0)
            for s in result.scores
        )
        total_score = round(weighted_sum / total_weight * 10)
        total_score = max(0, min(100, total_score))

        temperature = self._temperature_from_score(total_score, cold_max, warm_max)

        return {
            "total_score": total_score,
            "temperature": temperature,
            "scores": [
                {"criterion_id": s.criterion_id, "score": s.score, "reasoning": s.reasoning}
                for s in result.scores
            ],
        }

    def _temperature_from_score(self, score: int, cold_max: int, warm_max: int) -> str:
        if score <= cold_max:
            return "COLD"
        if score <= warm_max:
            return "WARM"
        return "QUALIFIED"

    async def _call_llm(self, criteria: list[dict], messages: list[dict]) -> LeadScoringResult:
        criteria_text = "\n".join(
            f"- {c['name']} (id: {c['id']}): {c['description']}"
            for c in criteria
        )
        conversation_text = "\n".join(
            f"{m['role'].upper()}: {m['content']}"
            for m in messages[-10:]  # últimas 10 mensagens
        )

        prompt = f"""You are a sales lead qualification expert. Analyze this WhatsApp conversation and score each criterion from 0 (none/absent) to 10 (very strong/clear).

CRITERIA TO EVALUATE:
{criteria_text}

CONVERSATION:
{conversation_text}

Return a JSON object with a "scores" array. Each item must have:
- criterion_id: exact id from the criteria list above
- score: integer 0-10
- reasoning: one sentence explaining the score

Be objective. Base scores ONLY on what is explicitly present in the conversation."""

        llm = get_llm(settings.openai_model_simple, temperature=0.1, max_tokens=500)
        structured_llm = llm.with_structured_output(LeadScoringResult)
        return await structured_llm.ainvoke([HumanMessage(content=prompt)])
```

- [ ] **Step 4: Rodar testes**

```bash
cd apps/ai-orchestrator && pytest tests/test_lead_scorer.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/ai-orchestrator/src/services/lead_scorer.py apps/ai-orchestrator/tests/test_lead_scorer.py
git commit -m "feat(ai): add LeadScorerService with weighted LLM-based scoring and temperature classification"
```

---

## Task 4: AI Orchestrator — Disparar scoring e publicar evento crm.score

**Context:** Em `rabbitmq.py`, após processar a resposta da IA, verificar se o scoring deve ser disparado (lead scoring habilitado + mensagens suficientes). Se sim, chamar `LeadScorerService.score()` e publicar evento `crm.score` no RabbitMQ.

**Files:**
- Modify: `apps/ai-orchestrator/src/consumers/rabbitmq.py`

- [ ] **Step 1: Buscar a config de scoring do AgentConfig**

Adicionar no `PromptBuilderService` (`apps/ai-orchestrator/src/services/prompt_builder.py`) um novo método para buscar a config de scoring (seguindo o mesmo padrão de `get_agent_config`):

```python
async def get_lead_scoring_config(self, tenant_id: str) -> dict | None:
    async with get_async_session() as session:
        result = await session.execute(
            text('SELECT "leadScoringConfig" FROM "AgentConfig" WHERE "tenantId" = :tid'),
            {"tid": tenant_id},
        )
        row = result.fetchone()
    if not row or not row[0]:
        return None
    config = row[0] if isinstance(row[0], dict) else {}
    return config if config.get("isEnabled") else None
```

- [ ] **Step 2: Adicionar publicação do evento crm.score ao RabbitMQPublisher**

Em `apps/ai-orchestrator/src/publishers/rabbitmq.py`, adicionar método:

```python
async def publish_crm_score(self, payload: dict) -> None:
    """Publish lead score to crm exchange for CRM progression."""
    message = aio_pika.Message(
        body=json.dumps(payload).encode(),
        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
    )
    crm_exchange = await self.channel.declare_exchange(
        "crm", aio_pika.ExchangeType.TOPIC, durable=True
    )
    await crm_exchange.publish(message, routing_key="crm.score")
```

- [ ] **Step 3: Disparar scoring em rabbitmq.py após a resposta da IA**

Em `rabbitmq.py`, após `await publisher.publish_response(response_event)`, adicionar:

```python
# Lead Scoring — dispara após publicar a resposta
try:
    from src.services.lead_scorer import LeadScorerService
    pb_scoring = PromptBuilderService()
    scoring_config = await pb_scoring.get_lead_scoring_config(tenant_id)

    if scoring_config:
        trigger_after = scoring_config.get("triggerAfterMessages", 3)
        message_count = len(final_state.get("messages", []))

        if message_count >= trigger_after:
            scorer = LeadScorerService()
            messages_for_scoring = [
                {"role": m["role"] if isinstance(m, dict) else m.role,
                 "content": m["content"] if isinstance(m, dict) else m.content}
                for m in final_state.get("messages", [])
            ]
            score_result = await scorer.score(scoring_config, messages_for_scoring, tenant_id)

            await publisher.publish_crm_score({
                "tenantId": tenant_id,
                "contactId": event.contact_id,
                "conversationId": session.conversation_id,
                "totalScore": score_result["total_score"],
                "temperature": score_result["temperature"],
                "scores": score_result["scores"],
                "coldMaxScore": scoring_config.get("coldMaxScore", 33),
                "warmMaxScore": scoring_config.get("warmMaxScore", 66),
            })
            log.info("Lead score published", tenant=tenant_id, score=score_result["total_score"], temp=score_result["temperature"])
except Exception as scoring_error:
    log.warning("Lead scoring failed (non-fatal)", error=str(scoring_error))
```

> **Nota:** O `try/except` garante que falha no scoring não interrompe a entrega da resposta ao usuário.

- [ ] **Step 4: Rodar testes do AI orchestrator**

```bash
cd apps/ai-orchestrator && pytest -v
```

Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/ai-orchestrator/src/
git commit -m "feat(ai): trigger lead scoring after AI response and publish crm.score event"
```

---

## Task 5: API — LeadScoringService (aplica score ao deal)

**Context:** Serviço no api que recebe o evento `crm.score`, atualiza os campos `leadScore`, `leadTemperature`, `leadScoreDetails` no Deal, e se a temperatura for `QUALIFIED`, chama `CrmProgressionService.advanceToPosition(2)`.

**Files:**
- Create: `apps/api/src/modules/crm/lead-scoring.service.ts`
- Create: `apps/api/src/modules/crm/lead-scoring.service.spec.ts`

- [ ] **Step 1: Escrever os testes**

Criar `apps/api/src/modules/crm/lead-scoring.service.spec.ts`:

```typescript
import { Test } from "@nestjs/testing";
import { LeadScoringService } from "./lead-scoring.service";
import { CrmProgressionService } from "./crm-progression.service";
import { PrismaService } from "../../prisma/prisma.service";

const mockDeal = { id: "deal-1", contactId: "contact-1" };
const mockPrisma = {
  deal: { findFirst: jest.fn(), update: jest.fn() },
};
const mockCrmProgression = { advanceToPosition: jest.fn().mockResolvedValue(undefined) };

const basePayload = {
  tenantId: "tenant-1",
  contactId: "contact-1",
  conversationId: "conv-1",
  totalScore: 75,
  temperature: "QUALIFIED",
  scores: [{ criterion_id: "purchase_intent", score: 8, reasoning: "Quer comprar" }],
  coldMaxScore: 33,
  warmMaxScore: 66,
};

describe("LeadScoringService", () => {
  let service: LeadScoringService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        LeadScoringService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CrmProgressionService, useValue: mockCrmProgression },
      ],
    }).compile();
    service = module.get(LeadScoringService);
  });

  it("atualiza leadScore e leadTemperature no deal", async () => {
    mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
    mockPrisma.deal.update.mockResolvedValue({});

    await service.applyScore(basePayload);

    expect(mockPrisma.deal.update).toHaveBeenCalledWith({
      where: { id: "deal-1" },
      data: {
        leadScore: 75,
        leadTemperature: "QUALIFIED",
        leadScoreDetails: expect.objectContaining({ scores: basePayload.scores }),
      },
    });
  });

  it("chama advanceToPosition(2) quando temperatura é QUALIFIED", async () => {
    mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
    mockPrisma.deal.update.mockResolvedValue({});

    await service.applyScore(basePayload);

    expect(mockCrmProgression.advanceToPosition).toHaveBeenCalledWith("tenant-1", "contact-1", 2);
  });

  it("NÃO chama advanceToPosition quando temperatura é COLD", async () => {
    mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
    mockPrisma.deal.update.mockResolvedValue({});

    await service.applyScore({ ...basePayload, totalScore: 20, temperature: "COLD" });

    expect(mockCrmProgression.advanceToPosition).not.toHaveBeenCalled();
  });

  it("NÃO chama advanceToPosition quando temperatura é WARM", async () => {
    mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
    mockPrisma.deal.update.mockResolvedValue({});

    await service.applyScore({ ...basePayload, totalScore: 50, temperature: "WARM" });

    expect(mockCrmProgression.advanceToPosition).not.toHaveBeenCalled();
  });

  it("não faz nada quando contato não tem deal", async () => {
    mockPrisma.deal.findFirst.mockResolvedValue(null);

    await service.applyScore(basePayload);

    expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    expect(mockCrmProgression.advanceToPosition).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
pnpm --filter @whatsagent/api test -- lead-scoring.service
```

Expected: FAIL — "Cannot find module './lead-scoring.service'"

- [ ] **Step 3: Implementar o serviço**

Criar `apps/api/src/modules/crm/lead-scoring.service.ts`:

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CrmProgressionService } from "./crm-progression.service";

interface ScorePayload {
  tenantId: string;
  contactId: string;
  conversationId: string;
  totalScore: number;
  temperature: "COLD" | "WARM" | "QUALIFIED";
  scores: Array<{ criterion_id: string; score: number; reasoning: string }>;
  coldMaxScore: number;
  warmMaxScore: number;
}

@Injectable()
export class LeadScoringService {
  private readonly logger = new Logger(LeadScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crmProgression: CrmProgressionService,
  ) {}

  async applyScore(payload: ScorePayload): Promise<void> {
    const deal = await this.prisma.deal.findFirst({
      where: { tenantId: payload.tenantId, contactId: payload.contactId },
    });
    if (!deal) return;

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: {
        leadScore: payload.totalScore,
        leadTemperature: payload.temperature,
        leadScoreDetails: {
          scores: payload.scores,
          coldMaxScore: payload.coldMaxScore,
          warmMaxScore: payload.warmMaxScore,
          scoredAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(
      `Lead scored: contact=${payload.contactId} score=${payload.totalScore} temp=${payload.temperature}`,
    );

    if (payload.temperature === "QUALIFIED") {
      await this.crmProgression.advanceToPosition(payload.tenantId, payload.contactId, 2);
    }
  }
}
```

- [ ] **Step 4: Registrar no CrmModule**

Em `apps/api/src/modules/crm/crm.module.ts`:

```typescript
import { LeadScoringService } from "./lead-scoring.service";

providers: [CrmService, CrmProgressionService, LeadScoringService],
exports: [CrmService, CrmProgressionService, LeadScoringService],
```

- [ ] **Step 5: Rodar testes**

```bash
pnpm --filter @whatsagent/api test -- lead-scoring.service
```

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/crm/lead-scoring.service.ts apps/api/src/modules/crm/lead-scoring.service.spec.ts
git commit -m "feat(api): add LeadScoringService to apply AI scores to CRM deals"
```

---

## Task 6: API — Consumir evento crm.score no inbox-events.consumer

**Context:** O `inbox-events.consumer.ts` já consome `crm.advance`. Adicionar binding para `crm.score` e chamar `LeadScoringService.applyScore()`.

**Files:**
- Modify: `apps/api/src/queue/inbox-events.consumer.ts`

- [ ] **Step 1: Injetar LeadScoringService**

```typescript
import { LeadScoringService } from "../modules/crm/lead-scoring.service";

// constructor: adicionar
private readonly leadScoring: LeadScoringService,
```

- [ ] **Step 2: Adicionar binding para crm.score**

No setup do consumer (onde `crm.advance` está configurado), adicionar:

```typescript
await channel.bindQueue(queueName, "crm", "crm.score");
```

- [ ] **Step 3: Handler para crm.score**

No switch/if de routing keys, adicionar:

```typescript
if (routingKey === "crm.score") {
  const payload = JSON.parse(msg.content.toString());
  await this.leadScoring.applyScore(payload);
  return;
}
```

- [ ] **Step 4: Garantir que CrmModule está nos imports**

(Já deve estar do plano 21. Verificar.)

- [ ] **Step 5: Build**

```bash
pnpm --filter @whatsagent/api build
```

Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/queue/inbox-events.consumer.ts
git commit -m "feat(api): consume crm.score event and apply lead score to CRM deals"
```

---

## Task 7: Frontend — Página de configuração de Lead Scoring

**Context:** Adicionar "Lead Scoring" ao menu de configuração do agente (seguindo o padrão de `CONFIG_SECTIONS` em `/agent/page.tsx`). Criar a página `/agent/lead-scoring/page.tsx` com editor de critérios e sliders de threshold.

**Files:**
- Modify: `apps/web/src/app/(dashboard)/agent/page.tsx`
- Create: `apps/web/src/app/(dashboard)/agent/lead-scoring/page.tsx`

- [ ] **Step 1: Adicionar "Lead Scoring" ao CONFIG_SECTIONS**

Em `/agent/page.tsx`, adicionar ao array `CONFIG_SECTIONS` (após o último item):

```typescript
{
  href: "/agent/lead-scoring",
  label: "Lead Scoring",
  desc: "Configure critérios e pesos para qualificação automática de leads por IA.",
  icon: BarChart2,  // import { BarChart2 } from "lucide-react"
  color: "#f59e0b",
  bg: "rgba(245,158,11,0.12)",
  border: "rgba(245,158,11,0.25)",
  tag: "Qualificação",
  step: 4,
},
```

- [ ] **Step 2: Criar a página de configuração**

Criar `apps/web/src/app/(dashboard)/agent/lead-scoring/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import ky from "ky";

interface Criterion {
  id: string;
  name: string;
  description: string;
  weight: number;
}

interface LeadScoringConfig {
  isEnabled: boolean;
  triggerAfterMessages: number;
  coldMaxScore: number;
  warmMaxScore: number;
  criteria: Criterion[];
}

const DEFAULT_CRITERIA: Criterion[] = [
  { id: "purchase_intent", name: "Intenção de Compra",  description: "Quão claramente o prospect expressou interesse em comprar?",   weight: 25 },
  { id: "urgency",         name: "Urgência",            description: "Com que urgência o prospect precisa do produto/serviço?",       weight: 20 },
  { id: "budget",          name: "Orçamento",           description: "O prospect demonstrou capacidade financeira para a compra?",    weight: 20 },
  { id: "authority",       name: "Autoridade",          description: "O prospect tem poder de decisão sobre a compra?",              weight: 20 },
  { id: "engagement",      name: "Engajamento",         description: "Qual o nível de engajamento do prospect na conversa?",         weight: 15 },
];

export default function LeadScoringPage() {
  const [config, setConfig] = useState<LeadScoringConfig>({
    isEnabled: false,
    triggerAfterMessages: 3,
    coldMaxScore: 33,
    warmMaxScore: 66,
    criteria: DEFAULT_CRITERIA,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    ky.get("/api/agent/lead-scoring").json<LeadScoringConfig>().then(setConfig).catch(() => {});
  }, []);

  const totalWeight = config.criteria.reduce((s, c) => s + c.weight, 0);

  const save = async () => {
    setSaving(true);
    try {
      await ky.put("/api/agent/lead-scoring", { json: config });
      setToast("Configuração salva com sucesso!");
    } catch {
      setToast("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const updateCriterion = (id: string, field: keyof Criterion, value: string | number) => {
    setConfig(prev => ({
      ...prev,
      criteria: prev.criteria.map(c => c.id === id ? { ...c, [field]: value } : c),
    }));
  };

  const removeCriterion = (id: string) => {
    setConfig(prev => ({ ...prev, criteria: prev.criteria.filter(c => c.id !== id) }));
  };

  const addCriterion = () => {
    const id = `custom_${Date.now()}`;
    setConfig(prev => ({
      ...prev,
      criteria: [...prev.criteria, { id, name: "Novo Critério", description: "", weight: 10 }],
    }));
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Lead Scoring</h1>
      <p style={{ color: "var(--c-muted)", fontSize: 14, marginBottom: 32 }}>
        A IA avalia cada conversa e atribui um score 0-100. Configure os critérios e os thresholds de classificação.
      </p>

      {/* Toggle */}
      <label style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={config.isEnabled}
          onChange={e => setConfig(prev => ({ ...prev, isEnabled: e.target.checked }))}
        />
        <span style={{ fontWeight: 600 }}>Habilitar Lead Scoring automático</span>
      </label>

      {config.isEnabled && (
        <>
          {/* Trigger */}
          <section style={{ marginBottom: 32 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
              Disparar scoring após quantas mensagens?
            </label>
            <input
              type="number"
              min={1} max={20}
              value={config.triggerAfterMessages}
              onChange={e => setConfig(prev => ({ ...prev, triggerAfterMessages: Number(e.target.value) }))}
              style={{ width: 80, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-s2)", color: "var(--c-text)" }}
            />
          </section>

          {/* Thresholds */}
          <section style={{ marginBottom: 32, padding: 20, borderRadius: 12, border: "1px solid var(--c-border)", background: "var(--c-s1)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Thresholds de classificação</h2>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--c-muted)", display: "block", marginBottom: 4 }}>
                  🔵 Lead Frio — score máximo
                </label>
                <input type="number" min={1} max={config.warmMaxScore - 1} value={config.coldMaxScore}
                  onChange={e => setConfig(prev => ({ ...prev, coldMaxScore: Number(e.target.value) }))}
                  style={{ width: 80, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-s2)", color: "var(--c-text)" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--c-muted)", display: "block", marginBottom: 4 }}>
                  🟡 Lead Morno — score máximo
                </label>
                <input type="number" min={config.coldMaxScore + 1} max={99} value={config.warmMaxScore}
                  onChange={e => setConfig(prev => ({ ...prev, warmMaxScore: Number(e.target.value) }))}
                  style={{ width: 80, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-s2)", color: "var(--c-text)" }} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 6 }}>
                <span style={{ fontSize: 13, color: "var(--c-green)", fontWeight: 600 }}>
                  🟢 Qualificado — score &gt; {config.warmMaxScore}
                </span>
              </div>
            </div>
          </section>

          {/* Criteria */}
          <section style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>
                Critérios ({totalWeight !== 100 ? <span style={{ color: "#ef4444" }}>soma dos pesos: {totalWeight}%</span> : `${totalWeight}%`})
              </h2>
              <button onClick={addCriterion} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-s2)", color: "var(--c-text)", cursor: "pointer" }}>
                + Adicionar critério
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {config.criteria.map(c => (
                <div key={c.id} style={{ padding: 16, borderRadius: 10, border: "1px solid var(--c-border)", background: "var(--c-s1)" }}>
                  <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                    <input value={c.name} onChange={e => updateCriterion(c.id, "name", e.target.value)}
                      placeholder="Nome do critério"
                      style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-s2)", color: "var(--c-text)", fontSize: 13, fontWeight: 600 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="number" min={1} max={100} value={c.weight}
                        onChange={e => updateCriterion(c.id, "weight", Number(e.target.value))}
                        style={{ width: 60, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-s2)", color: "var(--c-text)", textAlign: "center" }} />
                      <span style={{ fontSize: 12, color: "var(--c-muted)" }}>%</span>
                    </div>
                    <button onClick={() => removeCriterion(c.id)}
                      style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>
                      ×
                    </button>
                  </div>
                  <input value={c.description} onChange={e => updateCriterion(c.id, "description", e.target.value)}
                    placeholder="Descrição (como o critério será avaliado pela IA)"
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--c-border)", background: "var(--c-s2)", color: "var(--c-muted)", fontSize: 12, boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <button
        onClick={save}
        disabled={saving}
        style={{ padding: "10px 28px", borderRadius: 8, background: "var(--c-green)", color: "#000", fontWeight: 700, fontSize: 14, border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
        {saving ? "Salvando..." : "Salvar configuração"}
      </button>

      {toast && (
        <div style={{ marginTop: 16, padding: "10px 16px", borderRadius: 8, background: toast.includes("Erro") ? "#ef444420" : "#22c55e20", color: toast.includes("Erro") ? "#ef4444" : "#22c55e", fontSize: 13 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Adicionar proxy `/api/agent/lead-scoring` no Next.js**

Verificar se existe um arquivo de route handler em `apps/web/src/app/api/agent/` para outros endpoints (ex: `/api/agent/persona`). Seguir o mesmo padrão para criar:
`apps/web/src/app/api/agent/lead-scoring/route.ts` — proxy para `BACKOFFICE_API_URL/agent/lead-scoring`.

- [ ] **Step 4: Build do frontend**

```bash
pnpm --filter @whatsagent/web build
```

Expected: zero erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/agent/
git commit -m "feat(web): add Lead Scoring configuration page with criteria editor and thresholds"
```

---

## Task 8: Frontend — Badge de temperatura no DealCard

**Context:** O `DealCard.tsx` já exibe title, value, contact, date. Adicionar um badge colorido de temperatura (🔵 Frio / 🟡 Morno / 🟢 Qualificado) e o score numérico quando disponíveis.

**Files:**
- Modify: `apps/web/src/types/crm.ts`
- Modify: `apps/web/src/components/crm/DealCard.tsx`

- [ ] **Step 1: Adicionar leadScore e leadTemperature à interface Deal**

Em `apps/web/src/types/crm.ts`, adicionar à interface `Deal`:

```typescript
leadScore:       number | null;
leadTemperature: "COLD" | "WARM" | "QUALIFIED" | null;
```

- [ ] **Step 2: Adicionar badge de temperatura ao DealCard**

Em `apps/web/src/components/crm/DealCard.tsx`, após o bloco de `contact` e antes de `footer`, adicionar:

```typescript
{deal.leadTemperature && (
  <div className="crm-deal-temperature">
    <span
      className="crm-deal-temp-badge"
      data-temp={deal.leadTemperature}
    >
      {deal.leadTemperature === "COLD"      && "🔵 Lead Frio"}
      {deal.leadTemperature === "WARM"      && "🟡 Lead Morno"}
      {deal.leadTemperature === "QUALIFIED" && "🟢 Qualificado"}
      {deal.leadScore !== null && ` · ${deal.leadScore}`}
    </span>
  </div>
)}
```

- [ ] **Step 3: Adicionar CSS para o badge**

Em `apps/web/src/app/globals.css`, adicionar:

```css
.crm-deal-temperature {
  margin-top: 2px;
}
.crm-deal-temp-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
}
.crm-deal-temp-badge[data-temp="COLD"]      { background: rgba(99,102,241,0.15); color: #818cf8; }
.crm-deal-temp-badge[data-temp="WARM"]      { background: rgba(245,158,11,0.15); color: #f59e0b; }
.crm-deal-temp-badge[data-temp="QUALIFIED"] { background: rgba(34,197,94,0.15);  color: #22c55e; }
```

- [ ] **Step 4: Build e verificar no CRM kanban**

```bash
pnpm --filter @whatsagent/web build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/types/crm.ts apps/web/src/components/crm/DealCard.tsx apps/web/src/app/globals.css
git commit -m "feat(web): add lead temperature badge to CRM deal cards"
```

---

## Verification (end-to-end)

1. Subir o stack:
   ```bash
   pnpm docker:up && pnpm dev
   ```

2. **Configurar Lead Scoring:**
   - Acessar `http://localhost:3000/agent/lead-scoring`
   - Habilitar Lead Scoring, ajustar thresholds, salvar
   - Verificar que `AgentConfig.leadScoringConfig` foi salvo no DB

3. **Testar score COLD:**
   - Simular conversa com poucas mensagens, sem intenção de compra
   - Verificar evento `crm.score` no RabbitMQ e badge 🔵 no kanban

4. **Testar score WARM:**
   - Simular conversa com algum interesse mas sem decisão
   - Verificar badge 🟡 no deal card

5. **Testar score QUALIFIED:**
   - Simular conversa com intenção clara de compra
   - Verificar badge 🟢 E deal avançando para "Qualificado" no kanban

6. **Verificar campos no DB:**
   ```sql
   SELECT id, "leadScore", "leadTemperature", "leadScoreDetails" FROM "Deal";
   ```

7. **Rodar todos os testes:**
   ```bash
   pnpm test
   cd apps/ai-orchestrator && pytest -v
   ```
   Expected: 100% PASS.

---

## Edge Cases Cobertos

| Caso | Comportamento |
|------|---------------|
| Lead Scoring desabilitado no AgentConfig | Nenhum scoring dispara |
| Conversa com menos de `triggerAfterMessages` | Scoring não dispara |
| Critério sem peso ou peso 0 | Ignorado no cálculo |
| Soma dos pesos ≠ 100 | Cálculo normalizado pela soma real |
| LLM retorna score fora de 0-10 | `max(0, min(100, score))` no resultado final |
| Falha na chamada LLM de scoring | `try/except` — não interrompe resposta ao usuário |
| ContactId ausente no evento | Scoring ignorado silenciosamente |
| Deal já em "Qualificado" ou além | `advanceToPosition` ignora (não volta) |
| Deal não encontrado | Nenhuma atualização realizada |
| Temperature COLD ou WARM | Badge exibido, nenhum avanço de stage |
