from fastapi import APIRouter, HTTPException, Query
from src.services.knowledge_indexing import KnowledgeIndexingService

router = APIRouter(prefix="/internal", tags=["internal"])
_indexing_service = KnowledgeIndexingService()


@router.post("/index-knowledge/{knowledge_base_id}")
async def index_knowledge_base(
    knowledge_base_id: str,
    tenant_id: str = Query(...),
):
    """Called by NestJS BullMQ processor to index a knowledge base item."""
    try:
        chunk_count = await _indexing_service.index(knowledge_base_id, tenant_id)
        return {"success": True, "chunk_count": chunk_count}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
