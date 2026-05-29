import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json


@pytest.mark.asyncio
async def test_catalog_search_returns_products():
    from src.graph.tools import catalog_search_tool

    mock_product = MagicMock()
    mock_product.name = "Camiseta Preta Premium"
    mock_product.description = "100% algodão"
    mock_product.price_cents = 5990
    mock_product.stock_qty = 10
    mock_product.reserved_qty = 0
    mock_product.id = "prod-uuid-1"

    with patch("src.graph.tools._vector_search", AsyncMock(return_value=[mock_product])):
        result = await catalog_search_tool.ainvoke({
            "query": "camiseta preta",
            "tenant_id": "tenant-123",
        })

    assert "Camiseta Preta Premium" in result
    assert "R$ 59,90" in result
    assert "10 em estoque" in result


@pytest.mark.asyncio
async def test_get_stock_returns_quantity():
    from src.graph.tools import get_stock_tool

    with patch("src.graph.tools._get_product_stock", AsyncMock(return_value={"qty": 5, "reserved": 1})):
        result = await get_stock_tool.ainvoke({
            "product_id": "prod-uuid-1",
            "tenant_id": "tenant-123",
        })

    assert "4" in result


@pytest.mark.asyncio
async def test_verify_hours_returns_open_status():
    from src.graph.tools import verify_business_hours_tool

    hours_config = {
        "mon": {"open": "00:00", "close": "23:59", "active": True},
        "tue": {"open": "00:00", "close": "23:59", "active": True},
        "wed": {"open": "00:00", "close": "23:59", "active": True},
        "thu": {"open": "00:00", "close": "23:59", "active": True},
        "fri": {"open": "00:00", "close": "23:59", "active": True},
        "sat": {"open": "00:00", "close": "23:59", "active": True},
        "sun": {"open": "00:00", "close": "23:59", "active": True},
    }

    result = await verify_business_hours_tool.ainvoke({
        "tenant_id": "tenant-123",
        "hours_config": json.dumps(hours_config),
        "timezone": "America/Sao_Paulo",
    })

    assert isinstance(result, str)
    assert "aberto" in result.lower() or "fechado" in result.lower()


@pytest.mark.asyncio
async def test_transfer_to_human_returns_sentinel():
    from src.graph.tools import transfer_to_human_tool

    result = await transfer_to_human_tool.ainvoke({
        "tenant_id": "tenant-123",
        "conversation_id": "conv-456",
        "reason": "Cliente pediu atendente humano",
        "urgency": "high",
    })

    assert result == "__HANDOFF_REQUESTED__"
