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
    # Estoque não faz mais parte do resultado da busca — é responsabilidade do
    # get_stock_tool (checagem em tempo real), ver test_get_stock_returns_quantity.


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


def _mock_order_session(*, total_cents: int, item_name: str, item_qty: int):
    """Sessão SQLAlchemy mocada para o fluxo feliz do add_to_cart_tool: sem pedido
    DRAFT existente, sem item existente no pedido — cobre os 7 execute() do tool
    (lookup pedido, insert pedido, lookup item, insert item, soma total, update
    total, listagem de itens para o resumo)."""
    no_existing_order = MagicMock(fetchone=MagicMock(return_value=None))
    insert_order = MagicMock(fetchone=MagicMock(return_value=("order-uuid-1",)))
    no_existing_item = MagicMock(fetchone=MagicMock(return_value=None))
    insert_item = MagicMock()
    total_row = MagicMock(fetchone=MagicMock(return_value=(total_cents,)))
    update_order = MagicMock()
    items_result = MagicMock(fetchall=MagicMock(return_value=[(item_name, item_qty, total_cents)]))

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(side_effect=[
        no_existing_order, insert_order, no_existing_item, insert_item,
        total_row, update_order, items_result,
    ])
    mock_session.commit = AsyncMock()

    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    mock_ctx.__aexit__ = AsyncMock(return_value=False)
    return mock_ctx


@pytest.mark.asyncio
async def test_add_to_cart_uses_db_price_not_llm_price():
    """VULN-06: add_to_cart_tool must ignore LLM-supplied price and use DB price."""
    from src.graph.tools import add_to_cart_tool

    db_product = {"name": "Camiseta Preta", "price_cents": 5990, "available_qty": 10}
    mock_ctx = _mock_order_session(total_cents=11980, item_name="Camiseta Preta", item_qty=2)

    with patch("src.graph.tools._get_authoritative_price", AsyncMock(return_value=db_product)), \
         patch("src.db.postgres.get_async_session", return_value=mock_ctx):
        # LLM não informa preço nem nome — o tool sempre busca ambos no DB (VULN-06).
        result = await add_to_cart_tool.ainvoke({
            "product_id": "prod-uuid-1",
            "quantity": 2,
            "tenant_id": "tenant-123",
            "contact_id": "contact-1",
            "contact_phone": "5511999999999",
        })

    # Must show authoritative price (R$ 119,80 = 5990*2/100), not attacker price
    assert "119,80" in result
    assert "Camiseta Preta" in result


@pytest.mark.asyncio
async def test_add_to_cart_returns_error_when_product_not_found():
    """VULN-06: add_to_cart_tool returns error when product not in DB."""
    from src.graph.tools import add_to_cart_tool

    with patch("src.graph.tools._get_authoritative_price", AsyncMock(return_value=None)):
        result = await add_to_cart_tool.ainvoke({
            "product_id": "fake-id",
            "quantity": 1,
            "tenant_id": "tenant-123",
            "contact_id": "contact-1",
            "contact_phone": "5511999999999",
        })

    assert "não encontrado" in result.lower()


@pytest.mark.asyncio
async def test_add_to_cart_blocks_when_insufficient_stock():
    """add_to_cart_tool must reject quantity exceeding available_qty."""
    from src.graph.tools import add_to_cart_tool

    db_product = {"name": "Produto", "price_cents": 1000, "available_qty": 2}

    with patch("src.graph.tools._get_authoritative_price", AsyncMock(return_value=db_product)):
        result = await add_to_cart_tool.ainvoke({
            "product_id": "prod-uuid-1",
            "quantity": 5,
            "tenant_id": "tenant-123",
            "contact_id": "contact-1",
            "contact_phone": "5511999999999",
        })

    assert "2" in result  # shows available qty


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
