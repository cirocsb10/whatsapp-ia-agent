"""Contextvar para publicar tokens de stream sem poluir o ConversationState."""

from __future__ import annotations

import contextvars
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

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


@dataclass(frozen=True)
class StreamContextTokens:
    publish: contextvars.Token
    meta: contextvars.Token


def set_stream_context(
    publish: StreamPublishFn,
    *,
    tenant_id: str,
    conversation_id: str,
) -> StreamContextTokens:
    publish_tok = _stream_publish.set(publish)
    meta_tok = _stream_meta.set(
        {
            "tenantId": tenant_id,
            "conversationId": conversation_id,
            "streamId": f"stream-{uuid.uuid4().hex[:16]}",
        }
    )
    return StreamContextTokens(publish=publish_tok, meta=meta_tok)


def clear_stream_context(tokens: StreamContextTokens | None = None) -> None:
    if tokens is None:
        _stream_publish.set(None)
        _stream_meta.set(None)
        return
    _stream_publish.reset(tokens.publish)
    _stream_meta.reset(tokens.meta)


def get_stream_meta() -> dict[str, str] | None:
    return _stream_meta.get()


async def emit_stream(event: str, extra: dict[str, Any] | None = None) -> None:
    """Fire-and-forget: falha de publish não derruba o turno."""
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
