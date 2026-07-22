"""Contextvar para publicar tokens de stream sem poluir o ConversationState."""

from __future__ import annotations

import contextvars
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import structlog

log = structlog.get_logger(__name__)

# Callback assinado: (event_type, payload_dict) -> awaitable
StreamPublishFn = Callable[[str, dict[str, Any]], Awaitable[None]]

_stream_publish: contextvars.ContextVar[StreamPublishFn | None] = contextvars.ContextVar(
    "stream_publish",
    default=None,
)
_stream_meta: contextvars.ContextVar[dict[str, str] | None] = contextvars.ContextVar(
    "stream_meta",
    default=None,
)
# perf_counter() de quando a mensagem inbound chegou no orchestrator (§3.12) —
# usado para medir a latência ponta-a-ponta até o primeiro token de resposta.
_stream_received_at: contextvars.ContextVar[float | None] = contextvars.ContextVar(
    "stream_received_at",
    default=None,
)
_stream_first_token_logged: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "stream_first_token_logged",
    default=False,
)


@dataclass(frozen=True)
class StreamContextTokens:
    publish: contextvars.Token
    meta: contextvars.Token
    received_at: contextvars.Token
    first_token_logged: contextvars.Token


def set_stream_context(
    publish: StreamPublishFn,
    *,
    tenant_id: str,
    conversation_id: str,
    received_at: float | None = None,
) -> StreamContextTokens:
    publish_tok = _stream_publish.set(publish)
    meta_tok = _stream_meta.set(
        {
            "tenantId": tenant_id,
            "conversationId": conversation_id,
            "streamId": f"stream-{uuid.uuid4().hex[:16]}",
        }
    )
    received_at_tok = _stream_received_at.set(received_at)
    first_token_tok = _stream_first_token_logged.set(False)
    return StreamContextTokens(
        publish=publish_tok,
        meta=meta_tok,
        received_at=received_at_tok,
        first_token_logged=first_token_tok,
    )


def clear_stream_context(tokens: StreamContextTokens | None = None) -> None:
    if tokens is None:
        _stream_publish.set(None)
        _stream_meta.set(None)
        _stream_received_at.set(None)
        _stream_first_token_logged.set(False)
        return
    _stream_publish.reset(tokens.publish)
    _stream_meta.reset(tokens.meta)
    _stream_received_at.reset(tokens.received_at)
    _stream_first_token_logged.reset(tokens.first_token_logged)


def get_stream_meta() -> dict[str, str] | None:
    return _stream_meta.get()


def _maybe_log_first_token_latency(event: str) -> None:
    """Loga inbound→primeiro token uma única vez por turno (§3.12), ignorando
    tokens de streams subsequentes no mesmo turno (ex.: segunda chamada ao LLM
    após tool-calling) — só o primeiro token percebido pelo usuário importa."""
    if event != "ai_stream_token" or _stream_first_token_logged.get():
        return
    received_at = _stream_received_at.get()
    if received_at is None:
        return
    _stream_first_token_logged.set(True)
    meta = _stream_meta.get() or {}
    latency_ms = round((time.perf_counter() - received_at) * 1000)
    log.info(
        "ai_first_token_latency",
        latency_ms=latency_ms,
        tenant_id=meta.get("tenantId"),
        conversation_id=meta.get("conversationId"),
    )


async def emit_stream(event: str, extra: dict[str, Any] | None = None) -> None:
    """Fire-and-forget: falha de publish não derruba o turno."""
    _maybe_log_first_token_latency(event)
    publish = _stream_publish.get()
    meta = _stream_meta.get()
    if not publish or not meta:
        return
    payload = {**meta, **(extra or {})}
    try:
        await publish(event, payload)
    except Exception:
        # Log fica a cargo do publisher; aqui engolimos para não falhar o grafo.
        pass
