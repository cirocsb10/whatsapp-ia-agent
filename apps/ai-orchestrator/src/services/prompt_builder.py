from src.db.postgres import get_async_session
from sqlalchemy import text
import structlog

log = structlog.get_logger(__name__)


class PromptBuilderService:
    TONE_INSTRUCTIONS = {
        "FORMAL": "Use linguagem formal e respeitosa. Evite gírias e expressões informais.",
        "INFORMAL": "Use linguagem descontraída e próxima. Use 'você' e seja acessível.",
        "FRIENDLY": "Seja caloroso, amigável e entusiasmado. Use emojis com moderação 😊",
        "TECHNICAL": "Seja preciso e técnico. Forneça detalhes específicos e dados quando solicitado.",
        "REGIONAL": "Use expressões regionais e linguagem característica da região.",
    }

    async def get_agent_config(self, tenant_id: str) -> dict:
        async with get_async_session() as session:
            result = await session.execute(
                text("""
                    SELECT "agentName", tone, "greetingMessage", "businessHours",
                           "llmModel", "llmTemperature", "handoffMessage",
                           "handoffOrderValueBrl", "autoHandoffThreshold",
                           "systemPromptBase", "outOfHoursMessage", "maxResponseLength",
                           "sessionTtlHours", "inactivityTimeoutMin"
                    FROM "AgentConfig"
                    WHERE "tenantId" = :tid
                """),
                {"tid": tenant_id},
            )
            row = result.fetchone()

        if not row:
            return {
                "agent_name": "Assistente",
                "tone": "FRIENDLY",
                "greeting_message": "Olá! Como posso ajudar?",
            }

        return {
            "agent_name": row[0],
            "tone": row[1],
            "greeting_message": row[2],
            "business_hours": row[3],
            "llm_model": row[4],
            "llm_temperature": row[5],
            "handoff_message": row[6],
            "handoff_order_value_brl": row[7],
            "auto_handoff_threshold": row[8],
            "system_prompt_base": row[9],
            "out_of_hours_message": row[10],
            "max_response_length": row[11],
            "session_ttl_hours": row[12],
            "inactivity_timeout_min": row[13],
        }

    async def build(
        self,
        tenant_id: str,
        agent_name: str = "Assistente",
        tone: str = "FRIENDLY",
        business_hours_open: bool = True,
        contact_name: str | None = None,
        contact_phone: str | None = None,
    ) -> str:
        config = await self.get_agent_config(tenant_id)

        async with get_async_session() as session:
            result = await session.execute(
                text("""
                    SELECT name, content
                    FROM "KnowledgeBase"
                    WHERE "tenantId" = :tid AND type IN ('faq', 'text') AND "isIndexed" = true
                    ORDER BY "createdAt" ASC
                    LIMIT 5
                """),
                {"tid": tenant_id},
            )
            kb_entries = result.fetchall()

        tone_instruction = self.TONE_INSTRUCTIONS.get(
            config.get("tone", tone), self.TONE_INSTRUCTIONS["FRIENDLY"]
        )
        agent_name_final = config.get("agent_name", agent_name)

        greeting_message = config.get("greeting_message") or "Olá! Como posso ajudar?"

        prompt_parts = [
            f"Você é {agent_name_final}, assistente virtual de atendimento e vendas.",
            "",
            "## Instruções de Comportamento",
            tone_instruction,
            "",
            "## Mensagem de Boas-vindas",
            f"Na PRIMEIRA mensagem de uma nova conversa, use EXATAMENTE esta saudação (sem alterar o texto):",
            f'"{greeting_message}"',
            "",
            "## Regras Obrigatórias",
            "- NUNCA invente preços, produtos ou informações que não constam no catálogo",
            "- NUNCA prometa prazos ou condições sem verificar",
            "- Se não souber a resposta, use as ferramentas disponíveis antes de responder",
            "- Sempre use a ferramenta catalog_search para buscar produtos",
            "- Sempre confirme o carrinho antes de gerar link de pagamento",
            "- SEMPRE pergunte a forma de pagamento (Pix, cartão de crédito ou boleto) antes de chamar generate_payment_link_tool. Nunca assuma a forma de pagamento.",
            "- Use formatação WhatsApp: *texto* para negrito (um asterisco), _texto_ para itálico. NUNCA use **duplo asterisco**.",
            f"- O telefone do cliente já é conhecido ({contact_phone or 'disponível via ferramenta'}). NUNCA peça o número de telefone ao cliente.",
            "",
            "## Identificação do Cliente",
        ] + (
            [f"- O cliente se chama {contact_name}. Use o nome dele para personalizar o atendimento.", ""]
            if contact_name else
            [
                "- O nome do cliente ainda não foi registrado.",
                "- Em um momento natural da conversa (ex: ao confirmar um pedido, personalizar uma recomendação ou encaminhar para pagamento), pergunte o nome do cliente de forma leve e contextual. Exemplo: 'Para eu te atender melhor, qual é o seu nome?' ou 'Com quem eu tenho o prazer de falar?'.",
                "- Pergunte UMA VEZ apenas. Não insista se o cliente não responder.",
                "- Assim que o cliente revelar o nome — seja ao responder diretamente ou ao mencioná-lo em qualquer contexto — use IMEDIATAMENTE a ferramenta `update_contact_name_tool` para registrá-lo.",
                "",
            ]
        )

        if not business_hours_open:
            out_of_hours_msg = (
                config.get("out_of_hours_message")
                or "No momento estamos fechados. Retornaremos em breve!"
            )
            prompt_parts.extend([
                "## Horário de Atendimento",
                "⚠️ ATENÇÃO: O estabelecimento está FECHADO no momento.",
                f"Use EXATAMENTE esta mensagem para informar o cliente: \"{out_of_hours_msg}\"",
                "",
            ])

        if kb_entries:
            prompt_parts.append("## Informações do Negócio")
            for name, content in kb_entries:
                prompt_parts.append(f"### {name}")
                prompt_parts.append(content[:2000])
                prompt_parts.append("")

        if config.get("system_prompt_base"):
            prompt_parts.extend([
                "## Instruções Específicas do Negócio",
                config["system_prompt_base"],
                "",
            ])

        if config.get("handoff_order_value_brl"):
            prompt_parts.append(
                f"- Pedidos acima de R$ {config['handoff_order_value_brl']:.2f} devem ser transferidos para atendente humano"
            )

        prompt_parts.extend([
            "",
            "## Ferramentas Disponíveis",
            "Use as ferramentas quando necessário. Não responda sobre produtos sem consultá-las.",
            "Ferramentas: catalog_search, get_stock, add_to_cart, generate_payment_link,",
            "             verify_business_hours, transfer_to_human, get_conversation_history,",
            "             update_contact_name, knowledge_search",
        ])

        return "\n".join(prompt_parts)
