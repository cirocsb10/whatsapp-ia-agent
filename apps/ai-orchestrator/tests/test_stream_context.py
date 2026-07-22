import time
import pytest
import structlog


@pytest.mark.asyncio
async def test_emit_stream_logs_first_token_latency_once(caplog):
    """§3.12: inbound→primeiro token deve ser logado uma única vez por turno,
    ignorando tokens subsequentes (mesmo turno) e streams sem received_at."""
    from src.services.stream_context import (
        clear_stream_context,
        emit_stream,
        set_stream_context,
    )

    published = []

    async def fake_publish(event: str, payload: dict) -> None:
        published.append((event, payload))

    cap = structlog.testing.LogCapture()
    structlog.configure(processors=[cap])

    tokens = set_stream_context(
        fake_publish,
        tenant_id="tenant-1",
        conversation_id="conv-1",
        received_at=time.perf_counter(),
    )
    try:
        await emit_stream("ai_stream_started")
        await emit_stream("ai_stream_token", {"token": "Olá"})
        await emit_stream("ai_stream_token", {"token": " mundo"})
        await emit_stream("ai_stream_ended", {"status": "ok", "text": "Olá mundo"})
    finally:
        clear_stream_context(tokens)
        structlog.reset_defaults()

    latency_logs = [e for e in cap.entries if e.get("event") == "ai_first_token_latency"]
    assert len(latency_logs) == 1
    assert latency_logs[0]["tenant_id"] == "tenant-1"
    assert latency_logs[0]["conversation_id"] == "conv-1"
    assert isinstance(latency_logs[0]["latency_ms"], int)
    assert latency_logs[0]["latency_ms"] >= 0

    # Todos os eventos ainda foram publicados normalmente (log não interfere no stream).
    assert [e for e, _ in published] == [
        "ai_stream_started", "ai_stream_token", "ai_stream_token", "ai_stream_ended",
    ]


@pytest.mark.asyncio
async def test_emit_stream_skips_latency_log_without_received_at():
    """Sem `received_at` (ex.: contexto não seteado), não deve logar nem quebrar."""
    from src.services.stream_context import (
        clear_stream_context,
        emit_stream,
        set_stream_context,
    )

    async def fake_publish(event: str, payload: dict) -> None:
        pass

    tokens = set_stream_context(fake_publish, tenant_id="tenant-1", conversation_id="conv-1")
    try:
        await emit_stream("ai_stream_token", {"token": "Oi"})
    finally:
        clear_stream_context(tokens)
