import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_knowledge_search_returns_results():
    from src.graph.tools import knowledge_search_tool

    fake_embedding = [0.1] * 1536
    fake_rows = [("Nosso horário é 9h-18h", "FAQ", 0.85)]

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.fetchall = MagicMock(return_value=fake_rows)
    mock_session.execute = AsyncMock(return_value=mock_result)

    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    mock_ctx.__aexit__ = AsyncMock(return_value=False)

    with patch("src.services.embeddings.EmbeddingsService.embed", AsyncMock(return_value=fake_embedding)), \
         patch("src.db.postgres.get_async_session", return_value=mock_ctx):
        result = await knowledge_search_tool.ainvoke({"query": "horário", "tenant_id": "t1"})

    assert "Nosso horário é 9h-18h" in result
    assert "[FAQ]" in result


@pytest.mark.asyncio
async def test_knowledge_search_returns_not_found():
    from src.graph.tools import knowledge_search_tool

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.fetchall = MagicMock(return_value=[])
    mock_session.execute = AsyncMock(return_value=mock_result)

    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    mock_ctx.__aexit__ = AsyncMock(return_value=False)

    with patch("src.services.embeddings.EmbeddingsService.embed", AsyncMock(return_value=[0.1] * 1536)), \
         patch("src.db.postgres.get_async_session", return_value=mock_ctx):
        result = await knowledge_search_tool.ainvoke({"query": "xyz", "tenant_id": "t1"})

    assert "Nenhuma informação" in result
