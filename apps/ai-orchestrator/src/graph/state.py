from typing import Annotated, TypedDict, Optional, Any
from pydantic import BaseModel, computed_field
import operator


class CartItem(BaseModel):
    product_id: str
    product_name: str
    price_cents: int
    quantity: int
    variation_selected: dict[str, str] = {}

    @computed_field
    @property
    def subtotal_cents(self) -> int:
        return self.price_cents * self.quantity


class MessageSummary(BaseModel):
    role: str  # "user" | "assistant"
    content: str
    timestamp: int  # Unix


class ToolCall(BaseModel):
    tool_name: str
    args: dict[str, Any]
    result: Any
    error: Optional[str] = None


class ConversationState(TypedDict):
    # Identifiers
    tenant_id: str
    conversation_id: str
    contact_phone: str

    # Current message being processed
    current_message: str
    current_message_type: str  # "text" | "audio" | "image"
    audio_transcript: Optional[str]
    image_url: Optional[str]

    # Conversation history (Annotated with operator.add = accumulative)
    messages: Annotated[list[MessageSummary], operator.add]

    # Current conversation stage
    current_stage: str  # "greeting" | "discovery" | "catalog" | "negotiation" | "payment"

    # Shopping cart
    cart: list[CartItem]

    # Tenant context
    agent_name: str
    agent_tone: str
    greeting_message: str
    llm_model: str
    llm_temperature: float
    max_response_length: int
    session_ttl_hours: int
    system_prompt: str
    business_hours_open: bool

    # LLM result (reasoning node)
    llm_response: Optional[str]
    llm_tool_calls: list[ToolCall]

    # Guard rail
    guard_rail_triggered: bool
    guard_rail_action: Optional[str]  # "block" | "rewrite" | "handoff"
    guard_rail_reason: Optional[str]
    guard_rail_fallback: Optional[str]

    # Handoff
    should_handoff: bool
    handoff_reason: Optional[str]

    # Final response to send
    final_messages: list[dict]  # [{"type": "text", "text": "..."}, ...]

    # Debug (dev only)
    debug_trace: list[str]
