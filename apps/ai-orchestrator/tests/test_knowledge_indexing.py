import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_split_into_chunks_short_content():
    from src.services.knowledge_indexing import KnowledgeIndexingService
    svc = KnowledgeIndexingService()
    chunks = svc._split_into_chunks("Hello world", max_chars=500)
    assert chunks == ["Hello world"]


@pytest.mark.asyncio
async def test_split_into_chunks_long_content():
    from src.services.knowledge_indexing import KnowledgeIndexingService
    svc = KnowledgeIndexingService()
    content = ("A" * 300 + "\n\n") * 5
    chunks = svc._split_into_chunks(content, max_chars=500)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= 600


@pytest.mark.asyncio
async def test_index_calls_embed_for_each_chunk():
    from src.services.knowledge_indexing import KnowledgeIndexingService
    svc = KnowledgeIndexingService()
    svc._embeddings.embed = AsyncMock(return_value=[0.1] * 1536)

    fake_row = ("kb-1", ("A" * 300 + "\n\n") * 2, "text")
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.fetchone = MagicMock(return_value=fake_row)
    mock_session.execute = AsyncMock(return_value=mock_result)

    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    mock_ctx.__aexit__ = AsyncMock(return_value=False)

    with patch("src.services.knowledge_indexing.get_async_session", return_value=mock_ctx):
        count = await svc.index("kb-1", "tenant-1")

    assert count == 2
    assert svc._embeddings.embed.call_count == 2
