import pytest
from src.graph.state import ConversationState, CartItem, MessageSummary


def test_initial_state_defaults():
    state = ConversationState(
        tenant_id="tenant-123",
        conversation_id="conv-456",
        contact_phone="5511999999999",
        current_message="Olá",
        current_message_type="text",
        audio_transcript=None,
        messages=[],
        current_stage="greeting",
        cart=[],
        agent_name="Carla",
        agent_tone="FRIENDLY",
        system_prompt="",
        business_hours_open=True,
        llm_response=None,
        llm_tool_calls=[],
        guard_rail_triggered=False,
        guard_rail_action=None,
        guard_rail_reason=None,
        guard_rail_fallback=None,
        should_handoff=False,
        handoff_reason=None,
        final_messages=[],
        debug_trace=[],
    )
    assert state["current_stage"] == "greeting"
    assert state["cart"] == []
    assert state["messages"] == []
    assert state["should_handoff"] is False
    assert state["guard_rail_triggered"] is False


def test_cart_item_total():
    item = CartItem(
        product_id="prod-1",
        product_name="Camiseta Preta",
        price_cents=5990,
        quantity=2,
    )
    assert item.subtotal_cents == 11980


def test_message_summary_serialization():
    msg = MessageSummary(role="user", content="Quero uma camiseta", timestamp=1700000000)
    data = msg.model_dump()
    assert data["role"] == "user"
    assert data["content"] == "Quero uma camiseta"
