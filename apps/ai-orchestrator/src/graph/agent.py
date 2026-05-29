from langgraph.graph import StateGraph, END
from src.graph.state import ConversationState
from src.graph.nodes import entry_node, route_node, reasoning_node, guard_rail_node, output_node


def _should_handoff(state: ConversationState) -> str:
    if state.get("should_handoff"):
        return "handoff"
    return "end"


def _guard_rail_action(state: ConversationState) -> str:
    if state.get("guard_rail_triggered"):
        action = state.get("guard_rail_action", "block")
        if action == "handoff":
            return "force_handoff"
        return "output"
    return "output"


def create_agent_graph() -> StateGraph:
    builder = StateGraph(ConversationState)

    builder.add_node("entry", entry_node)
    builder.add_node("route", route_node)
    builder.add_node("reasoning", reasoning_node)
    builder.add_node("guard_rail", guard_rail_node)
    builder.add_node("output", output_node)

    builder.set_entry_point("entry")

    builder.add_edge("entry", "route")
    builder.add_edge("route", "reasoning")
    builder.add_edge("reasoning", "guard_rail")

    builder.add_conditional_edges(
        "guard_rail",
        _guard_rail_action,
        {
            "output": "output",
            "force_handoff": "output",
        },
    )

    builder.add_conditional_edges(
        "output",
        _should_handoff,
        {
            "handoff": END,
            "end": END,
        },
    )

    return builder.compile()


_agent_graph = None


def get_agent_graph() -> StateGraph:
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = create_agent_graph()
    return _agent_graph
