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
    async with message.process():
        try:
            event = json.loads(message.body.decode())
            tenant_id = event["tenantId"]
            contact_phone = event["from"]
            wa_phone_id = event["whatsappPhoneId"]

            log.info("Processing inbound", tenant=tenant_id, phone=contact_phone)

            session = await session_svc.get_or_create(tenant_id, contact_phone)

            pb = PromptBuilderService()
            agent_config = await pb.get_agent_config(tenant_id)

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

            graph = get_agent_graph()
            final_state = await graph.ainvoke(
                initial_state,
                config={"recursion_limit": settings.langgraph_recursion_limit},
            )

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
            })

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


async def start_consumer(
    session_svc: SessionService,
    publisher: RabbitMQPublisher,
) -> None:
    retry_delay = 5

    while True:
        try:
            connection = await aio_pika.connect_robust(settings.rabbitmq_url)
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
