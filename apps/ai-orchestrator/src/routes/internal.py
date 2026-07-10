"""Internal HTTP endpoints called by NestJS services (knowledge indexing, chat simulate)."""

from __future__ import annotations

import secrets
import uuid

import structlog
from fastapi import APIRouter, HTTPException, Query, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

from src.config import settings
from src.graph.agent import get_agent_graph
from src.services.business_hours import is_business_open
from src.services.knowledge_indexing import KnowledgeIndexingService
from src.services.prompt_builder import PromptBuilderService

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/internal", tags=["internal"])
_indexing_service = KnowledgeIndexingService()

_internal_token_header = APIKeyHeader(name="x-internal-token", auto_error=False)


def _verify_internal_token(token: str | None) -> None:
    expected = settings.internal_api_token
    if not token or not expected or not secrets.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/index-knowledge/{knowledge_base_id}")
async def index_knowledge_base(
    knowledge_base_id: str,
    tenant_id: str = Query(...),
    token: str | None = Security(_internal_token_header),
):
    """Called by NestJS BullMQ processor to index a knowledge base item."""
    _verify_internal_token(token)
    try:
        chunk_count = await _indexing_service.index(knowledge_base_id, tenant_id)
        return {"success": True, "chunk_count": chunk_count}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        log.exception("knowledge_indexing_error", knowledge_base_id=knowledge_base_id, error=str(e))
        raise HTTPException(status_code=500, detail="Internal error") from e


class SimulateRequest(BaseModel):
    tenant_id: str = Field(alias="tenantId")
    message: str

    model_config = {"populate_by_name": True}


@router.post("/simulate")
async def simulate_chat(
    body: SimulateRequest,
    token: str | None = Security(_internal_token_header),
):
    """
    Dry-run do grafo LangGraph para o TestSimulator do back-office.

    Roda o mesmo pipeline de produção (persona, tools, RAG, guard-rails),
    mas NÃO publica em RabbitMQ nem envia WhatsApp.
    """
    _verify_internal_token(token)

    tenant_id = body.tenant_id
    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    try:
        pb = PromptBuilderService()
        agent_config = await pb.get_agent_config(tenant_id)

        conversation_id = f"sim-{tenant_id}-{uuid.uuid4().hex[:12]}"
        contact_phone = f"sim-{tenant_id[:8]}"

        initial_state = {
            "tenant_id": tenant_id,
            "conversation_id": conversation_id,
            "contact_phone": contact_phone,
            "contact_id": None,
            "contact_name": "Simulador",
            "order_id": None,
            "current_message": message,
            "current_message_type": "text",
            "audio_transcript": None,
            "image_url": None,
            "messages": [],
            "current_stage": "greeting",
            "cart": [],
            "agent_name": agent_config.get("agent_name", "Assistente"),
            "agent_tone": agent_config.get("tone", "FRIENDLY"),
            "greeting_message": agent_config.get("greeting_message") or "Olá! Como posso ajudar?",
            "llm_model": agent_config.get("llm_model") or "gpt-4o-mini",
            "llm_temperature": (
                agent_config.get("llm_temperature")
                if agent_config.get("llm_temperature") is not None
                else 0.3
            ),
            "max_response_length": agent_config.get("max_response_length") or 500,
            "session_ttl_hours": agent_config.get("session_ttl_hours") or 24,
            "system_prompt": "",
            "business_hours_open": is_business_open(agent_config.get("business_hours")),
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

        graph = get_agent_graph()
        final_state = await graph.ainvoke(
            initial_state,
            config={"recursion_limit": settings.langgraph_recursion_limit},
        )

        texts: list[str] = []
        for m in final_state.get("final_messages") or []:
            if isinstance(m, dict) and m.get("text"):
                texts.append(str(m["text"]))
            elif isinstance(m, dict) and m.get("type") == "image":
                texts.append("[imagem]")

        reply = "\n\n".join(texts).strip() or "Não consegui gerar uma resposta agora."
        return {
            "reply": reply,
            "shouldHandoff": bool(final_state.get("should_handoff")),
            "handoffReason": final_state.get("handoff_reason"),
        }
    except Exception as e:
        log.exception("simulate_error", tenant_id=tenant_id, error=str(e))
        raise HTTPException(status_code=500, detail="Simulate failed") from e
