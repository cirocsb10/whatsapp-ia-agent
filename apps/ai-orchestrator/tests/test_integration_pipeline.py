"""
Integration tests for the full LangGraph conversation pipeline.
External dependencies (DB, LLM, RabbitMQ) are mocked.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def make_mock_llm_response(content: str):
    mock_response = MagicMock()
    mock_response.content = content
    mock_response.tool_calls = []
    return mock_response


@pytest.fixture
def base_state():
    return {
        "tenant_id": "tenant-test",
        "conversation_id": "conv-001",
        "contact_phone": "5511999999999",
        "current_message": "Qual o horário de atendimento?",
        "current_message_type": "text",
        "audio_transcript": None,
        "messages": [],
        "current_stage": "greeting",
        "cart": [],
        "agent_name": "Assistente",
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


@pytest.mark.asyncio
async def test_full_pipeline_happy_path(base_state):
    from src.graph.agent import create_agent_graph

    mock_llm_response = make_mock_llm_response("Atendemos de segunda a sexta, das 9h às 18h.")

    with (
        patch("src.graph.nodes.PromptBuilderService") as MockPB,
        patch("src.graph.nodes._fetch_guard_rules", AsyncMock(return_value=[])),
        patch("src.graph.nodes._get_llm_with_tools") as mock_get_llm,
    ):
        mock_pb = MagicMock()
        mock_pb.build = AsyncMock(return_value="System prompt de teste")
        MockPB.return_value = mock_pb

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=mock_llm_response)
        mock_get_llm.return_value = mock_llm

        graph = create_agent_graph()
        result = await graph.ainvoke(base_state)

    assert len(result["final_messages"]) > 0
    assert result["guard_rail_triggered"] is False
    assert result["should_handoff"] is False


@pytest.mark.asyncio
async def test_pipeline_guard_rail_block(base_state):
    from src.graph.agent import create_agent_graph

    block_rule = {
        "id": "rule-1",
        "tenant_id": "tenant-test",
        "name": "Block competitor",
        "type": "TEXT_BLOCK",
        "action": "BLOCK",
        "priority": 10,
        "is_active": True,
        "config": {"patterns": ["concorrente"]},
        "fallback_message": "Não posso falar sobre isso.",
    }

    mock_llm_response = make_mock_llm_response("Nossa concorrente cobra mais barato.")
    # Precisa de histórico para não cair no greeting shortcircuit.
    base_state["messages"] = [
        {"role": "user", "content": "oi", "timestamp": 1},
        {"role": "assistant", "content": "olá", "timestamp": 2},
    ]

    async def fake_astream(_messages):
        yield mock_llm_response

    with (
        patch("src.graph.nodes.PromptBuilderService") as MockPB,
        patch("src.graph.nodes._fetch_guard_rules", AsyncMock(return_value=[block_rule])),
        patch("src.graph.nodes._get_llm_with_tools") as mock_get_llm,
    ):
        mock_pb = MagicMock()
        mock_pb.build = AsyncMock(return_value="System prompt")
        MockPB.return_value = mock_pb

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=mock_llm_response)
        mock_llm.astream = fake_astream
        mock_get_llm.return_value = mock_llm

        graph = create_agent_graph()
        result = await graph.ainvoke(base_state)

    assert result["guard_rail_triggered"] is True
    assert result["final_messages"]
    assert "Não posso falar sobre isso" in result["final_messages"][0]["text"]
