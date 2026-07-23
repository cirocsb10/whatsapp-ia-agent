# Plano de Inovação — WhatsAgent

## Contexto

O mercado de "IA para WhatsApp" já está saturado de players fazendo basicamente a mesma coisa: webhook → LLM → resposta de texto, com funil de CRM e catálogo. Empresas como Blip, Take, Zenvia, ChatGuru, Kommo, Digisac competem sobretudo em preço e robustez de infra, não em inteligência real do agente. A pesquisa no código mostrou que o WhatsAgent já cobre bem o "básico avançado" (catálogo via busca vetorial, geração de link de pagamento in-chat, handoff, RAG sobre base de conhecimento, KPIs, funil de CRM automático) e já tem um plano concreto em `.plans/28-multicanal-campanhas.md` cobrindo múltiplos números de WhatsApp por tenant, campanhas via template Meta, calculadora de custo de conversa e visibilidade hierárquica de conversas.

Este plano foca em diferenciais que ficam **fora** do que já existe ou já está planejado, organizados por esforço/impacto, para orientar decisões de roadmap depois que o Phase 0–5 do multicanal for concluído.

## Pilar 1 — Multicanalidade real (não só multi-número WhatsApp)

O plano existente resolve múltiplos números de WhatsApp; não resolve **múltiplas plataformas**. Um diferencial real de mercado é caixa de entrada unificada com Instagram Direct e Telegram (ambos com APIs oficiais estáveis e webhooks HMAC parecidos com o Meta), reaproveitando o pipeline LangGraph já existente — o `channel-service` passaria a normalizar eventos de múltiplos canais para o mesmo formato `InboundMessageEvent` antes de publicar em `msg.inbound`. Isso é vendável como "um único agente de IA para todos os canais de atendimento", algo que a maioria dos concorrentes de nicho WhatsApp não oferece.

## Pilar 2 — Agente multimodal completo

Hoje o pipeline só transcreve áudio de entrada (Whisper) e não lida com vídeo. Dois diferenciais de baixo esforço relativo:
- **Resposta em áudio (TTS)**: quando o cliente manda áudio, responder em áudio (voz clonada/consistente com a persona do tenant) via OpenAI TTS ou ElevenLabs, plugado no `output_node` do grafo.
- **Leitura de vídeo/imagem com contexto** (ex.: foto de um produto quebrado para suporte, print de comprovante de pagamento) via visão do modelo, hoje não tratado (`webhook.service.ts` não trata `video`).

## Pilar 3 — Copiloto para o atendente humano (agent-assist)

No momento do handoff, hoje o humano assume "no escuro". Um diferencial forte é a IA continuar ativa em modo **sugestão**: resumo automático da conversa até aquele ponto, sugestão de resposta em tempo real que o humano aprova/edita/envia com um clique, e sinalização de sentimento/urgência do cliente na interface do inbox (`apps/web`). Isso reaproveita o `guard_rail_node` e o LLM já configurados, sem custo de infra novo relevante — é essencialmente um novo modo de operação do grafo existente.

## Pilar 4 — Inteligência de catálogo e vendas além de busca vetorial simples

O `catalog_search_tool` hoje é busca semântica pura. Diferenciais:
- **Recomendação personalizada** usando histórico de pedidos do contato (`get_conversation_history_tool` já existe) para cross-sell/up-sell contextual ("quem comprou X também compra Y" por tenant).
- **Agente de agendamento/booking** integrado a calendário (Google Calendar/Cal.com) para verticais de serviço (clínicas, salões, consultorias) — nicho hoje mal atendido por bots de e-commerce genéricos.
- **WhatsApp Flows nativos** (formulários estruturados da Meta) para coleta de dados como endereço, CEP, preferências, agendamento — reduz fricção vs. texto livre e é pouco explorado por concorrentes.

## Pilar 5 — Personas verticais prontas (marketplace de templates)

`AgentConfig` já tem persona, tom, regras de handoff e guard rails configuráveis — falta empacotamento comercial. Criar **templates de persona por vertical** (imobiliária, clínica, e-commerce de moda, delivery) com prompts, guard rails e fluxos de ferramentas pré-configurados, selecionáveis no onboarding. Isso baixa o tempo de setup do zero-to-value de dias para minutos e vira argumento de venda direto ("agente pronto para sua indústria").

## Pilar 6 — Transparência e confiança (explicabilidade)

Diferencial de credibilidade: um painel que mostra, por conversa, quais fontes de RAG/knowledge base e quais tool calls a IA usou para chegar naquela resposta — hoje isso existe nos logs mas não é exposto ao tenant. Complementar com **auto-QA de compliance**: pontuação automática de cada conversa fechada quanto a tom, política de dados (LGPD) e aderência aos guard rails, sinalizando outliers para revisão humana.

## Pilar 7 — Voz real-time (aposta de médio prazo)

A Cloud API da Meta já expõe WhatsApp Calling. Um agente de IA que **atende chamada de voz** (não só áudio assíncrono) seria um diferencial de ponta, mas exige um pipeline de voz streaming (STT+LLM+TTS de baixa latência) separado do LangGraph atual — tratar como aposta estratégica, não quick win.

## Priorização sugerida

| Horizonte | Iniciativas | Racional |
|---|---|---|
| Quick wins (semanas) | TTS em áudio, leitura de vídeo, resumo automático para handoff | Reaproveitam grafo/tools existentes, baixo custo de infra |
| Médio prazo (1–2 trimestres, após Phases 0–5 do multicanal) | Instagram/Telegram unificados, agent-assist completo, templates de persona por vertical, WhatsApp Flows | Exigem novo modelo de dados ou UI nova, mas arquitetura já suporta |
| Apostas estratégicas | Recomendação personalizada de catálogo, booking/agendamento, explicabilidade + auto-QA, chamada de voz em tempo real | Maior esforço/incerteza, mas maior diferenciação defensável |

## Observação

Nenhum item acima duplica o que já está em `.plans/28-multicanal-campanhas.md` (múltiplos números WhatsApp, campanhas via template, calculadora de custo, visibilidade hierárquica, CRM auto-progression opcional) — este documento é complementar a esse plano, não substituto.
