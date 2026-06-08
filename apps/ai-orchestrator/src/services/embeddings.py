from openai import AsyncOpenAI
from sqlalchemy import text
from src.config import settings
from src.db.postgres import get_async_session
import structlog

log = structlog.get_logger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


class EmbeddingsService:
    async def embed(self, text_input: str) -> list[float]:
        client = _get_client()
        response = await client.embeddings.create(
            model=settings.openai_embedding_model,
            input=text_input,
        )
        return response.data[0].embedding

    async def search_catalog(
        self,
        tenant_id: str,
        query: str,
        limit: int = 5,
    ):
        embedding = await self.embed(query)
        embedding_str = f"[{','.join(str(x) for x in embedding)}]"

        async with get_async_session() as session:
            result = await session.execute(
                text("""
                    SELECT id, name, description, "priceCents",
                           "stockQty", "reservedQty",
                           1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
                    FROM "Product"
                    WHERE "tenantId" = :tenant_id
                      AND status = 'ACTIVE'
                      AND "stockQty" > "reservedQty"
                    ORDER BY embedding <=> CAST(:embedding AS vector)
                    LIMIT :limit
                """),
                {
                    "embedding": embedding_str,
                    "tenant_id": tenant_id,
                    "limit": limit,
                },
            )
            rows = result.fetchall()

        class ProductRow:
            def __init__(self, row):
                self.id = str(row[0])
                self.name = row[1]
                self.description = row[2]
                self.price_cents = row[3]
                self.stock_qty = row[4]
                self.reserved_qty = row[5]
                self.similarity = row[6]

        return [ProductRow(r) for r in rows]

    async def index_product(self, product_id: str, text_to_embed: str) -> None:
        embedding = await self.embed(text_to_embed)
        embedding_str = f"[{','.join(str(x) for x in embedding)}]"

        async with get_async_session() as session:
            await session.execute(
                text("""
                    UPDATE "Product"
                    SET embedding = CAST(:embedding AS vector)
                    WHERE id = :product_id
                """),
                {"embedding": embedding_str, "product_id": product_id},
            )
        log.info("product_indexed", product_id=product_id)
