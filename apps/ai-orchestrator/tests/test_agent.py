import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_agent_processes_text_message():
    from src.graph.agent import create_agent_graph

    with (
        patch("src.graph.nodes.PromptBuilderService") as MockPB,
        patch("src.graph.nodes._fetch_guard_rules", AsyncMock(return_value=[])),
        patch("src.graph.nodes._get_llm_with_tools") as mock_llm_fn,
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


@pytest.mark.asyncio
async def test_agent_graph_has_expected_nodes():
    from src.graph.agent import create_agent_graph
    graph = create_agent_graph()
    node_names = list(graph.nodes.keys())
    assert "entry" in node_names
    assert "route" in node_names
    assert "reasoning" in node_names
    assert "guard_rail" in node_names
    assert "output" in node_names
