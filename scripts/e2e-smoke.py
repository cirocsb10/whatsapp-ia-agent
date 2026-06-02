import asyncio
import json
import os
import uuid

import aio_pika


RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")


async def main() -> None:
    tenant_id = os.getenv("SMOKE_TENANT_ID", "tenant-smoke")
    phone = os.getenv("SMOKE_PHONE", "5511999990000")
    wa_phone_id = os.getenv("SMOKE_WA_PHONE_ID", "phone-smoke")
    correlation_id = str(uuid.uuid4())

    connection = await aio_pika.connect_robust(RABBITMQ_URL)
    async with connection:
      channel = await connection.channel()

      inbound_exchange = await channel.declare_exchange("messages", aio_pika.ExchangeType.TOPIC, durable=True)
      outbound_exchange = await channel.declare_exchange("ai", aio_pika.ExchangeType.TOPIC, durable=True)
      queue = await channel.declare_queue(exclusive=True, auto_delete=True)
      await queue.bind(outbound_exchange, routing_key="ai.response")

      event = {
          "tenantId": tenant_id,
          "from": phone,
          "whatsappPhoneId": wa_phone_id,
          "type": "text",
          "text": "Ola, quero testar o agente",
          "conversationId": f"smoke-{correlation_id}",
          "waMessageId": f"wamid-smoke-{correlation_id}",
      }

      await inbound_exchange.publish(
          aio_pika.Message(json.dumps(event).encode(), content_type="application/json"),
          routing_key="msg.inbound",
      )
      print("Smoke event published. Waiting for ai.response...")

      try:
          message = await queue.get(timeout=30)
      except asyncio.TimeoutError:
          raise SystemExit("Response not received within 30s")

      async with message.process():
          body = json.loads(message.body.decode())
          if body.get("toPhone") != phone:
              raise SystemExit(f"Unexpected response phone: {body}")
          print("Response received!")
          print(json.dumps(body, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
