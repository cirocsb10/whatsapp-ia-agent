import asyncio
import json
import time
import aio_pika
from aio_pika.abc import AbstractIncomingMessage
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from src.config import settings
from src.graph.agent import get_agent_graph
from src.services.business_hours import is_business_open
from src.services.session import SessionService
from src.services.prompt_builder import PromptBuilderService
from src.publishers.rabbitmq import RabbitMQPublisher
import structlog

log = structlog.get_logger(__name__)


class InboundMessageEvent(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    tenant_id: str = Field(alias="tenantId", min_length=1, max_length=120)
    from_phone: str = Field(alias="from", min_length=1, max_length=40)
    whatsapp_phone_id: str = Field(alias="whatsappPhoneId", min_length=1, max_length=120)
    conversation_id: str | None = Field(default=None, alias="conversationId", max_length=120)
    conversation_status: str | None = Field(default=None, alias="conversationStatus")
    wa_message_id: str | None = Field(default=None, alias="waMessageId", max_length=200)
    message_id: str | None = Field(default=None, alias="messageId", max_length=200)
    message_type: str = Field(default="text", alias="type", max_length=30)
    text: str | None = Field(default=None, max_length=10_000)
    audio_id: str | None = Field(default=None, alias="audioId", max_length=200)
    audio_url: str | None = Field(default=None, alias="audioUrl", max_length=2000)
    audio_transcript: str | None = Field(default=None, alias="audioTranscript", max_length=10_000)
    image_id: str | None = Field(default=None, alias="imageId", max_length=200)
    image_url: str | None = Field(default=None, alias="imageUrl", max_length=2000)
    document_id: str | None = Field(default=None, alias="documentId", max_length=200)
    document_url: str | None = Field(default=None, alias="documentUrl", max_length=2000)
    document_name: str | None = Field(default=None, alias="documentName", max_length=500)
    contact_id: str | None = Field(default=None, alias="contactId", max_length=120)
    timestamp: int | None = Field(default=None)

    @field_validator("message_type")
    @classmethod
    def validate_message_type(cls, value: str) -> str:
        normalized = value.lower()
        allowed_types = {
            "text",
            "audio",
            "image",
            "document",
            "sticker",
            "reaction",
            "location",
            "contact",
            "template",
            "interactive",
            "system",
        }
        if normalized not in allowed_types:
            raise ValueError(f"Unsupported message type: {value}")
        return normalized


async def _fetch_draft_order_id(contact_id: str | None, tenant_id: str) -> str | None:
    if not contact_id:
        return None
    try:
        from src.db.postgres import get_async_session
        from sqlalchemy import text

        async with get_async_session() as session:
            result = await session.execute(
                text("""
                    SELECT id FROM "Order"
                    WHERE "contactId" = :cid AND "tenantId" = :tid AND status = 'DRAFT'
                    ORDER BY "createdAt" DESC LIMIT 1
                """),
                {"cid": contact_id, "tid": tenant_id},
            )
            row = result.fetchone()
            return str(row[0]) if row else None
    except Exception:
        return None


async def _fetch_contact_name(contact_id: str | None, tenant_id: str) -> str | None:
    if not contact_id:
        return None
    try:
        from src.db.postgres import get_async_session
        from sqlalchemy import text

        async with get_async_session() as session:
            result = await session.execute(
                text('SELECT name FROM "Contact" WHERE id = :cid AND "tenantId" = :tid'),
                {"cid": contact_id, "tid": tenant_id},
            )
            row = result.fetchone()
            return row[0] if row and row[0] else None
    except Exception:
        return None


async def process_inbound_message(
    message: AbstractIncomingMessage,
    session_svc: SessionService,
    publisher: RabbitMQPublisher,
) -> None:
    received_at = time.perf_counter()
    async with message.process():
        raw_event = json.loads(message.body.decode())
        try:
            event = InboundMessageEvent.model_validate(raw_event)
        except ValidationError as validation_error:
            log.warning(
                "Invalid inbound payload; message rejected",
                errors=validation_error.errors(),
            )
            raise

        if event.conversation_status in ("HUMAN_HANDOFF", "PAUSED"):
            log.info("Skipping AI — conversation assigned to human", conv=event.conversation_id)
            return

        try:
            tenant_id = event.tenant_id
            contact_phone = event.from_phone
            wa_phone_id = event.whatsapp_phone_id

            log.info("Processing inbound", tenant=tenant_id, phone=contact_phone)

            session = await session_svc.get_or_create(tenant_id, contact_phone, event.conversation_id)

            pb = PromptBuilderService()
            agent_config, contact_name, draft_order_id = await asyncio.gather(
                pb.get_agent_config(tenant_id),
                _fetch_contact_name(event.contact_id, tenant_id),
                _fetch_draft_order_id(event.contact_id, tenant_id),
            )
            # Session order_id takes precedence over DB (already set in current session)
            session_order_id = getattr(session, "order_id", None)
            active_order_id = session_order_id or draft_order_id

            if event.message_type == "image":
                current_text = event.text or "[O usuário enviou uma imagem]"
            else:
                current_text = event.text or event.audio_transcript or "[mídia sem texto]"

            initial_state = {
                "tenant_id": tenant_id,
                "conversation_id": session.conversation_id,
                "contact_phone": contact_phone,
                "contact_id": event.contact_id,
                "contact_name": contact_name,
                "order_id": active_order_id,
                "current_message": current_text,
                "current_message_type": event.message_type,
                "audio_transcript": event.audio_transcript,
                "image_url": event.image_url,
                "messages": session.messages,
                "current_stage": session.current_stage,
                "cart": session.cart,
                "agent_name": agent_config.get("agent_name", "Assistente"),
                "agent_tone": agent_config.get("tone", "FRIENDLY"),
                "greeting_message": agent_config.get("greeting_message") or "Olá! Como posso ajudar?",
                "llm_model": agent_config.get("llm_model") or "gpt-4o-mini",
                "llm_temperature": agent_config.get("llm_temperature") if agent_config.get("llm_temperature") is not None else 0.3,
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

            from src.services.stream_context import clear_stream_context, set_stream_context

            stream_tokens = set_stream_context(
                publisher.publish_stream,
                tenant_id=tenant_id,
                conversation_id=session.conversation_id,
                received_at=received_at,
            )
            try:
                graph = get_agent_graph()
                final_state = await graph.ainvoke(
                    initial_state,
                    config={"recursion_limit": settings.langgraph_recursion_limit},
                )
            finally:
                clear_stream_context(stream_tokens)

            session_ttl_hours = final_state.get("session_ttl_hours") or 24
            await session_svc.update(tenant_id, contact_phone, {
                "messages": [
                    m if isinstance(m, dict) else m.__dict__
                    for m in final_state["messages"]
                ],
                "current_stage": final_state["current_stage"],
                "cart": [
                    c if isinstance(c, dict) else c.__dict__
                    for c in final_state["cart"]
                ],
                "order_id": final_state.get("order_id"),
            }, ttl_seconds=session_ttl_hours * 3600)

            response_event = {
                "tenantId": tenant_id,
                "conversationId": session.conversation_id,
                "waPhoneId": wa_phone_id,
                "toPhone": contact_phone,
                "messages": final_state["final_messages"],
                "triggerHandoff": final_state.get("should_handoff", False),
                "handoffReason": final_state.get("handoff_reason"),
                "currentStage": final_state.get("current_stage"),
                "contactId": event.contact_id,
                "inactivityTimeoutMin": agent_config.get("inactivity_timeout_min") or 30,
            }

            await publisher.publish_response(response_event)
            log.info("Response published", tenant=tenant_id, msgs=len(final_state["final_messages"]))
        except Exception as processing_error:
            log.error("Failed to process message", error=str(processing_error), exc_info=True)


async def start_consumer(
    session_svc: SessionService,
    publisher: RabbitMQPublisher,
) -> None:
    retry_delay = 5

    while True:
        try:
            connection = await aio_pika.connect_robust(settings.rabbitmq_url, heartbeat=60)
            channel = await connection.channel()
            await channel.set_qos(prefetch_count=5)

            exchange = await channel.declare_exchange(
                "messages",
                aio_pika.ExchangeType.TOPIC,
                durable=True,
            )

            queue = await channel.declare_queue(
                "ai.process",
                durable=True,
                arguments={"x-message-ttl": 3600000},
            )

            await queue.bind(exchange, routing_key="msg.inbound")

            log.info("AI Orchestrator consumer started, waiting for messages...")

            await queue.consume(
                lambda msg: asyncio.ensure_future(
                    process_inbound_message(msg, session_svc, publisher)
                )
            )

            await asyncio.Future()

        except Exception as e:
            log.error(f"Consumer error, retrying in {retry_delay}s:", error=str(e))
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 60)
