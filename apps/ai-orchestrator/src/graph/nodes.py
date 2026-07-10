from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from src.graph.state import ConversationState
from src.graph.tools import ALL_TOOLS
from src.services.prompt_builder import PromptBuilderService
from src.services.guard_rail import GuardRailService
from src.config import settings
import structlog
import time
import base64
import httpx

log = structlog.get_logger(__name__)


def _get_llm_with_tools(model: str = None, temperature: float = None):
    from src.services.llm import get_llm_with_tools
    effective_model = model or settings.openai_model_simple
    effective_temp = temperature if temperature is not None else settings.openai_temperature
    return get_llm_with_tools(effective_model, ALL_TOOLS, temperature=effective_temp)


def _chunk_text(content) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                parts.append(str(block.get("text") or ""))
            else:
                parts.append(str(getattr(block, "text", None) or ""))
        return "".join(parts)
    return str(content)


async def _emit_known_text_as_stream(text: str) -> str:
    """Publica texto já gerado (ex.: 1ª chamada sem tools) como stream para o inbox."""
    from src.services.stream_context import emit_stream

    await emit_stream("ai_stream_started")
    if text:
        await emit_stream("ai_stream_token", {"token": text})
    await emit_stream("ai_stream_ended", {"status": "ok", "text": text})
    return text


async def _astream_final_text(llm, chat_messages: list) -> str:
    """Stream do LLM final (sem tools) → tokens no inbox via RabbitMQ ai.stream."""
    from src.services.stream_context import emit_stream

    await emit_stream("ai_stream_started")
    parts: list[str] = []
    try:
        async for chunk in llm.astream(chat_messages):
            text = _chunk_text(getattr(chunk, "content", None))
            if not text:
                continue
            parts.append(text)
            await emit_stream("ai_stream_token", {"token": text})
    except Exception as e:
        log.warning("astream_failed_fallback_ainvoke", error=str(e))
        response = await llm.ainvoke(chat_messages)
        text = _chunk_text(getattr(response, "content", None))
        if text:
            parts.append(text)
            await emit_stream("ai_stream_token", {"token": text})

    full = "".join(parts)
    await emit_stream("ai_stream_ended", {"status": "ok", "text": full})
    return full


async def _fetch_guard_rules(tenant_id: str) -> list[dict]:
    from src.db.postgres import get_async_session
    from sqlalchemy import text

    async with get_async_session() as session:
        result = await session.execute(
            text("""
                SELECT type, action, config, priority, "fallbackMessage"
                FROM "GuardRule"
                WHERE "tenantId" = :tid AND "isActive" = true
                ORDER BY priority ASC
            """),
            {"tid": tenant_id},
        )
        return [
            {
                "type": row[0],
                "action": row[1],
                "config": row[2],
                "priority": row[3],
                "fallback_message": row[4],
            }
            for row in result.fetchall()
        ]


async def entry_node(state: ConversationState) -> dict:
    log.info("entry_node", tenant=state["tenant_id"], phone=state["contact_phone"])

    pb = PromptBuilderService()
    system_prompt = await pb.build(
        tenant_id=state["tenant_id"],
        agent_name=state.get("agent_name", "Assistente"),
        tone=state.get("agent_tone", "FRIENDLY"),
        business_hours_open=state.get("business_hours_open", True),
        contact_name=state.get("contact_name"),
        contact_phone=state.get("contact_phone"),
    )

    return {
        "system_prompt": system_prompt,
        "debug_trace": state.get("debug_trace", []) + ["entry_node:completed"],
    }


async def route_node(state: ConversationState) -> dict:
    messages_count = len(state.get("messages", []))
    cart = state.get("cart", [])
    current_stage = state.get("current_stage", "greeting")

    new_stage = current_stage

    if messages_count == 0:
        new_stage = "greeting"
    elif cart and any("AWAITING_PAYMENT" in m.get("content", "") for m in state.get("messages", [])):
        new_stage = "payment"
    elif cart:
        new_stage = "negotiation"
    elif messages_count > 3:
        new_stage = "catalog"
    else:
        new_stage = "discovery"

    return {
        "current_stage": new_stage,
        "debug_trace": state.get("debug_trace", []) + [f"route_node:stage={new_stage}"],
    }


async def _build_image_message(text: str, image_url: str) -> HumanMessage:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(image_url)
            resp.raise_for_status()
            b64 = base64.b64encode(resp.content).decode()
        return HumanMessage(content=[
            {"type": "text", "text": text},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "low"}},
        ])
    except Exception as e:
        log.error("image_fetch_failed", error=str(e), url=image_url[:80])
        return HumanMessage(content=text)


async def reasoning_node(state: ConversationState) -> dict:
    from src.services.llm import get_llm
    from src.services.stream_context import emit_stream

    if not state.get("messages"):
        greeting = state.get("greeting_message") or "Olá! Como posso ajudar?"
        await emit_stream("ai_stream_started")
        await emit_stream("ai_stream_token", {"token": greeting})
        await emit_stream("ai_stream_ended", {"status": "ok", "text": greeting})
        return {
            "llm_response": greeting,
            "llm_tool_calls": [],
            "debug_trace": state.get("debug_trace", []) + ["reasoning_node:greeting_shortcircuit"],
        }

    has_image = bool(state.get("image_url"))
    tenant_model = state.get("llm_model") or settings.openai_model_simple
    tenant_temp = state.get("llm_temperature")
    effective_temp = tenant_temp if tenant_temp is not None else settings.openai_temperature

    if has_image:
        llm = get_llm(tenant_model, temperature=effective_temp)
    else:
        llm = _get_llm_with_tools(model=tenant_model, temperature=tenant_temp)

    chat_messages = [SystemMessage(content=state["system_prompt"])]

    for msg in state.get("messages", [])[-12:]:
        content = msg["content"] if isinstance(msg, dict) else msg.content
        role = msg["role"] if isinstance(msg, dict) else msg.role
        if role == "user":
            chat_messages.append(HumanMessage(content=content))
        elif role == "tool_context":
            chat_messages.append(SystemMessage(content=f"Contexto de ferramentas do turno anterior (use os IDs para chamar ferramentas sem buscar novamente):\n{content}"))
        else:
            chat_messages.append(AIMessage(content=content))

    current_msg = state["current_message"]
    if state.get("audio_transcript"):
        current_msg = f"[Áudio transcrito]: {state['audio_transcript']}"

    if has_image:
        image_text = current_msg if current_msg != "[O usuário enviou uma imagem]" else "O usuário enviou uma imagem. Descreva o que está vendo e ajude com base no conteúdo."
        chat_messages.append(SystemMessage(content="IMPORTANTE: Você tem capacidade de visão e PODE analisar imagens. Analise a imagem a seguir e responda ao cliente."))
        chat_messages.append(await _build_image_message(image_text, state["image_url"]))
    else:
        chat_messages.append(HumanMessage(content=current_msg))

    # Stream da 1ª chamada: se não houver tools, tokens vão ao inbox em tempo real.
    # Se houver tool_calls, descartamos tokens parciais e fazemos astream só no texto final.
    accumulated = None
    streamed_tokens: list[str] = []
    stream_started = False

    async for chunk in llm.astream(chat_messages):
        accumulated = chunk if accumulated is None else accumulated + chunk
        # Se já detectamos tool_calls, não publica tokens (resposta final vem depois).
        if getattr(accumulated, "tool_calls", None):
            continue
        text = _chunk_text(getattr(chunk, "content", None))
        if not text:
            continue
        if not stream_started:
            await emit_stream("ai_stream_started")
            stream_started = True
        streamed_tokens.append(text)
        await emit_stream("ai_stream_token", {"token": text})

    response = accumulated
    tool_calls = []
    if response is not None and getattr(response, "tool_calls", None):
        # Tokens parciais (se houver) não representam a resposta final.
        if stream_started:
            await emit_stream("ai_stream_ended", {"status": "replaced", "text": ""})
            stream_started = False
            streamed_tokens = []

        for tc in response.tool_calls:
            tool = next((t for t in ALL_TOOLS if t.name == tc["name"]), None)
            if tool:
                try:
                    result = await tool.ainvoke(
                        {
                            **tc["args"],
                            "tenant_id": state["tenant_id"],
                            "contact_id": state.get("contact_id") or "",
                            "contact_phone": state.get("contact_phone") or "",
                            "order_id": state.get("order_id") or "",
                        }
                    )
                    tool_calls.append({
                        "tool_name": tc["name"],
                        "args": tc["args"],
                        "result": result,
                        "error": None,
                    })
                except Exception as e:
                    tool_calls.append({
                        "tool_name": tc["name"],
                        "args": tc["args"],
                        "result": None,
                        "error": str(e),
                    })

    if tool_calls:
        tool_results_text = "\n".join(
            f"[{tc['tool_name']}]: {tc['result'] or tc['error']}"
            for tc in tool_calls
        )
        chat_messages.append(AIMessage(content=_chunk_text(getattr(response, "content", None))))
        chat_messages.append(HumanMessage(content=f"Resultados das ferramentas:\n{tool_results_text}"))
        plain_llm = get_llm(tenant_model, temperature=effective_temp)
        llm_text = await _astream_final_text(plain_llm, chat_messages)
    elif stream_started:
        llm_text = "".join(streamed_tokens)
        await emit_stream("ai_stream_ended", {"status": "ok", "text": llm_text})
    else:
        # Fallback (ex.: astream vazio) — ainvoke síncrono + emit one-shot.
        if response is None:
            response = await llm.ainvoke(chat_messages)
        llm_text = await _emit_known_text_as_stream(
            _chunk_text(getattr(response, "content", None))
        )

    return {
        "llm_response": llm_text,
        "llm_tool_calls": tool_calls,
        "debug_trace": state.get("debug_trace", []) + [
            f"reasoning_node:tools_called={[tc['tool_name'] for tc in tool_calls]}"
        ],
    }


async def guard_rail_node(state: ConversationState) -> dict:
    llm_response = state.get("llm_response", "") or ""

    if not llm_response:
        return {"guard_rail_triggered": False}

    rules = await _fetch_guard_rules(state["tenant_id"])
    guard = GuardRailService(rules)
    result = await guard.validate(llm_response, state)

    if result.triggered:
        log.warning(
            "guard_rail triggered",
            tenant=state["tenant_id"],
            action=result.action,
            reason=result.reason,
        )
        return {
            "guard_rail_triggered": True,
            "guard_rail_action": result.action,
            "guard_rail_reason": result.reason,
            "guard_rail_fallback": result.fallback_message,
            "debug_trace": state.get("debug_trace", []) + [
                f"guard_rail:triggered action={result.action}"
            ],
        }

    return {"guard_rail_triggered": False}


async def output_node(state: ConversationState) -> dict:
    from src.services.stream_context import emit_stream

    llm_response = state.get("llm_response", "") or ""
    guard_triggered = state.get("guard_rail_triggered", False)
    stream_replaced = False
    final_text_for_ui = llm_response

    should_handoff = False
    handoff_reason = None
    for tc in state.get("llm_tool_calls", []):
        tc_dict = tc if isinstance(tc, dict) else tc.__dict__
        if tc_dict.get("tool_name") == "transfer_to_human_tool" or tc_dict.get("result") == "__HANDOFF_REQUESTED__":
            should_handoff = True
            handoff_reason = tc_dict.get("args", {}).get("reason", "Handoff solicitado")
            break

    if should_handoff:
        handoff_msg = "Estou transferindo para um atendente. Aguarde um momento."
        try:
            from src.db.postgres import get_async_session
            from sqlalchemy import text
            async with get_async_session() as session:
                result = await session.execute(
                    text('SELECT "handoffMessage" FROM "AgentConfig" WHERE "tenantId" = :tid'),
                    {"tid": state["tenant_id"]},
                )
                row = result.fetchone()
                if row and row[0]:
                    handoff_msg = row[0]
        except Exception:
            pass

        final_messages = [{"type": "text", "text": handoff_msg}]
        final_text_for_ui = handoff_msg
        stream_replaced = True

    elif guard_triggered:
        if state.get("guard_rail_action") == "block":
            response_text = state.get("guard_rail_fallback") or "Posso ajudar com outras questões?"
            stream_replaced = True
        elif state.get("guard_rail_action") == "rewrite":
            response_text = await _rewrite_response(llm_response, state)
            stream_replaced = True
        elif state.get("guard_rail_action") == "handoff":
            should_handoff = True
            response_text = state.get("guard_rail_fallback") or "Vou transferir para um atendente."
            stream_replaced = True
        else:
            response_text = llm_response

        final_messages = [{"type": "text", "text": response_text}]
        final_text_for_ui = response_text

    else:
        max_chars = state.get("max_response_length") or 1000
        final_messages = _split_into_messages(llm_response, max_chars=max_chars)

    if stream_replaced:
        # Tokens pré-guard já foram ao inbox; avisa a UI para substituir o balão.
        await emit_stream(
            "ai_stream_ended",
            {"status": "replaced", "text": final_text_for_ui},
        )

    new_message = {
        "role": "assistant",
        "content": llm_response,
        "timestamp": int(time.time()),
    }

    messages_to_append = [new_message]

    # Persist tool results so next turn's LLM has product IDs and other context
    tool_calls = state.get("llm_tool_calls", [])
    relevant_tools = {"catalog_search_tool", "get_stock_tool", "knowledge_search_tool", "add_to_cart_tool"}
    tool_context_parts = [
        f"[{tc['tool_name']}]: {tc['result']}"
        for tc in tool_calls
        if isinstance(tc, dict) and tc.get("tool_name") in relevant_tools and tc.get("result")
    ]
    if tool_context_parts:
        messages_to_append.append({
            "role": "tool_context",
            "content": "\n".join(tool_context_parts),
            "timestamp": int(time.time()),
        })

    # Extract order_id from add_to_cart_tool result (tagged as [ORDER_ID:xxx])
    import re
    new_order_id = state.get("order_id")
    for tc in tool_calls:
        if isinstance(tc, dict) and tc.get("tool_name") == "add_to_cart_tool" and tc.get("result"):
            match = re.search(r"\[ORDER_ID:([^\]]+)\]", tc["result"])
            if match:
                new_order_id = match.group(1)
                break

    return {
        "final_messages": final_messages,
        "should_handoff": should_handoff,
        "order_id": new_order_id,
        "handoff_reason": handoff_reason,
        "messages": messages_to_append,
        "debug_trace": state.get("debug_trace", []) + [
            f"output_node:messages={len(final_messages)},handoff={should_handoff}"
        ],
    }


async def _rewrite_response(original: str, state: ConversationState) -> str:
    from langchain_openai import ChatOpenAI
    llm = ChatOpenAI(model=settings.openai_model_simple, temperature=0.1)
    prompt = (
        f"Reescreva a seguinte resposta de assistente de forma que não mencione concorrentes, "
        f"não faça promessas de desconto, e mantenha-se dentro do escopo dos produtos da loja.\n\n"
        f"Resposta original: {original}\n\nResposta corrigida:"
    )
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return response.content


def _split_into_messages(text: str, max_chars: int = 1000) -> list[dict]:
    if len(text) <= max_chars:
        return [{"type": "text", "text": text}]

    paragraphs = text.split("\n\n")
    messages = []
    current = ""

    for p in paragraphs:
        if len(current) + len(p) + 2 <= max_chars:
            current = f"{current}\n\n{p}".strip()
        else:
            if current:
                messages.append({"type": "text", "text": current})
            current = p

    if current:
        messages.append({"type": "text", "text": current})

    return messages if messages else [{"type": "text", "text": text[:max_chars]}]
