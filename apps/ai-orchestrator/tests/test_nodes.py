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
async def test_entry_node_sets_system_prompt():
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
        "priority": 1,
    }]

    with patch("src.graph.nodes._fetch_guard_rules", AsyncMock(return_value=mock_rules)):
        result = await guard_rail_node(state)

    assert result["guard_rail_triggered"] is True
    assert result["guard_rail_action"] == "rewrite"


@pytest.mark.asyncio
async def test_output_node_detects_handoff_sentinel():
    from src.graph.nodes import output_node

    state = make_state(
        llm_response="Um momento, vou transferir para um atendente.",
        llm_tool_calls=[{
            "tool_name": "transfer_to_human_tool",
            "args": {"reason": "Solicitado pelo cliente"},
            "result": "__HANDOFF_REQUESTED__",
            "error": None,
        }],
    )

    result = await output_node(state)
    assert result["should_handoff"] is True


@pytest.mark.asyncio
async def test_route_node_sets_greeting_for_new_conversation():
    from src.graph.nodes import route_node

    state = make_state(messages=[])
    result = await route_node(state)
    assert result["current_stage"] == "greeting"
