import json
import aio_pika
from src.config import settings
import structlog

log = structlog.get_logger(__name__)


class RabbitMQPublisher:
    def __init__(self, rabbitmq_url: str):
        self.rabbitmq_url = rabbitmq_url
        self._connection = None
        self._channel = None
        self._exchange = None

    async def connect(self):
        self._connection = await aio_pika.connect_robust(self.rabbitmq_url, heartbeat=60)
        self._channel = await self._connection.channel()
        self._exchange = await self._channel.declare_exchange(
            settings.rabbitmq_outbound_exchange,
            aio_pika.ExchangeType.TOPIC,
            durable=True,
        )
        log.info("RabbitMQ publisher connected")

    async def close(self):
        if self._connection:
            await self._connection.close()

    async def publish_response(self, event: dict) -> None:
        if not self._exchange:
            raise RuntimeError("Publisher not connected. Call connect() first.")

        body = json.dumps(event, ensure_ascii=False).encode()
        message = aio_pika.Message(
            body=body,
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await self._exchange.publish(
            message,
            routing_key=settings.rabbitmq_outbound_routing_key,
        )
        log.debug(
            "response_published",
            tenant=event.get("tenantId"),
            msgs=len(event.get("messages", [])),
        )

    async def publish_stream(self, event: str, payload: dict) -> None:
        """Tokens parciais para o inbox (ephemeral — não persiste)."""
        if not self._exchange:
            return

        body = json.dumps(
            {"event": event, "payload": payload},
            ensure_ascii=False,
        ).encode()
        message = aio_pika.Message(
            body=body,
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.NOT_PERSISTENT,
        )
        await self._exchange.publish(
            message,
            routing_key=settings.rabbitmq_stream_routing_key,
        )
