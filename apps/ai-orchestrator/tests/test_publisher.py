import json
import os

import pytest

os.environ["DEBUG"] = "false"

from src.publishers.rabbitmq import RabbitMQPublisher


SAMPLE_RESPONSE = {
    "tenantId": "tenant-001",
    "conversationId": "conv-001",
    "waPhoneId": "phone-001",
    "toPhone": "5511999990000",
    "messages": [{"type": "text", "text": "Ola! Aqui esta o cardapio."}],
    "triggerHandoff": False,
    "handoffReason": None,
}


@pytest.mark.asyncio
async def test_publish_response_sends_json_to_exchange():
    publisher = RabbitMQPublisher(rabbitmq_url="amqp://test")

    class MockExchange:
        def __init__(self):
            self.calls = []

        async def publish(self, message, routing_key):
            self.calls.append((message, routing_key))

    mock_exchange = MockExchange()
    publisher._exchange = mock_exchange

    await publisher.publish_response(SAMPLE_RESPONSE)

    message, routing_key = mock_exchange.calls[0]
    body = json.loads(message.body.decode())
    assert body["toPhone"] == "5511999990000"
    assert body["messages"][0]["text"] == "Ola! Aqui esta o cardapio."
    assert routing_key == "ai.response"


@pytest.mark.asyncio
async def test_publish_response_raises_when_not_connected():
    publisher = RabbitMQPublisher(rabbitmq_url="amqp://test")
    with pytest.raises(RuntimeError, match="not connected"):
        await publisher.publish_response(SAMPLE_RESPONSE)
