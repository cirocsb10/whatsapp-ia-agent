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
        Lista formatada dos produtos encontrados com nome, descrição e preço.
        Para disponibilidade em tempo real, use get_stock_tool.
    """
    try:
        products = await _vector_search(query, tenant_id, limit=5)

        if not products:
            return "Não encontrei produtos correspondentes à sua busca. Pode descrever melhor o que procura?"

        lines = ["Encontrei estes produtos para você:\n"]
        for i, p in enumerate(products, 1):
            price_brl = f"{p.price_cents / 100:.2f}".replace(".", ",")
            lines.append(
                f"{i}. {p.name}\n"
                f"   {p.description or ''}\n"
                f"   💰 R$ {price_brl}\n"
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
    quantity: int,
    tenant_id: str,
    contact_id: str,
    contact_phone: str,
    variation_selected: Optional[str] = None,
) -> str:
    """
    Adiciona produto ao pedido do cliente. Cria um pedido DRAFT se não existir um aberto,
    ou adiciona ao pedido existente. Use quando o cliente confirmar que quer comprar um produto.

    Args:
        product_id: ID do produto (obtido do catalog_search)
        quantity: Quantidade desejada
        tenant_id: ID do tenant (injetado automaticamente)
        contact_id: ID do contato (injetado automaticamente)
        contact_phone: Telefone do contato (injetado automaticamente)
        variation_selected: JSON string com variações selecionadas

    Returns:
        Confirmação com resumo do pedido atualizado e [ORDER_ID:xxx]
    """
    from src.db.postgres import get_async_session
    from sqlalchemy import text
    import random, string
    from datetime import datetime

    try:
        if quantity <= 0:
            return "Quantidade inválida. Por favor, informe uma quantidade maior que zero."

        db_product = await _get_authoritative_price(product_id, tenant_id)
        if not db_product:
            return "Produto não encontrado no catálogo. Por favor, busque o produto novamente."
        if quantity > db_product["available_qty"]:
            return f"Desculpe, temos apenas {db_product['available_qty']} unidades disponíveis deste produto."

        authoritative_price = db_product["price_cents"]
        authoritative_name = db_product["name"]
        variation = json.loads(variation_selected) if variation_selected else {}

        async with get_async_session() as session:
            # Find existing DRAFT order for this contact
            existing = await session.execute(
                text("""
                    SELECT id FROM "Order"
                    WHERE "tenantId" = :tid AND "contactId" = :cid AND status = 'DRAFT'
                    ORDER BY "createdAt" DESC LIMIT 1
                """),
                {"tid": tenant_id, "cid": contact_id},
            )
            order_row = existing.fetchone()
            order_id = order_row[0] if order_row else None

            if not order_id:
                # Create new DRAFT order
                suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
                order_number = f"ORD-{datetime.now().strftime('%y%m%d')}-{suffix}"
                result = await session.execute(
                    text("""
                        INSERT INTO "Order" ("id", "tenantId", "contactId", "orderNumber",
                            "subtotalCents", "totalCents", "status", "createdAt", "updatedAt")
                        VALUES (gen_random_uuid(), :tid, :cid, :num, 0, 0, 'DRAFT', now(), now())
                        RETURNING id
                    """),
                    {"tid": tenant_id, "cid": contact_id, "num": order_number},
                )
                order_id = result.fetchone()[0]

            # Check if this product already in the order
            item_row = await session.execute(
                text("""
                    SELECT id, quantity FROM "OrderItem"
                    WHERE "orderId" = :oid AND "productId" = :pid
                    LIMIT 1
                """),
                {"oid": order_id, "pid": product_id},
            )
            existing_item = item_row.fetchone()

            if existing_item:
                new_qty = existing_item[1] + quantity
                new_subtotal = authoritative_price * new_qty
                await session.execute(
                    text("""
                        UPDATE "OrderItem"
                        SET quantity = :qty, "subtotalCents" = :sub
                        WHERE id = :iid
                    """),
                    {"qty": new_qty, "sub": new_subtotal, "iid": existing_item[0]},
                )
            else:
                item_subtotal = authoritative_price * quantity
                await session.execute(
                    text("""
                        INSERT INTO "OrderItem" ("id", "orderId", "productId", "productName",
                            "priceCents", quantity, "subtotalCents", "variationSelected")
                        VALUES (gen_random_uuid(), :oid, :pid, :name, :price, :qty, :sub, CAST(:var AS jsonb))
                    """),
                    {
                        "oid": order_id, "pid": product_id, "name": authoritative_name,
                        "price": authoritative_price, "qty": quantity,
                        "sub": authoritative_price * quantity,
                        "var": json.dumps(variation),
                    },
                )

            # Recalculate order total
            total_row = await session.execute(
                text('SELECT COALESCE(SUM("subtotalCents"), 0) FROM "OrderItem" WHERE "orderId" = :oid'),
                {"oid": order_id},
            )
            total_cents = total_row.fetchone()[0]
            await session.execute(
                text('UPDATE "Order" SET "subtotalCents" = :t, "totalCents" = :t, "updatedAt" = now() WHERE id = :oid'),
                {"t": total_cents, "oid": order_id},
            )

            # Fetch all items for summary
            items_result = await session.execute(
                text('SELECT "productName", quantity, "subtotalCents" FROM "OrderItem" WHERE "orderId" = :oid'),
                {"oid": order_id},
            )
            items = items_result.fetchall()
            await session.commit()

        total_brl = f"{total_cents / 100:.2f}".replace(".", ",")
        lines = [f"✅ Adicionado ao pedido!\n"]
        for item in items:
            item_brl = f"{item[2] / 100:.2f}".replace(".", ",")
            lines.append(f"   • {item[0]} x{item[1]} — R$ {item_brl}")
        lines.append(f"\n   *Total: R$ {total_brl}*")
        lines.append(f"[ORDER_ID:{order_id}]")

        log.info("add_to_cart_tool", order_id=order_id, total_cents=total_cents)
        return "\n".join(lines)
    except Exception as e:
        log.error("add_to_cart_tool failed", error=str(e))
        return "Erro ao adicionar produto ao pedido. Por favor, tente novamente."


@tool
async def generate_payment_link_tool(
    payment_method: str,
    tenant_id: str,
    contact_phone: str,
    order_id: str,
) -> str:
    """
    Gera link de pagamento para o pedido aberto do cliente.
    Use APENAS quando o cliente informar a forma de pagamento desejada.
    O pedido já foi criado pelo add_to_cart_tool — não é necessário informar os itens.

    Args:
        payment_method: "pix" | "credit_card" | "boleto"
        tenant_id: ID do tenant (injetado automaticamente)
        contact_phone: Telefone do cliente (injetado automaticamente)
        order_id: ID do pedido aberto (injetado automaticamente)

    Returns:
        QR Code Pix + código para cópia e cola, ou link de pagamento
    """
    import os, httpx

    if not order_id:
        return "Nenhum pedido aberto encontrado. Por favor, adicione produtos ao carrinho primeiro."

    try:
        api_base = os.environ.get("BACKOFFICE_API_URL", "http://api:3002")
        internal_token = os.environ.get("INTERNAL_API_TOKEN")
        if not internal_token:
            raise RuntimeError("INTERNAL_API_TOKEN must be set")

        async with httpx.AsyncClient(timeout=30.0) as client:
            pay_resp = await client.post(
                f"{api_base}/payments/generate-internal",
                json={"orderId": order_id, "tenantId": tenant_id, "paymentMethod": payment_method.upper()},
                headers={"X-Internal-Token": internal_token},
            )
            pay_resp.raise_for_status()
            data = pay_resp.json()

        total_brl = f"{data['totalCents'] / 100:.2f}".replace(".", ",")

        if payment_method.lower() == "pix":
            return (
                f"💳 *Pagamento Pix gerado!*\n\n"
                f"💰 Total: R$ {total_brl}\n\n"
                f"*Copia e cola o código Pix:*\n"
                f"{data['pixCopyPaste']}\n\n"
                f"⏰ Expira em 30 minutos\n\n"
                f"Após o pagamento confirmado, te aviso aqui mesmo! 😊"
            )
        else:
            return f"🔗 Link de pagamento: {data.get('paymentUrl', '')}\n💰 Total: R$ {total_brl}"

    except Exception as e:
        log.error("generate_payment_link_tool failed", error=str(e))
        return "__HANDOFF_REQUESTED__"


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
async def update_contact_name_tool(name: str, tenant_id: str, contact_id: str) -> str:
    """
    Salva o nome do cliente no sistema quando ele mencionar o nome durante a conversa.
    Use esta ferramenta APENAS quando o cliente revelar o próprio nome naturalmente.
    Não pergunte o nome diretamente — capture quando ele aparecer na conversa.

    Args:
        name: Nome do cliente conforme mencionado por ele
        tenant_id: ID do tenant atual (injetado automaticamente)
        contact_id: ID do contato (injetado automaticamente)

    Returns:
        Confirmação do registro
    """
    if not contact_id:
        return "Não foi possível salvar o nome: contato não identificado."
    try:
        from src.db.postgres import get_async_session
        from sqlalchemy import text

        async with get_async_session() as session:
            await session.execute(
                text('UPDATE "Contact" SET name = :name WHERE id = :contact_id AND "tenantId" = :tenant_id'),
                {"name": name.strip(), "contact_id": contact_id, "tenant_id": tenant_id},
            )
            await session.commit()

        log.info("contact_name_updated", contact_id=contact_id, name=name)
        return f"Nome '{name}' registrado com sucesso."
    except Exception as e:
        log.error("update_contact_name_tool failed", error=str(e))
        return "Erro ao registrar o nome. Continuando normalmente."


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
                       1 - (kc.embedding <=> CAST(:embedding AS vector)) AS similarity
                FROM "KnowledgeChunk" kc
                JOIN "KnowledgeBase" kb ON kb.id = kc."knowledgeBaseId"
                WHERE kc."tenantId" = :tenant_id
                  AND 1 - (kc.embedding <=> CAST(:embedding AS vector)) > 0.6
                ORDER BY kc.embedding <=> CAST(:embedding AS vector)
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
    update_contact_name_tool,
]
