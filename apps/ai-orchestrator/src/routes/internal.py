import secrets

from fastapi import APIRouter, HTTPException, Query, Security
from fastapi.security import APIKeyHeader

from src.config import settings
from src.services.knowledge_indexing import KnowledgeIndexingService

router = APIRouter(prefix="/internal", tags=["internal"])
_indexing_service = KnowledgeIndexingService()

_internal_token_header = APIKeyHeader(name="x-internal-token", auto_error=False)


def _verify_internal_token(token: str | None) -> None:
    expected = settings.internal_api_token
    if not token or not expected or not secrets.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/index-knowledge/{knowledge_base_id}")
async def index_knowledge_base(
    knowledge_base_id: str,
    tenant_id: str = Query(...),
    token: str | None = Security(_internal_token_header),
):
    """Called by NestJS BullMQ processor to index a knowledge base item."""
    _verify_internal_token(token)
    try:
        chunk_count = await _indexing_service.index(knowledge_base_id, tenant_id)
        return {"success": True, "chunk_count": chunk_count}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal error") from e
