import re
from sqlalchemy import text
from src.services.embeddings import EmbeddingsService
from src.db.postgres import get_async_session


class KnowledgeIndexingService:
    def __init__(self):
        self._embeddings = EmbeddingsService()

    async def index(self, knowledge_base_id: str, tenant_id: str) -> int:
        async with get_async_session() as session:
            result = await session.execute(
                text("""
                    SELECT id, content, type FROM knowledge_bases
                    WHERE id = :id AND "tenantId" = :tenant_id
                """),
                {"id": knowledge_base_id, "tenant_id": tenant_id},
            )
            row = result.fetchone()
            if not row:
                raise ValueError(f"KnowledgeBase {knowledge_base_id} not found")

            chunks = self._split_into_chunks(row[1])

            await session.execute(
                text("DELETE FROM knowledge_chunks WHERE \"knowledgeBaseId\" = :id"),
                {"id": knowledge_base_id},
            )

            for i, chunk_text in enumerate(chunks):
                embedding = await self._embeddings.embed(chunk_text)
                embedding_str = f"[{','.join(str(v) for v in embedding)}]"
                await session.execute(
                    text("""
                        INSERT INTO knowledge_chunks
                            (id, "knowledgeBaseId", "tenantId", content, embedding, "chunkIndex")
                        VALUES (gen_random_uuid(), :kb_id, :tenant_id, :content, :embedding::vector, :idx)
                    """),
                    {
                        "kb_id": knowledge_base_id,
                        "tenant_id": tenant_id,
                        "content": chunk_text,
                        "embedding": embedding_str,
                        "idx": i,
                    },
                )

            await session.execute(
                text("""
                    UPDATE knowledge_bases
                    SET "isIndexed" = true, "indexedAt" = now(), "chunkCount" = :count
                    WHERE id = :id
                """),
                {"count": len(chunks), "id": knowledge_base_id},
            )

            return len(chunks)

    def _split_into_chunks(self, content: str, max_chars: int = 500) -> list[str]:
        paragraphs = re.split(r"\n{2,}", content.strip())
        chunks: list[str] = []
        current = ""
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            if len(current) + len(para) < max_chars:
                current = (current + "\n\n" + para).strip()
            else:
                if current:
                    chunks.append(current)
                current = para
        if current:
            chunks.append(current)
        return chunks or [content[:max_chars]]
