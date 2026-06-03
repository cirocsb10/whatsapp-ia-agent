from langchain_core.tools import tool
from typing import Optional
import json
from datetime import datetime
import pytz
import structlog

log = structlog.get_logger(__name__)


async def _vector_search(query: str, tenant_id: str, limit: int = 5):
    from src.services.embeddings import EmbeddingsService
    svc = EmbeddingsService()
    return await svc.search_catalog(tenant_id, query, limit)


async def _get_product_stock(product_id: str, tenant_id: str) -> dict:
    from src.db.postgres import get_async_session
    from sqlalchemy import text

    async with get_async_session() as session:
        result = await session.execute(
            text("""
                SELECT "stockQty", "reservedQty"
                FROM "Product"
                WHERE id = :product_id AND "tenantId" = :tenant_id
            """),
            {"product_id": product_id, "tenant_id": tenant_id},
        )
        row = result.fetchone()
        if not row:
            return {"qty": 0, "reserved": 0}
        return {"qty": row[0], "reserved": row[1]}


async def _get_authoritative_price(product_id: str, tenant_id: str) -> dict | None:
    """Fetches authoritative product price and name from DB. Returns None if product not found or wrong tenant."""
    from src.db.postgres import get_async_session
    from sqlalchemy import text

    async with get_async_session() as session:
        result = await session.execute(
            text("""
                SELECT name, "priceCents", "stockQty", "reservedQty"
                FROM "Product"
                WHERE id = :product_id AND "tenantId" = :tenant_id AND status = 'ACTIVE'
            """),
            {"product_id": product_id, "tenant_id": tenant_id},
        )
        row = result.fetchone()
        if not row:
            return None
        return {
            "name": row[0],
            "price_cents": row[1],
            "available_qty": row[2] - row[3],
        }


@tool
async def catalog_search_tool(query: str, tenant_id: str) -> str:
    """
    Busca produtos no catálogo do tenant com base na descrição do cliente.
    Use esta ferramenta quando o cliente perguntar sobre produtos, preços ou disponibilidade.

    Args:
        query: Descrição do produto que o cliente quer encontrar
        tenant_id: ID do tenant atual

    Returns:
        Lista formatada dos produtos encontrados com nome, descrição, preço e estoque
    """
    try:
        products = await _vector_search(query, tenant_id, limit=5)

        if not products:
            return "Não encontrei produtos correspondentes à sua busca. Pode descrever melhor o que procura?"

        lines = ["Encontrei estes produtos para você:\n"]
        for i, p in enumerate(products, 1):
            available = p.stock_qty - p.reserved_qty
            price_brl = f"{p.price_cents / 100:.2f}".replace(".", ",")
            stock_status = f"✅ {available} em estoque" if available > 0 else "❌ Esgotado"
            lines.append(
                f"{i}. *{p.name}*\n"
                f"   {p.description or ''}\n"
                f"   💰 R$ {price_brl}\n"
                f"   {stock_status}\n"
                f"   ID: {p.id}"
            )

        return "\n".join(lines)
    except Exception as e:
        log.error("catalog_search_tool failed", error=str(e))
        return "Erro ao buscar produtos. Por favor, tente novamente."


@tool
async def get_stock_tool(product_id: str, tenant_id: str) -> str:
    """
    Verifica estoque disponível de um produto específico em tempo real.

    Args:
        product_id: ID do produto (obtido do catalog_search)
        tenant_id: ID do tenant atual

    Returns:
        Quantidade disponível para venda (stock_qty - reserved_qty)
    """
    try:
        data = await _get_product_stock(product_id, tenant_id)
        available = data["qty"] - data["reserved"]

        if available <= 0:
            return "Este produto está esgotado no momento. Posso verificar outros produtos similares?"
        elif available <= 3:
            return f"Temos apenas {available} unidades disponíveis! Recomendo não deixar para depois."
        else:
            return f"Temos {available} unidades disponíveis para entrega imediata."
    except Exception as e:
        log.error("get_stock_tool failed", error=str(e))
        return "Erro ao verificar estoque. Por favor, tente novamente."


@tool
async def add_to_cart_tool(
    product_id: str,
    product_name: str,
    price_cents: int,
    quantity: int,
    tenant_id: str,
    variation_selected: Optional[str] = None,
) -> str:
    """
    Adiciona produto ao carrinho da sessão atual.
    Use quando o cliente confirmar que quer comprar um produto.

    Args:
        product_id: ID do produto
        product_name: Nome do produto (usado apenas como fallback de display)
        price_cents: Preço em centavos (será validado contra o banco de dados)
        quantity: Quantidade desejada
        tenant_id: ID do tenant
        variation_selected: JSON string com variações selecionadas (ex: '{"Cor": "Preto", "Tamanho": "M"}')

    Returns:
        Confirmação com resumo do carrinho atualizado
    """
    try:
        # Always fetch authoritative price from DB — never trust LLM-supplied price
        db_product = await _get_authoritative_price(product_id, tenant_id)
        if not db_product:
            return f"Produto não encontrado no catálogo. Por favor, busque o produto novamente."

        if quantity > db_product["available_qty"]:
            return f"Desculpe, temos apenas {db_product['available_qty']} unidades disponíveis deste produto."

        authoritative_price = db_product["price_cents"]
        authoritative_name = db_product["name"]
        variation = json.loads(variation_selected) if variation_selected else {}
        subtotal = authoritative_price * quantity / 100

        return (
            f"✅ Adicionado ao carrinho!\n"
            f"   Produto: {authoritative_name}\n"
            f"   Quantidade: {quantity}\n"
            f"   Valor: R$ {subtotal:.2f}".replace(".", ",")
            + (f"\n   Variação: {json.dumps(variation, ensure_ascii=False)}" if variation else "")
        )
    except Exception as e:
        log.error("add_to_cart_tool failed", error=str(e))
        return "Erro ao adicionar produto ao carrinho. Por favor, tente novamente."


@tool
async def generate_payment_link_tool(
    tenant_id: str,
    contact_phone: str,
    items_json: str,
    payment_method: str = "pix",
) -> str:
    """
    Gera link de pagamento via Mercado Pago para fechar o pedido.
    Use APENAS quando o cliente confirmar todos os itens e querer pagar.

    Args:
        tenant_id: ID do tenant
        contact_phone: Telefone do cliente
        items_json: JSON string com lista de itens
        payment_method: "pix" | "credit_card" | "boleto"

    Returns:
        QR Code Pix + código para cópia e cola
    """
    try:
        import os
        items = json.loads(items_json)

        # Re-validate all prices against DB — never trust LLM-supplied price_cents
        validated_items = []
        for item in items:
            product_id = item.get("product_id") or item.get("productId")
            quantity = int(item.get("quantity", 1))

            if not product_id:
                return "Erro: item sem product_id no carrinho. Por favor, adicione os produtos novamente."

            db_product = await _get_authoritative_price(product_id, tenant_id)
            if not db_product:
                return f"Produto '{item.get('name', product_id)}' não encontrado ou indisponível. Por favor, verifique o carrinho."

            validated_items.append({
                "product_id": product_id,
                "name": db_product["name"],
                "price_cents": db_product["price_cents"],  # authoritative price from DB
                "quantity": quantity,
            })

        total_cents = sum(i["price_cents"] * i["quantity"] for i in validated_items)
        total_brl = total_cents / 100

        import httpx
        api_base = os.environ.get("BACKOFFICE_API_URL", "http://api:3002")
        internal_token = os.environ.get("INTERNAL_API_TOKEN")
        if not internal_token:
            raise RuntimeError("INTERNAL_API_TOKEN must be set")

        async with httpx.AsyncClient(timeout=30.0) as client:
            order_resp = await client.post(
                f"{api_base}/orders/internal",
                json={
                    "tenantId": tenant_id,
                    "contactPhone": contact_phone,
                    "items": validated_items,
                },
                headers={"X-Internal-Token": internal_token},
            )
            order_resp.raise_for_status()
            order_id = order_resp.json()["id"]

            pay_resp = await client.post(
                f"{api_base}/payments/generate-internal",
                json={
                    "orderId": order_id,
                    "paymentMethod": payment_method.upper(),
                },
                headers={"X-Internal-Token": internal_token},
            )
            pay_resp.raise_for_status()
            data = pay_resp.json()

        if payment_method == "pix":
            return (
                f"💳 *Pagamento Pix gerado!*\n\n"
                f"💰 Total: R$ {total_brl:.2f}\n\n"
                f"*Copia e cola o código Pix:*\n"
                f"`{data['pixCopyPaste']}`\n\n"
                f"⏰ Expira em 30 minutos\n\n"
                f"Após o pagamento confirmado, te aviso aqui mesmo! 😊"
            )
        else:
            return f"🔗 Link de pagamento: {data['paymentUrl']}\n💰 Total: R$ {total_brl:.2f}"

    except Exception as e:
        log.error("generate_payment_link_tool failed", error=str(e))
        return "Não consegui gerar o link de pagamento agora. Vou transferir para um atendente."


@tool
async def verify_business_hours_tool(
    tenant_id: str,
    hours_config: str,
    timezone: str = "America/Sao_Paulo",
) -> str:
    """
    Verifica se o negócio está aberto no momento atual.

    Args:
        tenant_id: ID do tenant
        hours_config: JSON string com config de horários
        timezone: Timezone do negócio

    Returns:
        Status de funcionamento atual
    """
    try:
        hours = json.loads(hours_config)
        tz = pytz.timezone(timezone)
        now = datetime.now(tz)
        day_key = now.strftime("%a").lower()

        day_config = hours.get(day_key, {})
        if not day_config.get("active", False):
            return "fechado - dia não trabalhado"

        open_time = day_config.get("open", "00:00")
        close_time = day_config.get("close", "00:00")
        current_str = now.strftime("%H:%M")

        if open_time <= current_str <= close_time:
            return f"aberto - funcionando até {close_time}"
        elif current_str < open_time:
            return f"fechado - abre às {open_time}"
        else:
            return f"fechado - encerrou às {close_time}"
    except Exception:
        return "fechado"  # Fail-safe: assume closed on error


@tool
async def transfer_to_human_tool(
    tenant_id: str,
    conversation_id: str,
    reason: str,
    urgency: str = "medium",
) -> str:
    """
    Transfere a conversa para um agente humano.
    Use quando: pedido for de alto valor, cliente frustrado, pergunta fora do escopo,
    cliente pedir explicitamente, ou confiança do agente for baixa.

    Args:
        tenant_id: ID do tenant
        conversation_id: ID da conversa atual
        reason: Motivo da transferência em texto legível
        urgency: "low" | "medium" | "high"

    Returns:
        Sentinel string para o output_node detectar handoff
    """
    log.info("Handoff requested", tenant_id=tenant_id, reason=reason, urgency=urgency)
    return "__HANDOFF_REQUESTED__"


@tool
async def get_conversation_history_tool(
    tenant_id: str,
    contact_phone: str,
    limit: int = 5,
) -> str:
    """
    Recupera histórico de pedidos e conversas anteriores do cliente.
    Use para personalizar o atendimento de clientes recorrentes.

    Args:
        tenant_id: ID do tenant
        contact_phone: Telefone do cliente
        limit: Quantos pedidos anteriores retornar

    Returns:
        Resumo do histórico do cliente
    """
    from src.db.postgres import get_async_session
    from sqlalchemy import text

    try:
        async with get_async_session() as session:
            result = await session.execute(
                text("""
                    SELECT o."orderNumber", o."totalCents", o.status, o."createdAt",
                           COUNT(oi.id) as item_count
                    FROM "Order" o
                    JOIN "Contact" c ON o."contactId" = c.id
                    JOIN "OrderItem" oi ON oi."orderId" = o.id
                    WHERE c.phone = :phone AND o."tenantId" = :tenant_id
                    GROUP BY o.id
                    ORDER BY o."createdAt" DESC
                    LIMIT :limit
                """),
                {"phone": contact_phone, "tenant_id": tenant_id, "limit": limit},
            )
            rows = result.fetchall()

        if not rows:
            return "Cliente novo — sem histórico de compras."

        lines = [f"Histórico do cliente ({len(rows)} pedidos):"]
        for row in rows:
            total_brl = row[1] / 100
            lines.append(
                f"• Pedido {row[0]}: R$ {total_brl:.2f} ({row[3].strftime('%d/%m/%Y')}) - {row[2]}"
            )
        return "\n".join(lines)
    except Exception as e:
        log.error("get_conversation_history_tool failed", error=str(e))
        return "Sem histórico disponível."


@tool
async def knowledge_search_tool(query: str, tenant_id: str, limit: int = 4) -> str:
    """
    Search the tenant's knowledge base for information relevant to the query.
    Use this when the user asks about topics that may be in the company's FAQ,
    policies, product descriptions, or any indexed knowledge.

    Args:
        query: The question or topic to search for
        tenant_id: Tenant identifier
        limit: Max chunks to return (default 4)

    Returns:
        Relevant knowledge base excerpts, or a message if nothing found
    """
    from sqlalchemy import text
    from src.db.postgres import get_async_session
    from src.services.embeddings import EmbeddingsService

    _embeddings = EmbeddingsService()
    embedding = await _embeddings.embed(query)
    embedding_str = f"[{','.join(str(v) for v in embedding)}]"

    async with get_async_session() as session:
        result = await session.execute(
            text("""
                SELECT kc.content,
                       kb.name AS source,
                       1 - (kc.embedding <=> :embedding::vector) AS similarity
                FROM "KnowledgeChunk" kc
                JOIN "KnowledgeBase" kb ON kb.id = kc."knowledgeBaseId"
                WHERE kc."tenantId" = :tenant_id
                  AND 1 - (kc.embedding <=> :embedding::vector) > 0.6
                ORDER BY kc.embedding <=> :embedding::vector
                LIMIT :limit
            """),
            {"embedding": embedding_str, "tenant_id": tenant_id, "limit": limit},
        )
        rows = result.fetchall()

    if not rows:
        return "Nenhuma informação relevante encontrada na base de conhecimento."

    parts = []
    for row in rows:
        parts.append(f"[{row[1]}] {row[0]}")
    return "\n\n---\n\n".join(parts)


ALL_TOOLS = [
    catalog_search_tool,
    get_stock_tool,
    add_to_cart_tool,
    generate_payment_link_tool,
    verify_business_hours_tool,
    transfer_to_human_tool,
    get_conversation_history_tool,
    knowledge_search_tool,
]
