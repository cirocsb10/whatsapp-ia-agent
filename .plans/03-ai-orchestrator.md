# WhatsAgent — Plan 2: AI Orchestrator (LangGraph + LangChain)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o serviço Python que orquestra conversas com LangGraph — consome mensagens do RabbitMQ, executa o grafo de estado (greeting→catalog→payment), usa tools para busca no catálogo, geração de pagamento e handoff, aplica guard rails anti-alucinação, e publica a resposta formatada de volta para o Channel Service.

**Architecture:** FastAPI (porta 8000) + LangGraph 1.x como motor principal. Consumer RabbitMQ assíncrono (aio-pika) consome `msg.inbound`, executa o grafo LangGraph, publica `ai.response`. Redis armazena o estado da sessão (ConversationState). PostgreSQL guarda histórico completo via SQLAlchemy async. pgvector para busca semântica no catálogo.

**Tech Stack:** Python 3.12 · FastAPI · LangGraph 1.x · LangChain · langchain-openai · OpenAI SDK · aio-pika · redis-py async · SQLAlchemy 2.0 async · asyncpg · pgvector · Pydantic 2 · pytest-asyncio · structlog

**Pré-requisito:** Plan 0 concluído

---

## Estrutura de Arquivos

```
apps/ai-orchestrator/src/
├── main.py                    # FastAPI app, lifespan, routes
├── graph/
│   ├── __init__.py
│   ├── agent.py               # Compilação do LangGraph
│   ├── state.py               # ConversationState TypedDict
│   ├── nodes.py               # Todos os nós do grafo
│   └── tools.py               # LangChain Tools (catalog, payment, etc)
├── services/
│   ├── __init__.py
│   ├── llm.py                 # OpenAI client com retry + fallback
│   ├── embeddings.py          # pgvector semantic search
│   ├── session.py             # Redis session manager
│   ├── prompt_builder.py      # System prompt dinâmico por tenant
│   └── guard_rail.py         # Pipeline anti-alucinação
├── consumers/
│   ├── __init__.py
│   └── rabbitmq.py            # aio-pika consumer
├── publishers/
│   ├── __init__.py
│   └── rabbitmq.py            # aio-pika publisher
├── db/
│   ├── __init__.py
│   ├── postgres.py            # SQLAlchemy engine + session
│   └── models.py              # SQLAlchemy ORM models
├── models/
│   ├── __init__.py
│   └── schemas.py             # Pydantic schemas (request/response)
└── config.py                  # Settings via pydantic-settings
```

---

### Task 0: LLM Provider Factory — Suporte Multi-Modelo

**Files:**
- Create: `apps/ai-orchestrator/src/services/llm.py`
- Test: `apps/ai-orchestrator/tests/test_llm_factory.py`

Permite que cada tenant configure qual modelo/provider usar no AgentConfig — sem alterar nenhuma outra parte do sistema.

- [ ] **Step 1: Escrever testes do factory**

```python
# apps/ai-orchestrator/tests/test_llm_factory.py
import pytest
from unittest.mock import patch, MagicMock

def test_factory_returns_openai_for_gpt_models():
    from src.services.llm import get_llm
    with patch("src.services.llm.ChatOpenAI") as Mock:
        Mock.return_value = MagicMock()
        llm = get_llm("gpt-4o-mini")
        Mock.assert_called_once()
        assert "gpt-4o-mini" in str(Mock.call_args)

def test_factory_returns_anthropic_for_claude_models():
    from src.services.llm import get_llm
    with patch("src.services.llm.ChatAnthropic") as Mock:
        Mock.return_value = MagicMock()
        llm = get_llm("claude-haiku-4-5-20251001")
        Mock.assert_called_once()

def test_factory_raises_for_unknown_model():
    from src.services.llm import get_llm
    with pytest.raises(ValueError, match="Unsupported model"):
        get_llm("modelo-inexistente-xyz")

def test_factory_returns_ollama_for_llama():
    from src.services.llm import get_llm
    with patch("src.services.llm.ChatOllama") as Mock:
        Mock.return_value = MagicMock()
        llm = get_llm("llama3.3")
        Mock.assert_called_once()
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
cd apps/ai-orchestrator
uv run pytest tests/test_llm_factory.py -v
```

Expected: FAIL — `ModuleNotFoundError: src.services.llm`

- [ ] **Step 3: Implementar llm.py (factory + bind_tools)**

```python
# apps/ai-orchestrator/src/services/llm.py
"""
LLM Provider Factory — suporta OpenAI, Anthropic, Google e Ollama (local).
Cada tenant configura o modelo via AgentConfig.llm_model.
Adicionar novo provider: (1) instalar pacote uv add langchain-<provider>,
                          (2) adicionar branch no get_llm(), (3) adicionar
                          var de env correspondente.
"""
from langchain_core.language_models import BaseChatModel
from src.config import settings
import structlog

log = structlog.get_logger(__name__)

# Modelos disponíveis por provider
OPENAI_MODELS = {
    "gpt-4o", "gpt-4o-mini",
    "gpt-4-turbo", "gpt-3.5-turbo",
}

ANTHROPIC_MODELS = {
    "claude-opus-4-8", "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
    # aliases curtos aceitos também:
    "claude-opus", "claude-sonnet", "claude-haiku",
}

GOOGLE_MODELS = {
    "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash",
}

# Modelos que podem rodar via Ollama local
OLLAMA_MODELS = {
    "llama3.3", "llama3.1", "mistral", "mixtral",
    "qwen2.5", "phi3", "deepseek-r1",
}


def get_llm(
    model: str,
    temperature: float = 0.3,
    max_tokens: int = 1000,
) -> BaseChatModel:
    """
    Retorna instância LangChain do modelo solicitado.
    Todas as instâncias são compatíveis com .bind_tools() e .ainvoke().

    Args:
        model: Nome do modelo (ex: "gpt-4o-mini", "claude-haiku-4-5-20251001")
        temperature: Temperatura de geração (0.0–1.0)
        max_tokens: Limite de tokens na resposta

    Returns:
        BaseChatModel compatível com LangChain/LangGraph
    """
    model_lower = model.lower()

    # ─── OpenAI ──────────────────────────────────────────────────────────
    if model_lower in OPENAI_MODELS or model_lower.startswith("gpt-"):
        from langchain_openai import ChatOpenAI
        log.debug("llm_factory", provider="openai", model=model)
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=settings.openai_api_key,
        )

    # ─── Anthropic ───────────────────────────────────────────────────────
    if model_lower in ANTHROPIC_MODELS or model_lower.startswith("claude-"):
        from langchain_anthropic import ChatAnthropic

        # Resolver aliases curtos para IDs completos
        aliases = {
            "claude-opus":   "claude-opus-4-8",
            "claude-sonnet": "claude-sonnet-4-6",
            "claude-haiku":  "claude-haiku-4-5-20251001",
        }
        resolved = aliases.get(model_lower, model)

        log.debug("llm_factory", provider="anthropic", model=resolved)
        return ChatAnthropic(
            model=resolved,
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=settings.anthropic_api_key,
        )

    # ─── Google Gemini ───────────────────────────────────────────────────
    if model_lower in GOOGLE_MODELS or model_lower.startswith("gemini-"):
        from langchain_google_genai import ChatGoogleGenerativeAI
        log.debug("llm_factory", provider="google", model=model)
        return ChatGoogleGenerativeAI(
            model=model,
            temperature=temperature,
            max_output_tokens=max_tokens,
            google_api_key=settings.google_api_key,
        )

    # ─── Ollama (modelos locais) ──────────────────────────────────────────
    if model_lower in OLLAMA_MODELS or model_lower.startswith("ollama:"):
        from langchain_ollama import ChatOllama
        clean_model = model_lower.replace("ollama:", "")
        log.debug("llm_factory", provider="ollama", model=clean_model)
        return ChatOllama(
            model=clean_model,
            temperature=temperature,
            num_predict=max_tokens,
            base_url=settings.ollama_url,
        )

    raise ValueError(
        f"Unsupported model: '{model}'. "
        f"Supported: OpenAI {OPENAI_MODELS}, "
        f"Anthropic {ANTHROPIC_MODELS}, "
        f"Google {GOOGLE_MODELS}, "
        f"Ollama {OLLAMA_MODELS}"
    )


def get_llm_with_tools(model: str, tools: list, **kwargs) -> BaseChatModel:
    """Retorna LLM já com tools vinculadas (bind_tools)."""
    llm = get_llm(model, **kwargs)
    return llm.bind_tools(tools)
```

- [ ] **Step 4: Atualizar config.py com novas variáveis de ambiente**

```python
# Adicionar ao Settings em src/config.py:

# Anthropic
anthropic_api_key: str = Field(default="")

# Google
google_api_key: str = Field(default="")

# Ollama (auto-hospedado)
ollama_url: str = Field(default="http://localhost:11434")
ollama_enabled: bool = Field(default=False)
```

- [ ] **Step 5: Adicionar dependências opcionais**

```bash
cd apps/ai-orchestrator
# Instalar todos os providers (instalar só o necessário em produção)
uv add langchain-anthropic langchain-google-genai langchain-ollama
```

- [ ] **Step 6: Atualizar nodes.py para usar o factory**

```python
# Em apps/ai-orchestrator/src/graph/nodes.py
# Substituir a função _get_llm_with_tools():

def _get_llm_with_tools(model: str = None, temperature: float = 0.3):
    from src.services.llm import get_llm_with_tools
    # Model vem do AgentConfig do tenant; fallback para config global
    effective_model = model or settings.openai_model_simple
    return get_llm_with_tools(effective_model, ALL_TOOLS, temperature=temperature)
```

- [ ] **Step 7: Rodar testes**

```bash
uv run pytest tests/test_llm_factory.py -v
```

Expected: PASS — 4 testes passando

- [ ] **Step 8: Commit**

```bash
git add apps/ai-orchestrator/src/services/llm.py
git commit -m "feat(ai): add multi-provider llm factory (openai, anthropic, google, ollama)"
```

---

### Task 1: ConversationState e Configuração

**Files:**
- Create: `apps/ai-orchestrator/src/config.py`
- Create: `apps/ai-orchestrator/src/graph/state.py`
- Test: `apps/ai-orchestrator/tests/test_state.py`

- [ ] **Step 1: Escrever testes**

```python
# apps/ai-orchestrator/tests/test_state.py
import pytest
from src.graph.state import ConversationState, CartItem, MessageSummary

def test_initial_state_defaults():
    state = ConversationState(
        tenant_id="tenant-123",
        conversation_id="conv-456",
        contact_phone="5511999999999",
        current_message="Olá",
    )
    assert state["current_stage"] == "greeting"
    assert state["cart"] == []
    assert state["messages"] == []
    assert state["should_handoff"] is False
    assert state["guard_rail_triggered"] is False

def test_cart_item_total():
    item = CartItem(
        product_id="prod-1",
        product_name="Camiseta Preta",
        price_cents=5990,
        quantity=2,
    )
    assert item.subtotal_cents == 11980

def test_message_summary_serialization():
    msg = MessageSummary(role="user", content="Quero uma camiseta", timestamp=1700000000)
    data = msg.model_dump()
    assert data["role"] == "user"
    assert data["content"] == "Quero uma camiseta"
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
cd apps/ai-orchestrator
uv run pytest tests/test_state.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Criar config.py**

```python
# apps/ai-orchestrator/src/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "WhatsAgent AI Orchestrator"
    debug: bool = False
    log_level: str = "INFO"

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://whatsagent:whatsagent_secret@localhost:5432/whatsagent"
    )

    # Redis
    redis_url: str = Field(default="redis://:redis_secret@localhost:6379")
    session_ttl_seconds: int = 86400          # 24h
    session_max_messages: int = 50             # Msgs por sessão antes de resetar

    # RabbitMQ
    rabbitmq_url: str = Field(default="amqp://whatsagent:rabbitmq_secret@localhost:5672")
    rabbitmq_inbound_queue: str = "ai.process"
    rabbitmq_inbound_exchange: str = "messages"
    rabbitmq_inbound_routing_key: str = "msg.inbound"
    rabbitmq_outbound_exchange: str = "ai"
    rabbitmq_outbound_routing_key: str = "ai.response"

    # OpenAI
    openai_api_key: str = Field(default="")
    openai_model_complex: str = "gpt-4o"
    openai_model_simple: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_max_tokens: int = 1000
    openai_temperature: float = 0.3

    # LangGraph
    langgraph_recursion_limit: int = 10        # Máx iterações por conversa

settings = Settings()
```

- [ ] **Step 4: Criar state.py**

```python
# apps/ai-orchestrator/src/graph/state.py
from typing import Annotated, TypedDict, Optional, Any
from pydantic import BaseModel, computed_field
import operator

# ─── Modelos de dados embarcados no estado ───────────────────────────────────

class CartItem(BaseModel):
    product_id: str
    product_name: str
    price_cents: int
    quantity: int
    variation_selected: dict[str, str] = {}

    @computed_field
    @property
    def subtotal_cents(self) -> int:
        return self.price_cents * self.quantity

class MessageSummary(BaseModel):
    role: str   # "user" | "assistant"
    content: str
    timestamp: int  # Unix

class ToolCall(BaseModel):
    tool_name: str
    args: dict[str, Any]
    result: Any
    error: Optional[str] = None

# ─── Estado principal do LangGraph ───────────────────────────────────────────

class ConversationState(TypedDict):
    # Identificadores
    tenant_id: str
    conversation_id: str
    contact_phone: str

    # Mensagem atual sendo processada
    current_message: str
    current_message_type: str       # "text" | "audio" | "image"
    audio_transcript: Optional[str]

    # Histórico de conversa (Annotated com operator.add = acumulativo)
    messages: Annotated[list[MessageSummary], operator.add]

    # Estágio atual da conversa
    current_stage: str              # "greeting" | "discovery" | "catalog" | ...

    # Carrinho de compras
    cart: list[CartItem]

    # Contexto do tenant
    agent_name: str
    agent_tone: str
    system_prompt: str
    business_hours_open: bool

    # Resultado do LLM (nó reasoning)
    llm_response: Optional[str]
    llm_tool_calls: list[ToolCall]

    # Guard rail
    guard_rail_triggered: bool
    guard_rail_action: Optional[str]  # "block" | "rewrite" | "handoff"
    guard_rail_reason: Optional[str]
    guard_rail_fallback: Optional[str]

    # Handoff
    should_handoff: bool
    handoff_reason: Optional[str]

    # Resposta final para enviar
    final_messages: list[dict]    # [{"type": "text", "text": "..."}, ...]

    # Debug (só em dev)
    debug_trace: list[str]

    # Defaults via __init__ não existe em TypedDict,
    # ver graph/agent.py para como inicializar
```

- [ ] **Step 5: Rodar testes — devem passar**

```bash
uv run pytest tests/test_state.py -v
```

Expected: PASS — 3 testes passando

- [ ] **Step 6: Commit**

```bash
git add apps/ai-orchestrator/src/config.py apps/ai-orchestrator/src/graph/state.py
git commit -m "feat(ai): add conversation state typeddict and config"
```

---

### Task 2: LangChain Tools (catalog, estoque, pagamento, handoff)

**Files:**
- Create: `apps/ai-orchestrator/src/graph/tools.py`
- Test: `apps/ai-orchestrator/tests/test_tools.py`

- [ ] **Step 1: Escrever testes**

```python
# apps/ai-orchestrator/tests/test_tools.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

@pytest.fixture
def mock_db_session():
    return AsyncMock()

@pytest.mark.asyncio
async def test_catalog_search_returns_products(mock_db_session):
    from src.graph.tools import catalog_search_tool
    
    # Mock pgvector search
    mock_product = MagicMock()
    mock_product.name = "Camiseta Preta Premium"
    mock_product.description = "100% algodão"
    mock_product.price_cents = 5990
    mock_product.stock_qty = 10
    mock_product.id = "prod-uuid-1"
    
    with patch("src.graph.tools._vector_search", return_value=[mock_product]):
        result = await catalog_search_tool.ainvoke({
            "query": "camiseta preta",
            "tenant_id": "tenant-123",
        })
    
    assert "Camiseta Preta Premium" in result
    assert "R$ 59,90" in result
    assert "10 em estoque" in result

@pytest.mark.asyncio
async def test_get_stock_returns_quantity():
    from src.graph.tools import get_stock_tool

    with patch("src.graph.tools._get_product_stock", return_value={"qty": 5, "reserved": 1}):
        result = await get_stock_tool.ainvoke({
            "product_id": "prod-uuid-1",
            "tenant_id": "tenant-123",
        })
    
    assert "4" in result  # 5 - 1 reserved = 4 disponível

@pytest.mark.asyncio
async def test_verify_hours_returns_open_status():
    from src.graph.tools import verify_business_hours_tool
    import json
    
    hours_config = {
        "mon": {"open": "09:00", "close": "18:00", "active": True},
        "tue": {"open": "09:00", "close": "18:00", "active": True},
    }
    
    result = await verify_business_hours_tool.ainvoke({
        "tenant_id": "tenant-123",
        "hours_config": json.dumps(hours_config),
        "timezone": "America/Sao_Paulo",
    })
    
    assert isinstance(result, str)
    assert "aberto" in result.lower() or "fechado" in result.lower()
```

- [ ] **Step 2: Implementar tools.py**

```python
# apps/ai-orchestrator/src/graph/tools.py
from langchain_core.tools import tool
from typing import Optional
import json
from datetime import datetime
import pytz
import structlog

log = structlog.get_logger(__name__)


async def _vector_search(query: str, tenant_id: str, limit: int = 5):
    """Busca semântica no catálogo via pgvector. Implementado em services/embeddings.py"""
    from src.services.embeddings import EmbeddingsService
    svc = EmbeddingsService()
    return await svc.search_catalog(tenant_id, query, limit)


async def _get_product_stock(product_id: str, tenant_id: str) -> dict:
    from src.db.postgres import get_async_session
    from sqlalchemy import text
    
    async with get_async_session() as session:
        result = await session.execute(
            text("""
                SELECT stock_qty, reserved_qty
                FROM products
                WHERE id = :product_id AND tenant_id = :tenant_id
            """),
            {"product_id": product_id, "tenant_id": tenant_id},
        )
        row = result.fetchone()
        if not row:
            return {"qty": 0, "reserved": 0}
        return {"qty": row[0], "reserved": row[1]}


@tool
async def catalog_search_tool(query: str, tenant_id: str) -> str:
    """
    Busca produtos no catálogo do tenant com base na descrição do cliente.
    Use esta ferramenta quando o cliente perguntar sobre produtos, preços ou disponibilidade.
    
    Args:
        query: Descrição do produto que o cliente quer encontrar
        tenant_id: ID do tenant atual
    
    Returns:
        Lista formatada dos produtos encontrados com nome, descrição, preço e estoque
    """
    try:
        products = await _vector_search(query, tenant_id, limit=5)
        
        if not products:
            return "Não encontrei produtos correspondentes à sua busca. Pode descrever melhor o que procura?"
        
        lines = ["Encontrei estes produtos para você:\n"]
        for i, p in enumerate(products, 1):
            available = p.stock_qty - p.reserved_qty
            price_brl = p.price_cents / 100
            stock_status = f"✅ {available} em estoque" if available > 0 else "❌ Esgotado"
            
            lines.append(
                f"{i}. *{p.name}*\n"
                f"   {p.description or ''}\n"
                f"   💰 R$ {price_brl:.2f}\n"
                f"   {stock_status}\n"
                f"   ID: {p.id}"
            )
        
        return "\n".join(lines)
    except Exception as e:
        log.error("catalog_search_tool failed", error=str(e))
        return "Erro ao buscar produtos. Por favor, tente novamente."


@tool
async def get_stock_tool(product_id: str, tenant_id: str) -> str:
    """
    Verifica estoque disponível de um produto específico em tempo real.
    
    Args:
        product_id: ID do produto (obtido do catalog_search)
        tenant_id: ID do tenant atual
    
    Returns:
        Quantidade disponível para venda (stock_qty - reserved_qty)
    """
    try:
        data = await _get_product_stock(product_id, tenant_id)
        available = data["qty"] - data["reserved"]
        
        if available <= 0:
            return f"Este produto está esgotado no momento. Posso verificar outros produtos similares?"
        elif available <= 3:
            return f"Temos apenas {available} unidades disponíveis! Recomendo não deixar para depois."
        else:
            return f"Temos {available} unidades disponíveis para entrega imediata."
    except Exception as e:
        log.error("get_stock_tool failed", error=str(e))
        return "Erro ao verificar estoque. Por favor, tente novamente."


@tool
async def add_to_cart_tool(
    product_id: str,
    product_name: str,
    price_cents: int,
    quantity: int,
    tenant_id: str,
    variation_selected: Optional[str] = None,
) -> str:
    """
    Adiciona produto ao carrinho da sessão atual.
    Use quando o cliente confirmar que quer comprar um produto.
    
    Args:
        product_id: ID do produto
        product_name: Nome do produto
        price_cents: Preço em centavos
        quantity: Quantidade desejada
        tenant_id: ID do tenant
        variation_selected: JSON string com variações selecionadas (ex: '{"Cor": "Preto", "Tamanho": "M"}')
    
    Returns:
        Confirmação com resumo do carrinho atualizado
    """
    variation = json.loads(variation_selected) if variation_selected else {}
    subtotal = price_cents * quantity / 100
    
    # Nota: o carrinho real está no estado LangGraph (cart list)
    # Esta tool retorna confirmação; o nó Output atualiza o estado
    return (
        f"✅ Adicionado ao carrinho!\n"
        f"   Produto: {product_name}\n"
        f"   Quantidade: {quantity}\n"
        f"   Valor: R$ {subtotal:.2f}"
        + (f"\n   Variação: {json.dumps(variation, ensure_ascii=False)}" if variation else "")
    )


@tool
async def generate_payment_link_tool(
    tenant_id: str,
    contact_phone: str,
    items_json: str,
    payment_method: str = "pix",
) -> str:
    """
    Gera link de pagamento via Mercado Pago para fechar o pedido.
    Use APENAS quando o cliente confirmar todos os itens e querer pagar.
    
    Args:
        tenant_id: ID do tenant
        contact_phone: Telefone do cliente
        items_json: JSON string com lista de itens [{"product_id": ..., "name": ..., "price_cents": ..., "quantity": ...}]
        payment_method: "pix" | "credit_card" | "boleto"
    
    Returns:
        QR Code Pix + código para cópia e cola
    """
    try:
        items = json.loads(items_json)
        total_cents = sum(i["price_cents"] * i["quantity"] for i in items)
        total_brl = total_cents / 100
        
        # 1. Criar o pedido no back-office API (retorna orderId)
        import httpx
        api_base = __import__('os').environ.get('BACKOFFICE_API_URL', 'http://api:3002')
        internal_token = __import__('os').environ.get("INTERNAL_API_TOKEN", "")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Criar pedido primeiro (back-office aguarda order existente para gerar pagamento)
            order_resp = await client.post(
                f"{api_base}/orders/internal",
                json={
                    "tenantId": tenant_id,
                    "contactPhone": contact_phone,
                    "items": items,
                },
                headers={"X-Internal-Token": internal_token},
            )
            order_resp.raise_for_status()
            order_data = order_resp.json()
            order_id = order_data["id"]
            
            # Gerar link de pagamento para o pedido criado
            pay_resp = await client.post(
                f"{api_base}/payments/generate-internal",
                json={
                    "orderId": order_id,
                    "paymentMethod": payment_method.upper(),  # "PIX" | "CREDIT_CARD"
                },
                headers={"X-Internal-Token": internal_token},
            )
            pay_resp.raise_for_status()
            data = pay_resp.json()
        
        if payment_method == "pix":
            return (
                f"💳 *Pagamento Pix gerado!*\n\n"
                f"💰 Total: R$ {total_brl:.2f}\n\n"
                f"*Copia e cola o código Pix:*\n"
                f"`{data['pixCopyPaste']}`\n\n"
                f"⏰ Expira em 30 minutos\n\n"
                f"Após o pagamento confirmado, te aviso aqui mesmo! 😊"
            )
        else:
            return f"🔗 Link de pagamento: {data['paymentUrl']}\n💰 Total: R$ {total_brl:.2f}"
    
    except Exception as e:
        log.error("generate_payment_link_tool failed", error=str(e))
        return "Não consegui gerar o link de pagamento agora. Vou transferir para um atendente."


@tool
async def verify_business_hours_tool(
    tenant_id: str,
    hours_config: str,
    timezone: str = "America/Sao_Paulo",
) -> str:
    """
    Verifica se o negócio está aberto no momento atual.
    
    Args:
        tenant_id: ID do tenant
        hours_config: JSON string com config de horários
        timezone: Timezone do negócio
    
    Returns:
        Status de funcionamento atual
    """
    try:
        hours = json.loads(hours_config)
        tz = pytz.timezone(timezone)
        now = datetime.now(tz)
        day_key = now.strftime("%a").lower()  # "mon", "tue", etc
        
        day_config = hours.get(day_key, {})
        if not day_config.get("active", False):
            return "fechado - dia não trabalhado"
        
        open_time = day_config.get("open", "00:00")
        close_time = day_config.get("close", "00:00")
        
        current_str = now.strftime("%H:%M")
        
        if open_time <= current_str <= close_time:
            return f"aberto - funcionando até {close_time}"
        elif current_str < open_time:
            return f"fechado - abre às {open_time}"
        else:
            return f"fechado - encerrou às {close_time}"
    except Exception:
        return "aberto"  # Fallback seguro: assume aberto em caso de erro


@tool
async def transfer_to_human_tool(
    tenant_id: str,
    conversation_id: str,
    reason: str,
    urgency: str = "medium",
) -> str:
    """
    Transfere a conversa para um agente humano.
    Use quando: pedido for de alto valor, cliente frustrado, pergunta fora do escopo,
    cliente pedir explicitamente, ou confiança do agente for baixa.
    
    Args:
        tenant_id: ID do tenant
        conversation_id: ID da conversa atual
        reason: Motivo da transferência em texto legível
        urgency: "low" | "medium" | "high"
    
    Returns:
        Mensagem confirmando o handoff
    """
    # O nó Output detecta esta tool sendo chamada e seta should_handoff=True
    log.info("Handoff requested", tenant_id=tenant_id, reason=reason, urgency=urgency)
    return "__HANDOFF_REQUESTED__"  # Sentinel detectado pelo nó Output


@tool
async def get_conversation_history_tool(
    tenant_id: str,
    contact_phone: str,
    limit: int = 5,
) -> str:
    """
    Recupera histórico de pedidos e conversas anteriores do cliente.
    Use para personalizar o atendimento de clientes recorrentes.
    
    Args:
        tenant_id: ID do tenant
        contact_phone: Telefone do cliente
        limit: Quantos pedidos anteriores retornar
    
    Returns:
        Resumo do histórico do cliente
    """
    from src.db.postgres import get_async_session
    from sqlalchemy import text
    
    try:
        async with get_async_session() as session:
            result = await session.execute(
                text("""
                    SELECT o.order_number, o.total_cents, o.status, o.created_at,
                           COUNT(oi.id) as item_count
                    FROM orders o
                    JOIN contacts c ON o.contact_id = c.id
                    JOIN order_items oi ON oi.order_id = o.id
                    WHERE c.phone = :phone AND o.tenant_id = :tenant_id
                    GROUP BY o.id
                    ORDER BY o.created_at DESC
                    LIMIT :limit
                """),
                {"phone": contact_phone, "tenant_id": tenant_id, "limit": limit},
            )
            rows = result.fetchall()
        
        if not rows:
            return "Cliente novo — sem histórico de compras."
        
        lines = [f"Histórico do cliente ({len(rows)} pedidos):"]
        for row in rows:
            total_brl = row[1] / 100
            lines.append(
                f"• Pedido {row[0]}: R$ {total_brl:.2f} ({row[3].strftime('%d/%m/%Y')}) - {row[2]}"
            )
        
        return "\n".join(lines)
    except Exception as e:
        log.error("get_conversation_history_tool failed", error=str(e))
        return "Sem histórico disponível."


# Lista de todas as tools disponíveis para o agente
ALL_TOOLS = [
    catalog_search_tool,
    get_stock_tool,
    add_to_cart_tool,
    generate_payment_link_tool,
    verify_business_hours_tool,
    transfer_to_human_tool,
    get_conversation_history_tool,
]
```

- [ ] **Step 3: Rodar testes**

```bash
uv run pytest tests/test_tools.py -v
```

Expected: PASS — 3 testes passando

- [ ] **Step 4: Commit**

```bash
git add apps/ai-orchestrator/src/graph/tools.py
git commit -m "feat(ai): add all langchain tools (catalog, stock, payment, handoff)"
```

---

### Task 3: Nodes do LangGraph

**Files:**
- Create: `apps/ai-orchestrator/src/graph/nodes.py`
- Test: `apps/ai-orchestrator/tests/test_nodes.py`

- [ ] **Step 1: Escrever testes dos nodes**

```python
# apps/ai-orchestrator/tests/test_nodes.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from src.graph.state import ConversationState

def make_state(**kwargs) -> ConversationState:
    defaults: ConversationState = {
        "tenant_id": "tenant-123",
        "conversation_id": "conv-456",
        "contact_phone": "5511999999999",
        "current_message": "Olá",
        "current_message_type": "text",
        "audio_transcript": None,
        "messages": [],
        "current_stage": "greeting",
        "cart": [],
        "agent_name": "Carla",
        "agent_tone": "FRIENDLY",
        "system_prompt": "Você é Carla, assistente da Loja X.",
        "business_hours_open": True,
        "llm_response": None,
        "llm_tool_calls": [],
        "guard_rail_triggered": False,
        "guard_rail_action": None,
        "guard_rail_reason": None,
        "guard_rail_fallback": None,
        "should_handoff": False,
        "handoff_reason": None,
        "final_messages": [],
        "debug_trace": [],
    }
    return {**defaults, **kwargs}

@pytest.mark.asyncio
async def test_entry_node_sets_system_prompt(make_state=make_state):
    from src.graph.nodes import entry_node
    
    mock_prompt = "Você é Carla, assistente da Loja Teste."
    
    with patch("src.graph.nodes.PromptBuilderService") as MockPB:
        mock_pb = MagicMock()
        mock_pb.build = AsyncMock(return_value=mock_prompt)
        MockPB.return_value = mock_pb
        
        state = make_state()
        result = await entry_node(state)
    
    assert result["system_prompt"] == mock_prompt

@pytest.mark.asyncio
async def test_guard_rail_node_blocks_forbidden_text():
    from src.graph.nodes import guard_rail_node
    
    state = make_state(
        llm_response="Você pode comprar na Empresa Rival, eles têm melhor preço.",
    )
    
    mock_rules = [{
        "type": "TEXT_BLOCK",
        "action": "REWRITE",
        "config": {"patterns": ["Empresa Rival"]},
        "fallback_message": "Posso ajudar com nossos produtos.",
    }]
    
    with patch("src.graph.nodes._fetch_guard_rules", AsyncMock(return_value=mock_rules)):
        result = await guard_rail_node(state)
    
    assert result["guard_rail_triggered"] is True
    assert result["guard_rail_action"] == "REWRITE"

@pytest.mark.asyncio
async def test_output_node_detects_handoff_sentinel():
    from src.graph.nodes import output_node
    
    state = make_state(
        llm_response="__HANDOFF_REQUESTED__",
        llm_tool_calls=[{"tool_name": "transfer_to_human_tool", "args": {}, "result": "__HANDOFF_REQUESTED__"}],
    )
    
    result = await output_node(state)
    assert result["should_handoff"] is True
```

- [ ] **Step 2: Implementar nodes.py**

```python
# apps/ai-orchestrator/src/graph/nodes.py
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from src.graph.state import ConversationState
from src.graph.tools import ALL_TOOLS
from src.services.prompt_builder import PromptBuilderService
from src.services.guard_rail import GuardRailService
from src.config import settings
import structlog

log = structlog.get_logger(__name__)

# ─── Inicializar LLM com tools ───────────────────────────────────────────────

def _get_llm_with_tools():
    llm = ChatOpenAI(
        model=settings.openai_model_simple,
        temperature=settings.openai_temperature,
        max_tokens=settings.openai_max_tokens,
        api_key=settings.openai_api_key,
    )
    return llm.bind_tools(ALL_TOOLS)


async def _fetch_guard_rules(tenant_id: str) -> list[dict]:
    """Busca regras guard do DB para o tenant."""
    from src.db.postgres import get_async_session
    from sqlalchemy import text
    
    async with get_async_session() as session:
        result = await session.execute(
            text("""
                SELECT type, action, config, priority, fallback_message
                FROM guard_rules
                WHERE tenant_id = :tid AND is_active = true
                ORDER BY priority ASC
            """),
            {"tid": tenant_id},
        )
        return [
            {
                "type": row[0],
                "action": row[1],
                "config": row[2],
                "priority": row[3],
                "fallback_message": row[4],
            }
            for row in result.fetchall()
        ]


# ─── NODE 1: Entry — carrega contexto e system prompt ───────────────────────

async def entry_node(state: ConversationState) -> dict:
    """
    Carrega o system prompt dinâmico do tenant e enriquece o estado inicial.
    """
    log.info("entry_node", tenant=state["tenant_id"], phone=state["contact_phone"])
    
    pb = PromptBuilderService()
    system_prompt = await pb.build(
        tenant_id=state["tenant_id"],
        agent_name=state.get("agent_name", "Assistente"),
        tone=state.get("agent_tone", "FRIENDLY"),
        business_hours_open=state.get("business_hours_open", True),
    )
    
    return {
        "system_prompt": system_prompt,
        "debug_trace": state.get("debug_trace", []) + ["entry_node:completed"],
    }


# ─── NODE 2: Route — classifica estágio da conversa ─────────────────────────

async def route_node(state: ConversationState) -> dict:
    """
    Classifica em qual estágio da conversa estamos baseado no histórico.
    Decide se deve usar modelo simples ou complexo.
    """
    messages_count = len(state.get("messages", []))
    cart = state.get("cart", [])
    current_stage = state.get("current_stage", "greeting")
    
    # Lógica simples de roteamento baseada em contexto
    new_stage = current_stage
    
    if messages_count == 0:
        new_stage = "greeting"
    elif cart and any("AWAITING_PAYMENT" in m.get("content", "") for m in state.get("messages", [])):
        new_stage = "payment"
    elif cart:
        new_stage = "negotiation"
    elif messages_count > 3:
        new_stage = "catalog"
    else:
        new_stage = "discovery"
    
    return {
        "current_stage": new_stage,
        "debug_trace": state.get("debug_trace", []) + [f"route_node:stage={new_stage}"],
    }


# ─── NODE 3: Reasoning — executa LLM com tools ───────────────────────────────

async def reasoning_node(state: ConversationState) -> dict:
    """
    Nó principal: executa o LLM com o system prompt do tenant e histórico.
    O LLM pode chamar tools para buscar produtos, gerar pagamentos, etc.
    """
    llm = _get_llm_with_tools()
    
    # Montar histórico de mensagens
    chat_messages = [SystemMessage(content=state["system_prompt"])]
    
    for msg in state.get("messages", [])[-10:]:  # Últimas 10 msgs
        if msg["role"] == "user":
            chat_messages.append(HumanMessage(content=msg["content"]))
        else:
            chat_messages.append(AIMessage(content=msg["content"]))
    
    # Adicionar mensagem atual
    current_msg = state["current_message"]
    if state.get("audio_transcript"):
        current_msg = f"[Áudio transcrito]: {state['audio_transcript']}"
    
    chat_messages.append(HumanMessage(content=current_msg))
    
    # Executar LLM
    response = await llm.ainvoke(chat_messages)
    
    # Extrair tool calls se houver
    tool_calls = []
    if response.tool_calls:
        for tc in response.tool_calls:
            tool = next((t for t in ALL_TOOLS if t.name == tc["name"]), None)
            if tool:
                try:
                    result = await tool.ainvoke(
                        {**tc["args"], "tenant_id": state["tenant_id"]}
                    )
                    tool_calls.append({
                        "tool_name": tc["name"],
                        "args": tc["args"],
                        "result": result,
                        "error": None,
                    })
                except Exception as e:
                    tool_calls.append({
                        "tool_name": tc["name"],
                        "args": tc["args"],
                        "result": None,
                        "error": str(e),
                    })
    
    # Se houve tool calls, fazer segunda chamada ao LLM com resultados
    if tool_calls:
        tool_results_text = "\n".join(
            f"[{tc['tool_name']}]: {tc['result'] or tc['error']}"
            for tc in tool_calls
        )
        chat_messages.append(AIMessage(content=response.content or ""))
        chat_messages.append(HumanMessage(content=f"Resultados das ferramentas:\n{tool_results_text}"))
        
        final_response = await llm.ainvoke(chat_messages)
        llm_text = final_response.content
    else:
        llm_text = response.content
    
    return {
        "llm_response": llm_text,
        "llm_tool_calls": tool_calls,
        "debug_trace": state.get("debug_trace", []) + [
            f"reasoning_node:tools_called={[tc['tool_name'] for tc in tool_calls]}"
        ],
    }


# ─── NODE 4: Guard Rail — valida resposta antes de enviar ────────────────────

async def guard_rail_node(state: ConversationState) -> dict:
    """
    Valida a resposta do LLM contra as regras configuradas pelo tenant.
    Bloqueia, reescreve ou aciona handoff se necessário.
    """
    llm_response = state.get("llm_response", "") or ""
    
    if not llm_response:
        return {"guard_rail_triggered": False}
    
    rules = await _fetch_guard_rules(state["tenant_id"])
    guard = GuardRailService(rules)
    result = await guard.validate(llm_response, state)
    
    if result.triggered:
        log.warning(
            "guard_rail triggered",
            tenant=state["tenant_id"],
            action=result.action,
            reason=result.reason,
        )
        return {
            "guard_rail_triggered": True,
            "guard_rail_action": result.action,
            "guard_rail_reason": result.reason,
            "guard_rail_fallback": result.fallback_message,
            "debug_trace": state.get("debug_trace", []) + [
                f"guard_rail:triggered action={result.action}"
            ],
        }
    
    return {"guard_rail_triggered": False}


# ─── NODE 5: Output — formata resposta final para envio ──────────────────────

async def output_node(state: ConversationState) -> dict:
    """
    Formata a resposta final para o formato OutboundMessage e detecta handoff.
    """
    llm_response = state.get("llm_response", "") or ""
    guard_triggered = state.get("guard_rail_triggered", False)
    
    # Verificar se houve handoff via tool
    should_handoff = False
    handoff_reason = None
    for tc in state.get("llm_tool_calls", []):
        if tc.get("tool_name") == "transfer_to_human_tool" or tc.get("result") == "__HANDOFF_REQUESTED__":
            should_handoff = True
            handoff_reason = tc.get("args", {}).get("reason", "Handoff solicitado")
            break
    
    # Determinar resposta a enviar
    if should_handoff:
        from src.db.postgres import get_async_session
        from sqlalchemy import text
        
        async with get_async_session() as session:
            result = await session.execute(
                text("SELECT handoff_message FROM agent_configs WHERE tenant_id = :tid"),
                {"tid": state["tenant_id"]},
            )
            row = result.fetchone()
            handoff_msg = row[0] if row else "Estou transferindo para um atendente. Aguarde um momento."
        
        final_messages = [{"type": "text", "text": handoff_msg}]
    
    elif guard_triggered:
        if state.get("guard_rail_action") == "block":
            response_text = state.get("guard_rail_fallback") or "Posso ajudar com outras questões?"
        elif state.get("guard_rail_action") == "rewrite":
            # Pedir ao LLM para reescrever de forma mais segura
            response_text = await _rewrite_response(llm_response, state)
        elif state.get("guard_rail_action") == "handoff":
            should_handoff = True
            response_text = state.get("guard_rail_fallback") or "Vou transferir para um atendente."
        else:
            response_text = llm_response
        
        final_messages = [{"type": "text", "text": response_text}]
    
    else:
        # Dividir resposta longa em múltiplas mensagens (max 1000 chars por msg)
        final_messages = _split_into_messages(llm_response)
    
    # Adicionar mensagem do assistente ao histórico
    new_message = {
        "role": "assistant",
        "content": llm_response,
        "timestamp": int(__import__("time").time()),
    }
    
    return {
        "final_messages": final_messages,
        "should_handoff": should_handoff,
        "handoff_reason": handoff_reason,
        "messages": [new_message],  # Acumulado pelo operator.add
        "debug_trace": state.get("debug_trace", []) + [
            f"output_node:messages={len(final_messages)},handoff={should_handoff}"
        ],
    }


async def _rewrite_response(original: str, state: ConversationState) -> str:
    """Pede ao LLM para reescrever a resposta de forma mais segura."""
    from langchain_openai import ChatOpenAI
    
    llm = ChatOpenAI(model=settings.openai_model_simple, temperature=0.1)
    prompt = (
        f"Reescreva a seguinte resposta de assistente de forma que não mencione concorrentes, "
        f"não faça promessas de desconto, e mantenha-se dentro do escopo dos produtos da loja.\n\n"
        f"Resposta original: {original}\n\nResposta corrigida:"
    )
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return response.content


def _split_into_messages(text: str, max_chars: int = 1000) -> list[dict]:
    """Divide texto longo em múltiplas mensagens de WhatsApp."""
    if len(text) <= max_chars:
        return [{"type": "text", "text": text}]
    
    # Dividir em parágrafos
    paragraphs = text.split("\n\n")
    messages = []
    current = ""
    
    for p in paragraphs:
        if len(current) + len(p) + 2 <= max_chars:
            current = f"{current}\n\n{p}".strip()
        else:
            if current:
                messages.append({"type": "text", "text": current})
            current = p
    
    if current:
        messages.append({"type": "text", "text": current})
    
    return messages if messages else [{"type": "text", "text": text[:max_chars]}]
```

- [ ] **Step 3: Rodar testes**

```bash
uv run pytest tests/test_nodes.py -v
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/ai-orchestrator/src/graph/nodes.py
git commit -m "feat(ai): implement all langgraph nodes (entry, route, reasoning, guardrail, output)"
```

---

### Task 4: LangGraph Agent — Compilar o Grafo

**Files:**
- Create: `apps/ai-orchestrator/src/graph/agent.py`
- Test: `apps/ai-orchestrator/tests/test_agent.py`

- [ ] **Step 1: Escrever teste do grafo completo**

```python
# apps/ai-orchestrator/tests/test_agent.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

@pytest.mark.asyncio
async def test_agent_processes_text_message():
    from src.graph.agent import create_agent_graph
    
    # Mock todos os serviços externos
    with (
        patch("src.graph.nodes.PromptBuilderService") as MockPB,
        patch("src.graph.nodes._fetch_guard_rules", AsyncMock(return_value=[])),
        patch("src.graph.nodes._get_llm_with_tools") as mock_llm_fn,
        patch("src.graph.nodes.get_async_session"),
    ):
        mock_pb = MagicMock()
        mock_pb.build = AsyncMock(return_value="System prompt de teste")
        MockPB.return_value = mock_pb
        
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(
            content="Olá! Como posso ajudar com nossos produtos?",
            tool_calls=[],
        ))
        mock_llm_fn.return_value = mock_llm
        
        graph = create_agent_graph()
        
        initial_state = {
            "tenant_id": "tenant-123",
            "conversation_id": "conv-456",
            "contact_phone": "5511999999999",
            "current_message": "Oi, bom dia",
            "current_message_type": "text",
            "audio_transcript": None,
            "messages": [],
            "current_stage": "greeting",
            "cart": [],
            "agent_name": "Carla",
            "agent_tone": "FRIENDLY",
            "system_prompt": "",
            "business_hours_open": True,
            "llm_response": None,
            "llm_tool_calls": [],
            "guard_rail_triggered": False,
            "guard_rail_action": None,
            "guard_rail_reason": None,
            "guard_rail_fallback": None,
            "should_handoff": False,
            "handoff_reason": None,
            "final_messages": [],
            "debug_trace": [],
        }
        
        final_state = await graph.ainvoke(initial_state)
        
        assert len(final_state["final_messages"]) > 0
        assert final_state["should_handoff"] is False
        assert "Olá" in final_state["final_messages"][0]["text"]
```

- [ ] **Step 2: Implementar agent.py**

```python
# apps/ai-orchestrator/src/graph/agent.py
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.redis import AsyncRedisSaver
from src.graph.state import ConversationState
from src.graph.nodes import entry_node, route_node, reasoning_node, guard_rail_node, output_node
from src.config import settings


def _should_handoff(state: ConversationState) -> str:
    """Edge condicional: deve ir para handoff ou encerrar normalmente?"""
    if state.get("should_handoff"):
        return "handoff"
    return "end"


def _guard_rail_action(state: ConversationState) -> str:
    """Edge condicional após guard rail."""
    if state.get("guard_rail_triggered"):
        action = state.get("guard_rail_action", "block")
        if action == "handoff":
            return "force_handoff"
        return "output"  # Block ou rewrite: vai para output_node que trata
    return "output"


def create_agent_graph() -> StateGraph:
    """
    Cria e compila o grafo LangGraph para orquestração de conversas.
    
    Fluxo:
        entry → route → reasoning → guard_rail → output → [end | handoff]
    """
    builder = StateGraph(ConversationState)
    
    # Adicionar nós
    builder.add_node("entry", entry_node)
    builder.add_node("route", route_node)
    builder.add_node("reasoning", reasoning_node)
    builder.add_node("guard_rail", guard_rail_node)
    builder.add_node("output", output_node)
    
    # Ponto de entrada
    builder.set_entry_point("entry")
    
    # Arestas principais (diretas)
    builder.add_edge("entry", "route")
    builder.add_edge("route", "reasoning")
    builder.add_edge("reasoning", "guard_rail")
    
    # Aresta condicional após guard_rail
    builder.add_conditional_edges(
        "guard_rail",
        _guard_rail_action,
        {
            "output": "output",
            "force_handoff": "output",  # output_node detecta e seta should_handoff
        },
    )
    
    # Aresta condicional após output
    builder.add_conditional_edges(
        "output",
        _should_handoff,
        {
            "handoff": END,
            "end": END,
        },
    )
    
    # Compilar (sem checkpointer aqui — checkpointing gerenciado pelo SessionService)
    return builder.compile()


# Instância singleton
_agent_graph = None

def get_agent_graph() -> StateGraph:
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = create_agent_graph()
    return _agent_graph
```

- [ ] **Step 3: Rodar testes**

```bash
uv run pytest tests/test_agent.py -v
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/ai-orchestrator/src/graph/agent.py
git commit -m "feat(ai): compile langgraph stateful agent with conditional edges"
```

---

### Task 5: RabbitMQ Consumer/Publisher + FastAPI Entry Point

**Files:**
- Create: `apps/ai-orchestrator/src/consumers/rabbitmq.py`
- Create: `apps/ai-orchestrator/src/publishers/rabbitmq.py`
- Create: `apps/ai-orchestrator/src/main.py`

- [ ] **Step 1: Implementar consumer aio-pika**

```python
# apps/ai-orchestrator/src/consumers/rabbitmq.py
import asyncio
import json
import aio_pika
from aio_pika.abc import AbstractIncomingMessage
from src.config import settings
from src.graph.agent import get_agent_graph
from src.services.session import SessionService
from src.services.prompt_builder import PromptBuilderService
from src.publishers.rabbitmq import RabbitMQPublisher
import structlog

log = structlog.get_logger(__name__)


async def process_inbound_message(
    message: AbstractIncomingMessage,
    session_svc: SessionService,
    publisher: RabbitMQPublisher,
) -> None:
    """
    Processa uma mensagem inbound do RabbitMQ:
    1. Deserializa o evento
    2. Carrega/cria sessão Redis
    3. Executa grafo LangGraph
    4. Publica resposta no exchange ai
    """
    async with message.process():
        try:
            event = json.loads(message.body.decode())
            tenant_id = event["tenantId"]
            contact_phone = event["from"]
            wa_phone_id = event["whatsappPhoneId"]
            
            log.info("Processing inbound", tenant=tenant_id, phone=contact_phone)
            
            # Carregar ou criar sessão
            session = await session_svc.get_or_create(tenant_id, contact_phone)
            
            # Carregar config do agente
            pb = PromptBuilderService()
            agent_config = await pb.get_agent_config(tenant_id)
            
            # Montar estado inicial para o grafo
            current_text = event.get("text") or event.get("audioTranscript") or "[mídia sem texto]"
            
            initial_state = {
                "tenant_id": tenant_id,
                "conversation_id": session.conversation_id,
                "contact_phone": contact_phone,
                "current_message": current_text,
                "current_message_type": event.get("type", "text"),
                "audio_transcript": event.get("audioTranscript"),
                "messages": session.messages,
                "current_stage": session.current_stage,
                "cart": session.cart,
                "agent_name": agent_config.get("agent_name", "Assistente"),
                "agent_tone": agent_config.get("tone", "FRIENDLY"),
                "system_prompt": "",
                "business_hours_open": True,
                "llm_response": None,
                "llm_tool_calls": [],
                "guard_rail_triggered": False,
                "guard_rail_action": None,
                "guard_rail_reason": None,
                "guard_rail_fallback": None,
                "should_handoff": False,
                "handoff_reason": None,
                "final_messages": [],
                "debug_trace": [],
            }
            
            # Executar grafo
            graph = get_agent_graph()
            final_state = await graph.ainvoke(
                initial_state,
                config={"recursion_limit": settings.langgraph_recursion_limit},
            )
            
            # Atualizar sessão
            await session_svc.update(tenant_id, contact_phone, {
                "messages": final_state["messages"],
                "current_stage": final_state["current_stage"],
                "cart": final_state["cart"],
            })
            
            # Publicar resposta
            response_event = {
                "tenantId": tenant_id,
                "conversationId": session.conversation_id,
                "waPhoneId": wa_phone_id,
                "toPhone": contact_phone,
                "messages": final_state["final_messages"],
                "triggerHandoff": final_state.get("should_handoff", False),
                "handoffReason": final_state.get("handoff_reason"),
            }
            
            await publisher.publish_response(response_event)
            log.info("Response published", tenant=tenant_id, msgs=len(final_state["final_messages"]))
        
        except Exception as e:
            log.error("Failed to process message", error=str(e), exc_info=True)
            # Não reenfileirar — evitar poison message loop


async def start_consumer(
    session_svc: SessionService,
    publisher: RabbitMQPublisher,
) -> None:
    """Inicia o consumer RabbitMQ com retry automático."""
    retry_delay = 5
    
    while True:
        try:
            connection = await aio_pika.connect_robust(settings.rabbitmq_url)
            channel = await connection.channel()
            await channel.set_qos(prefetch_count=5)  # Processar 5 mensagens paralelas
            
            exchange = await channel.declare_exchange(
                "messages",
                aio_pika.ExchangeType.TOPIC,
                durable=True,
            )
            
            queue = await channel.declare_queue(
                "ai.process",
                durable=True,
                arguments={"x-message-ttl": 3600000},  # 1h TTL
            )
            
            await queue.bind(exchange, routing_key="msg.inbound")
            
            log.info("AI Orchestrator consumer started, waiting for messages...")
            
            await queue.consume(
                lambda msg: asyncio.ensure_future(
                    process_inbound_message(msg, session_svc, publisher)
                )
            )
            
            # Manter consumer rodando
            await asyncio.Future()
        
        except Exception as e:
            log.error(f"Consumer error, retrying in {retry_delay}s:", error=str(e))
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 60)  # Exponential backoff até 60s
```

- [ ] **Step 2: Implementar main.py FastAPI**

```python
# apps/ai-orchestrator/src/main.py
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from src.config import settings
from src.services.session import SessionService
from src.publishers.rabbitmq import RabbitMQPublisher
from src.consumers.rabbitmq import start_consumer
from src.db.postgres import create_db_engine

log = structlog.get_logger(__name__)

# Inicializar serviços globais
session_service: SessionService | None = None
publisher: RabbitMQPublisher | None = None
consumer_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup e shutdown da aplicação."""
    global session_service, publisher, consumer_task
    
    log.info("Starting AI Orchestrator...", env=settings.debug)
    
    # Inicializar DB
    await create_db_engine()
    
    # Inicializar serviços
    session_service = SessionService(settings.redis_url)
    await session_service.connect()
    
    publisher = RabbitMQPublisher(settings.rabbitmq_url)
    await publisher.connect()
    
    # Iniciar consumer em background
    consumer_task = asyncio.create_task(
        start_consumer(session_service, publisher)
    )
    
    log.info("AI Orchestrator started successfully!")
    
    yield
    
    # Shutdown
    log.info("Shutting down AI Orchestrator...")
    if consumer_task:
        consumer_task.cancel()
    if publisher:
        await publisher.close()
    if session_service:
        await session_service.close()


app = FastAPI(
    title="WhatsAgent AI Orchestrator",
    description="LangGraph-based conversational AI engine",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3002"],  # Back-office API apenas
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-orchestrator"}


@app.get("/graph/info")
async def graph_info():
    """Endpoint debug: informações do grafo LangGraph."""
    from src.graph.agent import get_agent_graph
    graph = get_agent_graph()
    return {"nodes": list(graph.nodes.keys()), "status": "compiled"}
```

- [ ] **Step 3: Iniciar e verificar**

```bash
cd apps/ai-orchestrator
uv run uvicorn src.main:app --reload --port 8000
# Em outro terminal:
curl http://localhost:8000/health
# Expected: {"status":"ok","service":"ai-orchestrator"}
curl http://localhost:8000/graph/info
# Expected: {"nodes":["entry","route","reasoning","guard_rail","output"],"status":"compiled"}
```

- [ ] **Step 4: Commit**

```bash
git add apps/ai-orchestrator/
git commit -m "feat(ai): complete ai orchestrator with langgraph, rabbitmq consumer/publisher"
```

---

### Task 6: PromptBuilderService e GuardRailService

**Files:**
- Create: `apps/ai-orchestrator/src/services/prompt_builder.py`
- Create: `apps/ai-orchestrator/src/services/guard_rail.py`
- Test: `apps/ai-orchestrator/tests/test_prompt_builder.py`

- [ ] **Step 1: Implementar PromptBuilderService**

```python
# apps/ai-orchestrator/src/services/prompt_builder.py
from src.db.postgres import get_async_session
from sqlalchemy import text
import structlog

log = structlog.get_logger(__name__)


class PromptBuilderService:
    
    TONE_INSTRUCTIONS = {
        "FORMAL": "Use linguagem formal e respeitosa. Evite gírias e expressões informais.",
        "INFORMAL": "Use linguagem descontraída e próxima. Use 'você' e seja acessível.",
        "FRIENDLY": "Seja caloroso, amigável e entusiasmado. Use emojis com moderação 😊",
        "TECHNICAL": "Seja preciso e técnico. Forneça detalhes específicos e dados quando solicitado.",
        "REGIONAL": "Use expressões regionais e linguagem característica da região.",
    }
    
    async def get_agent_config(self, tenant_id: str) -> dict:
        """Carrega configuração completa do agente do banco."""
        async with get_async_session() as session:
            result = await session.execute(
                text("""
                    SELECT agent_name, tone, greeting_message, business_hours,
                           llm_model, llm_temperature, handoff_message,
                           handoff_order_value_brl, auto_handoff_threshold,
                           system_prompt_base
                    FROM agent_configs
                    WHERE tenant_id = :tid
                """),
                {"tid": tenant_id},
            )
            row = result.fetchone()
            
            if not row:
                return {
                    "agent_name": "Assistente",
                    "tone": "FRIENDLY",
                    "greeting_message": "Olá! Como posso ajudar?",
                }
            
            return {
                "agent_name": row[0],
                "tone": row[1],
                "greeting_message": row[2],
                "business_hours": row[3],
                "llm_model": row[4],
                "llm_temperature": row[5],
                "handoff_message": row[6],
                "handoff_order_value_brl": row[7],
                "auto_handoff_threshold": row[8],
                "system_prompt_base": row[9],
            }
    
    async def build(
        self,
        tenant_id: str,
        agent_name: str = "Assistente",
        tone: str = "FRIENDLY",
        business_hours_open: bool = True,
    ) -> str:
        """
        Constrói o system prompt dinâmico para o agente do tenant.
        Combina: configuração base + regras do negócio + contexto atual.
        """
        config = await self.get_agent_config(tenant_id)
        
        # Buscar políticas e conhecimento base
        async with get_async_session() as session:
            result = await session.execute(
                text("""
                    SELECT name, content
                    FROM knowledge_bases
                    WHERE tenant_id = :tid AND type IN ('faq', 'text') AND is_indexed = true
                    ORDER BY created_at ASC
                    LIMIT 5
                """),
                {"tid": tenant_id},
            )
            kb_entries = result.fetchall()
        
        tone_instruction = self.TONE_INSTRUCTIONS.get(
            config.get("tone", tone), self.TONE_INSTRUCTIONS["FRIENDLY"]
        )
        
        # Construir prompt base
        agent_name_final = config.get("agent_name", agent_name)
        
        prompt_parts = [
            f"Você é {agent_name_final}, assistente virtual de atendimento e vendas.",
            "",
            "## Instruções de Comportamento",
            tone_instruction,
            "",
            "## Regras Obrigatórias",
            "- NUNCA invente preços, produtos ou informações que não constam no catálogo",
            "- NUNCA prometa prazos ou condições sem verificar",
            "- Se não souber a resposta, use as ferramentas disponíveis antes de responder",
            "- Sempre use a ferramenta catalog_search para buscar produtos",
            "- Sempre confirme o carrinho antes de gerar link de pagamento",
            "",
        ]
        
        if not business_hours_open:
            prompt_parts.extend([
                "## Horário de Atendimento",
                "⚠️ ATENÇÃO: O estabelecimento está FECHADO no momento.",
                "Informe o cliente e ofereça o horário de funcionamento.",
                "",
            ])
        
        # Adicionar base de conhecimento
        if kb_entries:
            prompt_parts.append("## Informações do Negócio")
            for name, content in kb_entries:
                prompt_parts.append(f"### {name}")
                prompt_parts.append(content[:2000])  # Limitar por entrada
                prompt_parts.append("")
        
        # System prompt personalizado do tenant
        if config.get("system_prompt_base"):
            prompt_parts.extend([
                "## Instruções Específicas do Negócio",
                config["system_prompt_base"],
                "",
            ])
        
        # Contexto de handoff
        if config.get("handoff_order_value_brl"):
            prompt_parts.append(
                f"- Pedidos acima de R$ {config['handoff_order_value_brl']:.2f} devem ser transferidos para atendente humano"
            )
        
        prompt_parts.extend([
            "",
            "## Ferramentas Disponíveis",
            "Use as ferramentas quando necessário. Não responda sobre produtos sem consultá-las.",
            "Ferramentas: catalog_search, get_stock, add_to_cart, generate_payment_link, ",
            "             verify_business_hours, transfer_to_human, get_conversation_history",
        ])
        
        return "\n".join(prompt_parts)
```

- [ ] **Step 2: Implementar GuardRailService**

```python
# apps/ai-orchestrator/src/services/guard_rail.py
import re
from dataclasses import dataclass
from typing import Optional
import structlog

log = structlog.get_logger(__name__)


@dataclass
class GuardRailResult:
    triggered: bool
    action: Optional[str] = None      # "block" | "rewrite" | "handoff" | "log_only"
    reason: Optional[str] = None
    fallback_message: Optional[str] = None


class GuardRailService:
    def __init__(self, rules: list[dict]):
        # Ordenar por prioridade (menor = maior prioridade)
        self.rules = sorted(rules, key=lambda r: r.get("priority", 100))
    
    async def validate(self, response_text: str, state: dict) -> GuardRailResult:
        """
        Valida a resposta do LLM contra todas as regras configuradas.
        Para na primeira regra que disparar (por prioridade).
        """
        for rule in self.rules:
            result = await self._check_rule(rule, response_text, state)
            if result.triggered:
                log.info(
                    "guard_rule triggered",
                    rule_type=rule["type"],
                    action=rule["action"],
                )
                return result
        
        return GuardRailResult(triggered=False)
    
    async def _check_rule(
        self, rule: dict, text: str, state: dict
    ) -> GuardRailResult:
        rule_type = rule.get("type", "")
        action = rule.get("action", "block").lower()
        fallback = rule.get("fallback_message")
        config = rule.get("config", {})
        
        triggered = False
        reason = None
        
        if rule_type == "TEXT_BLOCK":
            patterns = config.get("patterns", [])
            for pattern in patterns:
                if pattern.lower() in text.lower():
                    triggered = True
                    reason = f"Texto proibido encontrado: '{pattern}'"
                    break
        
        elif rule_type == "REGEX_MATCH":
            pattern = config.get("pattern", "")
            if pattern and re.search(pattern, text, re.IGNORECASE):
                triggered = True
                reason = f"Padrão regex disparado: {pattern}"
        
        elif rule_type == "NUMERIC_CAP":
            # Verificar se há números acima do limite configurado
            field = config.get("field", "")
            max_value = config.get("max", 0)
            
            if field == "discount_percent":
                # Procurar % de desconto na resposta
                discounts = re.findall(r"(\d+)\s*%\s*(?:de\s+)?desconto", text, re.IGNORECASE)
                for d in discounts:
                    if int(d) > max_value:
                        triggered = True
                        reason = f"Desconto de {d}% excede limite de {max_value}%"
                        break
        
        elif rule_type == "HANDOFF_TRIGGER":
            keywords = config.get("keywords", [])
            for kw in keywords:
                if kw.lower() in text.lower():
                    triggered = True
                    reason = f"Palavra-chave de handoff: '{kw}'"
                    break
        
        elif rule_type == "SEMANTIC_BLOCK":
            # Implementação futura: usar embeddings para bloqueio semântico
            # Por ora, usa lista de palavras similares
            patterns = config.get("patterns", [])
            for pattern in patterns:
                if pattern.lower() in text.lower():
                    triggered = True
                    reason = f"Conteúdo semanticamente bloqueado: '{pattern}'"
                    break
        
        if triggered:
            return GuardRailResult(
                triggered=True,
                action=action,
                reason=reason,
                fallback_message=fallback,
            )
        
        return GuardRailResult(triggered=False)
```

- [ ] **Step 3: Rodar todos os testes Python**

```bash
uv run pytest tests/ -v --cov=src --cov-report=term-missing
```

Expected: PASS — cobertura > 80%

- [ ] **Step 4: Commit**

```bash
git add apps/ai-orchestrator/src/services/
git commit -m "feat(ai): add prompt builder service and guard rail validation pipeline"
```

---

## Verificação do Plan 2

- [ ] AI Orchestrator sobe: `cd apps/ai-orchestrator && uv run uvicorn src.main:app --reload --port 8000`
- [ ] `curl http://localhost:8000/health` → `{"status":"ok"}`
- [ ] `curl http://localhost:8000/graph/info` → lista 5 nós
- [ ] Consumer RabbitMQ conectado (log: "AI Orchestrator consumer started")
- [ ] Publicar mensagem de teste no RabbitMQ Management (http://localhost:15672):
  - Exchange: `messages`, Routing key: `msg.inbound`
  - Payload: `{"tenantId":"dev-tenant-uuid","from":"5511999999999","whatsappPhoneId":"phone_id","waMessageId":"test123","timestamp":1700000000,"type":"text","text":"Olá, quero comprar"}`
  - Verificar: mensagem publicada em exchange `ai` com routing key `ai.response`
- [ ] `uv run pytest tests/ -v` → todos passando
- [ ] Guard rails bloqueiam resposta com texto proibido
- [ ] PromptBuilder constrói system prompt com KB do tenant
