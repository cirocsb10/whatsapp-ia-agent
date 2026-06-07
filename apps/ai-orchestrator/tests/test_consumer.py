import json
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

os.environ["DEBUG"] = "false"

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
    "text": "Quero ver o cardapio",
    "conversationId": "conv-001",
    "contactId": "contact-001",
    "waMessageId": "wamid-001",
}

FAKE_FINAL_STATE = {
    "messages": [{"role": "user", "content": "Quero ver o cardapio"}],
    "current_stage": "CATALOG",
    "cart": [],
    "final_messages": [{"type": "text", "text": "Aqui esta nosso cardapio!"}],
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

    with patch("src.consumers.rabbitmq.get_agent_graph") as mock_graph_fn, patch(
        "src.consumers.rabbitmq.PromptBuilderService"
    ) as mock_pb_cls:
        mock_graph = AsyncMock()
        mock_graph.ainvoke.return_value = FAKE_FINAL_STATE
        mock_graph_fn.return_value = mock_graph
        mock_pb_cls.return_value = AsyncMock(
            get_agent_config=AsyncMock(return_value={"agent_name": "Bot", "tone": "FRIENDLY"})
        )

        await process_inbound_message(
            make_mock_message(SAMPLE_EVENT), mock_session_svc, mock_publisher
        )

    mock_session_svc.get_or_create.assert_called_once_with("tenant-001", "5511999990000", "conv-001")
    initial_state = mock_graph.ainvoke.call_args[0][0]
    assert initial_state["current_message"] == "Quero ver o cardapio"
    assert initial_state["tenant_id"] == "tenant-001"

    mock_publisher.publish_response.assert_called_once()
    published = mock_publisher.publish_response.call_args[0][0]
    assert published["toPhone"] == "5511999990000"
    assert published["waPhoneId"] == "phone-001"
    assert published["messages"] == [{"type": "text", "text": "Aqui esta nosso cardapio!"}]
    assert published["triggerHandoff"] is False
    assert published["currentStage"] == "CATALOG"
    assert published["contactId"] == "contact-001"


@pytest.mark.asyncio
async def test_process_inbound_uses_audio_transcript_when_text_missing():
    event = {**SAMPLE_EVENT, "text": None, "audioTranscript": "Quero saber o preco"}
    mock_session_svc = AsyncMock()
    mock_session_svc.get_or_create.return_value = MagicMock(
        conversation_id="conv-001", messages=[], current_stage="START", cart=[]
    )
    mock_publisher = AsyncMock()

    with patch("src.consumers.rabbitmq.get_agent_graph") as mock_graph_fn, patch(
        "src.consumers.rabbitmq.PromptBuilderService"
    ) as mock_pb_cls:
        mock_graph = AsyncMock()
        mock_graph.ainvoke.return_value = FAKE_FINAL_STATE
        mock_graph_fn.return_value = mock_graph
        mock_pb_cls.return_value = AsyncMock(get_agent_config=AsyncMock(return_value={}))

        await process_inbound_message(make_mock_message(event), mock_session_svc, mock_publisher)

    initial_state = mock_graph.ainvoke.call_args[0][0]
    assert initial_state["current_message"] == "Quero saber o preco"


@pytest.mark.asyncio
async def test_process_inbound_does_not_raise_on_graph_exception():
    mock_session_svc = AsyncMock()
    mock_session_svc.get_or_create.return_value = MagicMock(
        conversation_id="conv-001", messages=[], current_stage="START", cart=[]
    )
    mock_publisher = AsyncMock()

    with patch("src.consumers.rabbitmq.get_agent_graph") as mock_graph_fn, patch(
        "src.consumers.rabbitmq.PromptBuilderService"
    ) as mock_pb_cls:
        mock_graph = AsyncMock()
        mock_graph.ainvoke.side_effect = RuntimeError("LLM timeout")
        mock_graph_fn.return_value = mock_graph
        mock_pb_cls.return_value = AsyncMock(get_agent_config=AsyncMock(return_value={}))

        await process_inbound_message(
            make_mock_message(SAMPLE_EVENT), mock_session_svc, mock_publisher
        )

    mock_publisher.publish_response.assert_not_called()
