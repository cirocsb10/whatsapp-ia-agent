# Plano de Inovação Competitiva — WhatsAgent

**Data:** 22/07/2026  
**Horizonte:** 12 meses, revisto trimestralmente  
**Natureza:** estratégia de produto e inovação; não é ainda um plano de implementação arquivo a arquivo  
**Premissa de capacidade:** squad de referência com 2 pessoas de backend, 1 de frontend, 1 de IA/dados e apoio de produto/QA. Com outra capacidade, preservar a ordem dos gates, não as datas.

---

## 1. Resumo executivo

O WhatsAgent já possui uma base mais valiosa do que a de um chatbot convencional. O produto conecta a API oficial do WhatsApp a um agente com RAG, guardrails e ferramentas transacionais; compreende texto, áudio e imagem; consulta catálogo e estoque; cria pedidos; gera pagamento; transfere para humanos; mantém CRM e mede parte do funil. O principal ativo não é o chat: é a ligação já existente entre **conversa, decisão da IA, operação comercial e pagamento**.

A recomendação é posicionar o WhatsAgent como uma **plataforma de Receita Conversacional Autônoma e Auditável**, inicialmente especializada em varejo, e-commerce conversacional e operações multiunidade. A proposta não deve ser “responder clientes com IA”, pois isso já virou requisito básico. A promessa deve ser:

> **O WhatsAgent transforma cada conversa em aprendizado verificável para vender mais, recuperar receita perdida e melhorar a operação sem perder controle.**

O diferencial defensável será um ciclo proprietário de aprendizado:

```text
conversa → decisão/ação → resultado financeiro → avaliação → experimento seguro → agente melhor
```

Esse ciclo se materializa em cinco apostas principais:

1. **Outcome Ledger + Revenue Brain:** ligar cada ação da IA a pedidos, pagamentos, margem, custo e resultado; recomendar a próxima melhor ação com base em evidência, não apenas em prompt.
2. **Quality Loop:** avaliar 100% das conversas e transformar falhas reais em testes de regressão, com versionamento, shadow mode, canário e rollback do agente.
3. **Vendedor Visual:** receber foto, áudio ou linguagem natural e encontrar produtos visualmente/semanticamente semelhantes, montar combinações e conduzir a compra em uma experiência rica dentro do WhatsApp.
4. **Revenue Rescue Autopilot:** recuperar carrinhos, pagamentos pendentes, oportunidades paradas e recompras com intervenções consentidas, oportunas e economicamente justificadas.
5. **Inteligência Coletiva por Segmento:** transformar conversas em sinais de produto e, quando houver escala e base legal, oferecer benchmarks anônimos e recomendações por segmento.

As funcionalidades dos Planos 22 e 28 — lead scoring, múltiplos números, campanhas oficiais, custo de mensageria e permissões — continuam importantes, mas são **fundação competitiva**, não o núcleo inovador. Devem ser concluídas antes das apostas que dependem delas.

---

## 2. Diagnóstico do produto atual

### 2.1 Capacidades confirmadas no repositório

| Capacidade | Evidência atual | Valor estratégico |
|---|---|---|
| SaaS multi-tenant | `Tenant`, isolamento por `tenantId`, guards/interceptor e serviços separados | Permite escala B2B e inteligência por segmento com isolamento |
| Canal oficial Meta | Webhook, HMAC, Cloud API e status de mensagens no `channel-service` | Compliance e confiabilidade para crescer |
| Orquestração agentic | LangGraph com rota, raciocínio, ferramentas, guardrail e output | Base para decisões e ações, não apenas FAQ |
| Conhecimento/RAG | `KnowledgeBase`, chunks e pgvector | Respostas contextualizadas por tenant |
| Comércio conversacional | Busca de catálogo, estoque, carrinho, pedido e Mercado Pago | Conecta conversa diretamente a receita |
| Multimodalidade | Transcrição de áudio, análise de imagem e persistência de documentos | Base pronta para venda visual e acessibilidade |
| Operação humana | Inbox em tempo real, handoff, assumir/liberar conversa | Modelo híbrido IA + humano |
| CRM e funil | Contatos, deals, Kanban e progressão automática | Memória comercial e base para priorização |
| Analytics | Conversas, resolução por IA, handoffs, conversão, receita, tokens, heatmap | Base inicial; falta atribuição causal e qualidade profunda |
| Governança inicial | Guard rules, audit log, opt-out, papéis e simulator | Ponto de partida para agente auditável |

### 2.2 Lacunas que limitam diferenciação

1. **O sistema mede atividade, mas não fecha o ciclo de resultado.** Existem eventos e KPIs, porém não há um ledger que atribua uma decisão, versão do agente ou intervenção à conversão, margem, reembolso ou custo.
2. **A configuração do agente não é um artefato versionado.** Não há promoção formal entre rascunho, shadow, canário e produção, nem comparação confiável entre versões.
3. **O simulador testa uma conversa isolada.** Ele ainda não executa suites de cenários, replay de conversas reais anonimizadas ou regressões automáticas.
4. **O contexto do cliente é cadastral, não uma memória consentida.** Contato, pedidos e conversas existem, mas preferências, restrições, intenções e fatos com origem/validade não formam um perfil temporal confiável.
5. **A imagem é compreendida, mas não vira busca visual de catálogo.** O modelo pode descrever uma imagem; ainda não encontra itens por similaridade visual ou monta looks/kits com restrições de estoque e margem.
6. **As automações são reativas.** O Plano 28 adiciona campanhas, mas ainda falta um motor orientado por eventos e valor esperado para escolher se, quando e como agir.
7. **Os dados conversacionais não retroalimentam produto e operação.** Objeções, demandas não atendidas, perguntas sem resposta e menções a concorrentes não viram backlog quantificado.
8. **O lead scoring planejado é configurável, mas inicialmente heurístico.** Sem calibração por resultado real, um score 0–100 pode parecer preciso sem ser preditivo.

### 2.3 Funcionalidades já planejadas e que não devem ser duplicadas

- **Plano 22:** lead scoring com critérios ponderados e temperatura no CRM.
- **Plano 28:** multi-número por tenant, IA por canal, visibilidade hierárquica, CRM configurável, custo de mensageria e campanhas com templates oficiais.

Este plano usa essas entregas como dependências. Uma funcionalidade planejada não deve ser comunicada ao mercado como existente antes de passar por validação ponta a ponta.

---

## 3. Leitura competitiva: o que já virou requisito básico

O mercado em 2026 já comunica como capacidades padrão:

- inbox compartilhada ou omnichannel;
- agentes de IA ligados a base de conhecimento e CRM;
- qualificação e roteamento de leads;
- campanhas, retargeting e Click-to-WhatsApp;
- automações no-code, integrações e atendimento híbrido;
- analytics de funil, SLA e produtividade;
- copiloto do atendente;
- chamadas e voz;
- avaliação automática de qualidade.

Exemplos atuais:

- A **respond.io** combina inbox omnichannel, agentes que qualificam/fecham, contexto de CRM, chamadas e visibilidade sobre vazamentos de receita.
- A **Wati** oferece campanhas, Click-to-WhatsApp, catálogo, recuperação de carrinho, copiloto, agentes em WhatsApp/web/voz, múltiplos números e roteamento.
- A **Blip** já posiciona IA, pagamentos, campanhas, builder no-code e analytics como plataforma completa; o Desk Score avalia automaticamente conversas encerradas.
- A **Zenvia** combina chatbots de IA, CRM/ERP/pagamentos, governança, app móvel e analytics de anúncios Click-to-WhatsApp.
- A própria **Meta** disponibiliza Cloud API, Flows para interações estruturadas como agendamento e navegação de produtos, Embedded Signup e evolução de chamadas/voz na plataforma.

### Implicação estratégica

Construir paridade é necessário, mas não cria uma razão forte para trocar de fornecedor. O WhatsAgent deve evitar competir por quantidade de caixas marcadas e concentrar-se em uma vantagem que use sua arquitetura atual:

> **aprender com o resultado transacional de cada conversa e melhorar o agente com evidência, governança e foco em margem.**

---

## 4. Tese de posicionamento

### 4.1 Categoria proposta

**Plataforma de Receita Conversacional Autônoma e Auditável.**

### 4.2 Mercado inicial recomendado

Priorizar empresas brasileiras de varejo/e-commerce conversacional e redes multiunidade que tenham:

- volume relevante de conversas no WhatsApp;
- catálogo ou serviços padronizáveis;
- intenção de compra capturável na conversa;
- pedido, pagamento ou agendamento mensurável;
- equipe humana para exceções e vendas de maior valor;
- recorrência, carrinho abandonado ou oportunidades paradas.

Esse recorte aproveita catálogo, estoque, pedido, Pix/Mercado Pago, CRM e o Plano 28. Clínicas, educação e serviços podem entrar depois por meio de kits verticais e WhatsApp Flows.

### 4.3 Promessa central

**“Atenda, venda e melhore automaticamente — com cada resultado explicado e mensurado.”**

### 4.4 Moats pretendidos

1. **Outcome data moat:** dataset próprio que liga contexto, ação, versão do agente e resultado financeiro.
2. **Evaluation moat:** suites de testes e taxonomia de falhas nascidas de conversas reais por segmento.
3. **Workflow moat:** integrações profundas com catálogo, estoque, pedido, pagamento, logística e CRM.
4. **Vertical moat:** playbooks, métricas e avaliações específicas por segmento.
5. **Trust moat:** trilha auditável, fonte, consentimento e rollout seguro de automações.

---

## 5. Portfólio de inovação priorizado

### Critério de priorização

Escala de 1 a 5. O índice é direcional, não uma previsão financeira:

```text
Índice = 30% impacto no cliente
       + 25% diferenciação
       + 20% aderência aos ativos atuais
       + 15% potencial de moat
       + 10% velocidade de aprendizado
```

| Prioridade | Aposta | Impacto | Diferenciação | Aderência | Moat | Aprendizado | Índice / 100 | Horizonte |
|---:|---|---:|---:|---:|---:|---:|---:|---|
| 1 | Outcome Ledger + Quality Loop | 5 | 5 | 5 | 5 | 5 | 100 | Agora |
| 2 | Revenue Rescue Autopilot | 5 | 4 | 5 | 4 | 5 | 91 | 3–6 meses |
| 3 | Vendedor Visual | 5 | 5 | 4 | 4 | 4 | 89 | 3–6 meses |
| 4 | Customer Memory Graph | 4 | 4 | 5 | 5 | 4 | 88 | 3–6 meses |
| 5 | Revenue Brain / Next Best Action | 5 | 5 | 4 | 5 | 3 | 88 | 6–9 meses |
| 6 | Conversational Product Intelligence | 4 | 4 | 5 | 4 | 5 | 87 | 2–4 meses |
| 7 | Copiloto Comercial Auditável | 4 | 3 | 5 | 3 | 5 | 79 | 2–4 meses |
| 8 | Vertical Launch Kits | 4 | 4 | 4 | 4 | 4 | 80 | 6–9 meses |
| 9 | Benchmark de Segmento | 4 | 5 | 2 | 5 | 2 | 75 | 9–12 meses |
| 10 | Voz e chamadas inteligentes | 3 | 3 | 3 | 3 | 3 | 60 | Após PMF |

O Outcome Ledger e o Quality Loop aparecem juntos porque sem medição confiável não existe aprendizado, e sem rollout seguro a otimização pode aumentar risco.

---

## 6. Apostas detalhadas

### 6.1 Outcome Ledger — verdade econômica de cada conversa

**Problema:** métricas atuais contam conversas, pedidos e pagamentos, mas não explicam qual decisão, mensagem, ferramenta ou versão do agente influenciou o resultado.

**Proposta:** criar um ledger imutável de decisões e resultados que ligue:

```text
origem → conversa → versão do agente → decisão → ferramenta → intervenção
       → pedido → pagamento → margem/reembolso → custo Meta/LLM → resultado líquido
```

**Funcionalidades:**

- `traceId` único da entrada ao pagamento;
- versão de prompt, modelo, knowledge snapshot, tools e guardrails por resposta;
- registro estruturado de ações consideradas, escolhidas e bloqueadas;
- eventos de negócio padronizados: produto recomendado, carrinho criado, checkout gerado, pagamento aprovado, cancelamento, reembolso, handoff e recompra;
- janela de atribuição configurável;
- grupos de holdout para separar correlação de efeito incremental;
- painel de receita influenciada, receita recuperada, margem, custo por resultado e confiança da atribuição.

**Diferencial:** concorrentes mostram funil; o WhatsAgent deve mostrar **por que o resultado ocorreu, quanto custou e qual versão produziu melhor margem**.

**MVP:** somente atribuição determinística para eventos dentro da mesma conversa/pedido. Não prometer causalidade antes de introduzir holdouts.

**Gate de sucesso:** pelo menos 95% dos pedidos originados no chat ligados a uma conversa e versão do agente; divergência financeira inferior a 1% em reconciliação de amostra.

---

### 6.2 Quality Loop — agente que melhora sem “editar prompt em produção”

**Problema:** avaliação automática de conversas já é oferecida por concorrentes. O diferencial precisa estar no ciclo completo da falha à correção segura.

**Proposta:** avaliar IA e humanos em 100% das conversas encerradas e transformar achados em casos de teste reproduzíveis.

**Funcionalidades:**

- scorecards configuráveis por segmento: resolução real, precisão factual, política, empatia, condução comercial, ferramenta correta, margem e esforço do cliente;
- detecção de “falsa resolução”: conversa fechada sem resolver ou sem próximo passo;
- clusterização de falhas e oportunidades por causa raiz;
- botão “converter em teste” a partir de uma conversa, com PII anonimizada;
- dataset ouro revisado por humanos;
- replay offline de versões do agente contra cenários reais e sintéticos;
- comparação lado a lado por qualidade, conversão simulada, violações, custo e latência;
- estados `DRAFT → SHADOW → CANARY → LIVE → ROLLED_BACK`;
- shadow mode em tráfego real sem enviar a resposta alternativa;
- canário por tenant/canal/percentual e rollback automático por limiar;
- changelog legível: o que mudou, quem aprovou e qual métrica justificou a promoção.

**Diferencial:** não é apenas “dar nota”. É **descobrir, reproduzir, corrigir, provar e promover**.

**Gate de sucesso:** redução de 30% nas três falhas mais frequentes em dois ciclos; zero regressão crítica promovida sem detecção; cobertura de replay para pelo menos 80% dos fluxos que geram receita.

---

### 6.3 Conversational Product Intelligence — a voz do cliente vira backlog

**Problema:** milhares de conversas contêm sinais de demanda, objeções, problemas de produto e motivos de perda, mas esses dados ficam presos no histórico.

**Proposta:** minerar conversas continuamente e produzir insights quantificados e rastreáveis.

**Funcionalidades:**

- tópicos e intenção sem taxonomia fixa;
- principais objeções por produto, etapa e canal;
- buscas sem resultado e produtos solicitados que não existem;
- motivos de abandono, handoff, cancelamento e reembolso;
- menções a concorrentes e comparação de preço/benefício;
- dúvidas sem resposta ou respostas de baixa confiança;
- tendência temporal e alerta de anomalia;
- amostras de evidência clicáveis, com dados pessoais mascarados;
- transformação de insight em tarefa: corrigir base, cadastrar produto, criar regra, abrir experimento ou treinar equipe;
- resumo executivo semanal em linguagem natural com impacto estimado.

**Diferencial:** analytics deixa de apenas descrever o atendimento e passa a orientar catálogo, preço, conteúdo e operação.

**Gate de sucesso:** pelo menos três decisões mensais comprovadamente tomadas a partir dos insights em cada tenant piloto; redução de 20% nas buscas sem resultado após 60 dias.

---

### 6.4 Vendedor Visual — busca multimodal e compra guiada

**Problema:** no WhatsApp, o cliente frequentemente envia foto, print, áudio ou uma referência vaga. A análise visual atual responde sobre a imagem, mas não conecta essa referência ao catálogo de forma determinística.

**Proposta:** transformar qualquer mídia em intenção de compra estruturada e catálogo acionável.

**Experiência:**

1. Cliente envia uma foto, print ou áudio: “quero algo parecido, mas azul e até R$ 200”.
2. O sistema extrai atributos, restrições e contexto.
3. Busca híbrida combina embedding de imagem, embedding textual, categoria, preço, estoque e regras do tenant.
4. O agente apresenta 3 opções explicando a correspondência e nunca inventa disponibilidade.
5. WhatsApp Flows coleta tamanho, cor, endereço, agendamento ou customização quando uma estrutura reduz erro.
6. O agente monta kit/combinação respeitando compatibilidade, estoque e margem mínima.
7. Carrinho e pagamento seguem o fluxo já existente.

**Funcionalidades:**

- embeddings multimodais por imagem de produto;
- similaridade visual com filtros estruturados;
- explicação “por que recomendei”;
- comparação lado a lado;
- recomendação de kits, look completo ou complementos;
- substituto automático quando o item esgota;
- aprendizado com clique, escolha, rejeição, compra e devolução;
- fallback explícito para humano quando a confiança for baixa.

**Diferencial:** não é “IA que vê imagem”; é **foto até pedido pago**, com estoque e margem como fontes de verdade.

**Gate de sucesso:** +15% de conversão nas sessões com mídia contra baseline comparável; taxa de recomendação de item indisponível abaixo de 0,5%; aumento de ticket sem aumento de devolução.

---

### 6.5 Customer Memory Graph — continuidade consentida e temporal

**Problema:** histórico bruto é caro, ruidoso e difícil de usar. Campos fixos do contato não capturam preferências com origem, validade ou sensibilidade.

**Proposta:** memória por fatos estruturados, consentidos e auditáveis.

**Tipos de memória:**

- preferências: tamanho, cor, canal, horário e forma de pagamento;
- restrições: alergia, incompatibilidade, orçamento e região de entrega;
- contexto comercial: interesse, objeção, prazo, decisão e próximo passo;
- relacionamento: compras, devoluções, satisfação e promessas feitas;
- memória efêmera: válida apenas para a sessão;
- memória sensível: bloqueada por padrão ou sujeita a consentimento explícito.

Cada fato deve ter `source`, `confidence`, `observedAt`, `validUntil`, `sensitivity`, `consentBasis` e possibilidade de correção/exclusão.

**Experiência:** o cliente não precisa repetir contexto; IA e humano recebem um resumo curto com evidências. O cliente pode perguntar “o que vocês lembram de mim?” e solicitar correção ou exclusão.

**Diferencial:** personalização explicável e controlável, não um resumo opaco da conversa.

**Gate de sucesso:** redução de 25% na repetição de perguntas já respondidas; menos de 1% de contestação de fatos; 100% das exclusões propagadas dentro do SLA definido.

---

### 6.6 Revenue Rescue Autopilot — recuperar valor no momento certo

**Problema:** campanhas genéricas e lembretes fixos geram fadiga, custo e opt-out. O que importa é intervir quando o valor esperado supera o custo e o risco de incomodar.

**Gatilhos iniciais:**

- carrinho abandonado;
- Pix/link de pagamento pendente ou expirado;
- lead qualificado parado no funil;
- produto de interesse voltou ao estoque;
- queda de preço autorizada;
- recompra provável ou renovação próxima;
- pedido entregue sem confirmação/CSAT;
- conversa com promessa de retorno não cumprida.

**Motor de decisão:**

```text
valor esperado = probabilidade incremental de conversão × margem esperada
                 - custo da mensagem
                 - incentivo/desconto
                 - penalidade de fadiga/opt-out
```

**Controles obrigatórios:** opt-in comprovado, opt-out imediato, janela de silêncio, frequência máxima, orçamento, template aprovado, exclusões, limite por contato e holdout permanente de medição.

**Diferencial:** campanhas executam listas; o Autopilot decide **quem não deve receber**, qual momento e se a intervenção compensa economicamente.

**Gate de sucesso:** receita incremental líquida positiva no holdout; opt-out sem aumento estatisticamente relevante; payback de mensagem e incentivo medido por gatilho.

---

### 6.7 Revenue Brain — próxima melhor ação calibrada por resultado

**Problema:** um LLM escolhe respostas plausíveis, mas não aprende sozinho qual estratégia maximiza resultado de longo prazo.

**Proposta:** uma camada de decisão separada do gerador de linguagem, inicialmente baseada em regras e modelos calibrados, que escolhe entre ações permitidas:

- fazer pergunta de descoberta;
- recomendar produto;
- oferecer comparação;
- montar kit;
- pedir dado em WhatsApp Flow;
- gerar pagamento;
- oferecer incentivo autorizado;
- agendar retorno;
- transferir a vendedor especializado;
- encerrar sem insistir.

**Princípios:**

- otimizar margem e satisfação, não só conversão;
- nunca deixar o LLM inventar desconto ou regra comercial;
- manter política e restrições em código/dados estruturados;
- calibrar propensão com resultado observado;
- introduzir contextual bandits apenas depois de A/B tests confiáveis;
- preservar exploração limitada, holdout e limites de segurança.

**Diferencial:** o modelo conversa; o Revenue Brain decide a estratégia usando resultado real e restrições econômicas.

**Gate de sucesso:** uplift de margem por 1.000 conversas com intervalo de confiança definido; nenhuma piora nos limites de reclamação, cancelamento, opt-out e handoff incorreto.

---

### 6.8 Copiloto Comercial Auditável

**Problema:** no handoff, o humano precisa reconstruir contexto, pesquisar informação e decidir rapidamente. Sugestões genéricas de resposta já são commodity.

**Proposta:** um copiloto focado em ação e prova.

**Funcionalidades:**

- resumo de situação, intenção, objeções, sentimento e próximos passos;
- fatos e promessas com links para as mensagens de origem;
- recomendação de próxima ação e motivo;
- sugestões de resposta com fontes da base e dados transacionais;
- checklist por estágio/segmento;
- alerta de risco, política, cliente vulnerável ou alto valor;
- preenchimento assistido de CRM;
- ações de um clique: reservar item, gerar link, mover deal, agendar retorno;
- feedback “útil/não útil” usado no Quality Loop;
- score do atendimento como coaching, sem ranking punitivo opaco.

**Diferencial:** cada sugestão vem com evidência e ação operacional, reduzindo tempo até valor.

**Gate de sucesso:** -25% no tempo de atendimento após handoff; +10% na conversão de conversas assumidas; aceitação de sugestões acima de 40% sem aumento de correções.

---

### 6.9 Vertical Launch Kits

**Problema:** um agente genérico exige muito setup e produz resultados genéricos. O tempo até o primeiro valor é parte do produto.

**Proposta:** kits versionados que entregam, por segmento:

- schema de dados e campos de CRM;
- intents, ferramentas e políticas;
- templates de conhecimento e importadores;
- WhatsApp Flows;
- scorecards de qualidade;
- eventos e funil padrão;
- gatilhos do Revenue Rescue;
- dashboard e benchmarks;
- suite de testes antes da publicação.

**Ordem sugerida:**

1. varejo/e-commerce e redes de lojas;
2. serviços com agendamento;
3. educação/matrícula;
4. imobiliário/qualificação;
5. clínicas somente após reforço de privacidade, consentimento e governança.

**Diferencial:** não vender “um builder”; vender um sistema operacional do segmento que chega validado.

**Gate de sucesso:** primeiro agente publicado com segurança em menos de 60 minutos; primeira automação de valor em até 7 dias; ativação do kit acima de 60% nos tenants elegíveis.

---

### 6.10 Benchmark de Segmento e Inteligência Coletiva

**Problema:** cada empresa vê apenas seus números, sem saber se uma conversão ou taxa de handoff é boa para seu contexto.

**Proposta tardia:** após escala suficiente, oferecer percentis anônimos por segmento, faixa de volume e tipo de operação, acompanhados de recomendações acionáveis.

**Exemplos:**

- “Seu tempo até pagamento está no percentil 35 de lojas semelhantes.”
- “Tenants com menor abandono pedem tamanho antes de apresentar o terceiro item.”
- “A objeção ‘frete’ cresceu 22% no segmento, mas 41% na sua operação.”

**Requisitos antes do lançamento:** base legal, agregação mínima, prevenção de reidentificação, opt-out do tenant, revisão jurídica/LGPD, sem compartilhar prompts, preços ou dados brutos de outro cliente.

**Diferencial:** efeito de rede de dados sem romper isolamento multi-tenant.

**Gate de sucesso:** nenhum grupo abaixo do limiar de anonimato; recomendações adotadas por pelo menos 25% dos tenants que as visualizam; impacto mensurável em ao menos uma métrica.

---

### 6.11 Voz e chamadas inteligentes

A Meta vem ampliando chamadas e voz na Business Platform, e concorrentes já as oferecem. Portanto, voz deve entrar como **extensão da memória e do ledger**, não como produto isolado:

- chamada no mesmo histórico da conversa;
- transcrição e resumo em tempo real;
- consentimento e aviso de gravação;
- IA sugere respostas ou coleta dados; humano assume sem perda de contexto;
- eventos e resultados entram no mesmo funil;
- chamada disparada apenas após solicitação/autorização do cliente.

Priorizar depois que Quality Loop, atribuição e memória estiverem maduros. Caso contrário, adiciona custo e risco a uma operação ainda não mensurada.

---

## 7. Fundação técnica comum

### 7.1 Novos conceitos de domínio

Os nomes são propostos e devem ser refinados no design técnico:

| Conceito | Responsabilidade |
|---|---|
| `AgentVersion` | Snapshot imutável de prompt, modelo, temperatura, knowledge version, tools e regras |
| `AgentDeployment` | Estado e audiência de shadow/canário/live/rollback |
| `DecisionTrace` | Contexto, ações consideradas, ação escolhida, confiança e política aplicada |
| `ToolExecution` | Entrada, saída resumida, duração, erro e efeito colateral de cada ferramenta |
| `OutcomeEvent` | Resultado comercial/operacional ligado a contato, conversa, pedido e trace |
| `Attribution` | Regra, janela, confiança e valor atribuído a uma intervenção |
| `ConversationEvaluation` | Scorecard, evidências, versão do avaliador e revisão humana |
| `EvaluationCase` | Cenário anonimizado com expectativa e severidade |
| `CustomerMemoryFact` | Fato temporal com origem, confiança, sensibilidade e consentimento |
| `ConversationInsight` | Tópico/oportunidade com evidências, frequência e impacto |
| `Experiment` / `Assignment` | Variante, unidade de randomização, holdout e resultado |
| `AutomationPolicy` | Gatilho, elegibilidade, orçamento, frequência e ação permitida |

Não colocar todos os conceitos em `Json`. Campos usados para filtro, segurança, atribuição e auditoria devem ser relacionais e indexados; payloads variáveis podem permanecer em JSON versionado.

### 7.2 Taxonomia mínima de eventos

Padronizar nomes, versão e idempotência:

```text
conversation.started
message.received
message.sent
agent.decision_made
tool.started / tool.succeeded / tool.failed
catalog.searched
product.recommended / product.selected / product.rejected
cart.created / cart.abandoned
checkout.generated
payment.approved / payment.expired / payment.refunded
handoff.requested / handoff.assumed / handoff.resolved
conversation.closed
evaluation.completed / evaluation.reviewed
memory.created / memory.corrected / memory.deleted
automation.eligible / automation.sent / automation.suppressed
experiment.assigned
```

Todo evento deve ter `eventId`, `eventVersion`, `tenantId`, `occurredAt`, `traceId`, origem e chave de idempotência.

### 7.3 Arquitetura de processamento

- manter o caminho crítico de resposta curto;
- executar avaliação, insight, memória e atribuição de modo assíncrono;
- usar RabbitMQ para eventos entre serviços e BullMQ para jobs locais, seguindo a convenção atual;
- criar DLQ, retry com backoff e painel de atraso/erro;
- aplicar outbox transacional nos eventos ligados a pedido/pagamento para não perder resultado;
- isolar recursos por tenant e impedir qualquer consulta de embedding sem filtro de tenant;
- manter ferramentas transacionais determinísticas e idempotentes;
- separar decisão de negócio, geração de linguagem e avaliação em componentes diferentes;
- não permitir que o avaliador aprove automaticamente a própria mudança sem gates.

### 7.4 Observabilidade de IA

Medir por versão e tenant:

- latência por nó e ferramenta;
- tokens/custo de entrada e saída;
- cache hit e qualidade de retrieval;
- taxa de tool call válida, erro e repetição;
- guardrail acionado;
- confiança/calibração;
- qualidade por scorecard;
- conversão, margem e handoff;
- divergência entre shadow e produção;
- drift de tópicos e falhas.

### 7.5 Segurança e privacidade desde o desenho

- classificar PII e dados sensíveis;
- criptografar credenciais e dados sensíveis;
- retenção configurável por tenant e finalidade;
- mascaramento antes de datasets/evals;
- consentimento e base legal registráveis;
- exportação, correção e exclusão de memória do cliente;
- RBAC para insights, traces, gravações e dados financeiros;
- logs de auditoria de publicação, ação manual e mudança de política;
- proteção contra prompt injection em mídia, documentos e knowledge base;
- aprovação humana para desconto, reembolso, alteração cadastral sensível e ações irreversíveis;
- testes explícitos de vazamento entre tenants.

---

## 8. Roadmap de 12 meses orientado por gates

### Fase 0 — Instrumentar e concluir a fundação (semanas 1–8)

**Objetivo:** saber o que funciona antes de otimizar.

Entregas:

- selecionar 3–5 design partners de varejo/e-commerce;
- concluir do Plano 28 o mínimo necessário: multi-número, canal no evento, permissões, campanhas oficiais e custo por mensagem;
- concluir o Plano 22, mas registrar score, explicação e resultado para futura calibração;
- taxonomia de eventos, `traceId`, idempotência e Outcome Ledger MVP;
- `AgentVersion` e snapshot de configuração;
- baseline manual de 150–300 conversas com taxonomia de falhas;
- painel de qualidade, custo, conversão e resultado por versão;
- termos de uso/privacidade e política de retenção revisados para profiling e evals.

**Gate:** atribuição determinística confiável, baseline acordado e zero falha crítica de isolamento/opt-out.

### Fase 1 — Fechar o ciclo de qualidade (semanas 9–16)

**Objetivo:** transformar conversa em melhoria segura.

Entregas:

- avaliações pós-conversa com evidências;
- clusters de falhas e Conversational Product Intelligence;
- dataset ouro e criação de casos a partir da inbox;
- replay em lote e comparação de versões;
- shadow mode e canário por tenant/canal;
- Copiloto Comercial MVP com resumo, fontes e próxima ação;
- relatório semanal de oportunidades para o cliente.

**Gate:** duas melhorias promovidas por evidência, com redução mensurável de falha e sem regressão crítica.

### Fase 2 — Diferenciais de receita visíveis (semanas 17–28)

**Objetivo:** gerar um caso de ROI que o cliente perceba e consiga auditar.

Entregas:

- Customer Memory Graph MVP;
- Vendedor Visual para uma categoria de catálogo;
- WhatsApp Flows para coleta estruturada em 1–2 jornadas;
- Revenue Rescue para carrinho e pagamento pendente;
- holdout por política e dashboard de receita incremental líquida;
- frequência, consentimento, orçamento e suppressions.

**Gate:** ao menos duas apostas com uplift positivo e ausência de piora relevante em opt-out, reclamação, devolução e margem.

### Fase 3 — Otimização e produto vertical (semanas 29–40)

**Objetivo:** sair de regras fixas e empacotar o aprendizado.

Entregas:

- modelos calibrados de propensão e próxima melhor ação;
- experimentos A/B por estratégia;
- Revenue Brain v1, começando por regras + ranking supervisionado;
- kit vertical de varejo/rede de lojas;
- conectores prioritários definidos pelos design partners;
- modelo comercial com módulo de receita recuperada.

**Gate:** uplift de margem por 1.000 conversas replicado em mais de um tenant; kit ativável sem intervenção de engenharia.

### Fase 4 — Efeito de rede e expansão (semanas 41–52)

**Objetivo:** criar moat e abrir novos segmentos com controle.

Entregas:

- benchmarks anônimos com limiar mínimo de agregação;
- recomendações de melhoria por segmento;
- segundo Vertical Launch Kit;
- piloto de chamadas/voz no mesmo histórico e ledger;
- APIs/webhooks de extensão e catálogo de ações aprovadas;
- estudo de outcome-based pricing com reconciliação financeira.

**Gate:** retenção/expansão dos design partners, uso recorrente dos insights e validação jurídica/privacidade do benchmark.

---

## 9. Métricas de inovação

### 9.1 North Star

**Valor de negócio verificado por 1.000 conversas (VBV-1000):**

```text
(receita incremental + custo operacional evitado
 - descontos - reembolsos - custo Meta - custo de IA)
÷ conversas elegíveis × 1.000
```

“Incremental” só deve ser usado com experimento/holdout. Sem isso, exibir “receita influenciada” e o nível de confiança da atribuição.

### 9.2 Métricas de cliente

- conversão conversa → pedido → pagamento;
- margem por 1.000 conversas;
- ticket médio e itens por pedido;
- recuperação incremental de carrinho/pagamento;
- tempo até primeiro valor e tempo até pagamento;
- resolução real sem reabertura;
- esforço do cliente/repetição de contexto;
- CSAT e taxa de reclamação;
- opt-out, bloqueio e qualidade do número;
- devolução/cancelamento pós-recomendação;
- tempo humano economizado e conversão após handoff.

### 9.3 Métricas de qualidade e segurança

- factualidade com evidência;
- tool success rate e ação idempotente;
- recomendação de item sem estoque;
- falsa resolução;
- handoff correto, tardio e desnecessário;
- violações críticas por 1.000 conversas;
- regressões bloqueadas antes de produção;
- tempo de detecção e rollback;
- deleção/correção de memória dentro do SLA;
- incidentes de isolamento entre tenants — alvo absoluto: zero.

### 9.4 Métricas de produto SaaS

- tempo até agente publicado com segurança;
- ativação por módulo inovador;
- WAU de gestores e operadores;
- retenção de 90/180 dias;
- expansão de receita por tenant;
- NRR e churn por segmento;
- custo bruto por conversa e margem SaaS;
- proporção de melhorias originadas em evidência do Quality Loop.

---

## 10. Programa de experimentação

### Design partners

Escolher 3–5 clientes com alto envolvimento e perfis distintos dentro do mesmo recorte. Em troca de acesso antecipado, exigir:

- acesso a resultados de pedido/pagamento;
- ritual quinzenal de feedback;
- revisão de 20–30 conversas/mês;
- autorização específica e anonimização para uso em evals;
- concordância com grupos de holdout.

### Estrutura de cada experimento

1. hipótese e mecanismo esperado;
2. população elegível e unidade de randomização;
3. baseline e métrica primária;
4. limites de segurança;
5. tamanho mínimo/duração;
6. tratamento e holdout persistente;
7. janela de atribuição;
8. decisão pré-definida: promover, iterar ou encerrar;
9. registro do resultado, inclusive quando negativo.

### Primeiros cinco experimentos

| Experimento | Tratamento | Métrica primária | Limite de segurança |
|---|---|---|---|
| Resgate de Pix | lembrete no momento previsto pelo modelo vs. regra fixa/holdout | margem incremental | opt-out e reclamação |
| Busca visual | 3 similares explicados vs. atendimento atual | conversão da sessão | devolução e item sem estoque |
| Resumo de handoff | copiloto com fatos/fontes vs. inbox atual | tempo até resolução | correção do resumo |
| Pergunta de descoberta | Revenue Brain escolhe uma pergunta vs. recomendação imediata | conversão/margem | abandono |
| Correção de falha | nova AgentVersion em canário vs. versão atual | score do caso + resultado real | violações críticas |

---

## 11. Estratégia comercial e embalagem

### Narrativa de venda

Evitar vender “GPT no WhatsApp”. Demonstrar três provas:

1. uma foto vira recomendação, carrinho e Pix;
2. um pagamento abandonado vira receita recuperada com holdout visível;
3. uma falha real vira teste e uma versão melhor do agente sem risco de publicação direta.

### Embalagem sugerida

- **Core:** WhatsApp oficial, inbox, agente, conhecimento, guardrails, catálogo, pedidos e analytics básico.
- **Growth:** Copiloto, Product Intelligence, Memory, Vendedor Visual e Revenue Rescue.
- **Scale:** multiunidade, Quality Lab completo, canário, experimentos, benchmarks, governança e SSO/SLA quando disponíveis.
- **Add-on de resultado:** automações de recuperação com preço ligado a volume ou valor verificado, somente após atribuição/reconciliação confiável.

Não definir preços definitivos antes de medir disposição a pagar e custo de servir. O plano atual da landing page precifica principalmente volume; inovação deve permitir precificar por **valor e governança**, não apenas por número de conversas.

### Canais de aquisição

- parceiros de e-commerce/ERP e agências que operam múltiplas lojas;
- cases com margem/receita incremental auditável;
- auditoria gratuita de 100 conversas como diagnóstico de entrada;
- kit vertical e sandbox com dados de demonstração;
- programa de parceiros para implantação e integrações.

---

## 12. O que não priorizar agora

1. **Builder genérico drag-and-drop:** mercado maduro e alto custo de superfície; kits verticais geram valor mais rápido.
2. **Omnichannel amplo antes do WhatsApp estar excelente:** adicionar muitos canais dilui foco e não cria moat; multi-número e contexto unificado são mais urgentes.
3. **Modelo fundacional próprio:** não há escala/dados para justificar. Investir em avaliação, roteamento de modelos e dados de outcome.
4. **Substituir CRM/ERP completo:** integrar e enriquecer o sistema de registro; evitar recriar suítes horizontais.
5. **Sentiment analysis isolado:** só tem valor quando muda roteamento, qualidade ou ação e é validado no contexto brasileiro.
6. **Voz como demonstração sem ledger e consentimento:** voz aumenta risco, custo e complexidade; entrar após o ciclo de qualidade.
7. **Automação irrestrita de descontos/reembolsos:** manter políticas determinísticas, limites e aprovação humana.
8. **“Agentes que se autoeditam” diretamente em produção:** toda melhoria deve passar por avaliação, shadow, canário e rollback.
9. **Benchmark com poucos tenants:** percentis frágeis geram falsa precisão e risco de reidentificação.

---

## 13. Principais riscos e mitigação

| Risco | Consequência | Mitigação |
|---|---|---|
| Dependência de políticas/preços da Meta | custo inesperado ou restrição de recurso | pricing versionado, feature flags, monitoramento de qualidade e abstração de canal |
| Profiling sem transparência | risco LGPD e perda de confiança | finalidade, base legal, consentimento quando aplicável, explicação, correção e exclusão |
| Otimizar conversão e degradar experiência | spam, opt-out e dano à marca | função objetivo com margem + satisfação + penalidades; frequência e holdout |
| Atribuição falsa | promessa de ROI incorreta | distinguir influenciada de incremental; holdout e reconciliação |
| Viés no lead scoring/roteamento | oportunidades excluídas injustamente | calibração, atributos proibidos, revisão humana e auditoria por grupo quando legítimo |
| Prompt injection/RAG contaminado | ação ou resposta indevida | sanitização, separação de instrução/dado, allowlist de tools e validação de saída |
| Efeito colateral duplicado | pedido/pagamento/mensagem duplicada | idempotency keys, outbox e state machine |
| Vazamento multi-tenant | incidente crítico | filtros obrigatórios, testes adversariais, chaves por tenant e revisão de queries vetoriais |
| Avaliador enviesado ou instável | promoção de versão pior | dataset ouro, versão do avaliador, amostragem humana e múltiplas métricas |
| Custo/latência de IA | margem SaaS ruim | processamento assíncrono, model routing, cache, batches e budgets por tenant |
| Escopo excessivo | atrasos sem validação | gates por hipótese, um vertical e design partners antes de generalização |

---

## 14. Decisões imediatas — próximos 30 dias

1. **Escolher o beachhead:** confirmar varejo/e-commerce multiunidade como primeiro vertical.
2. **Nomear 3–5 design partners:** incluindo pelo menos um com múltiplos números e um com catálogo/pagamento integrado.
3. **Congelar a taxonomia de eventos v1:** antes de expandir analytics ou lead scoring.
4. **Desenhar `AgentVersion`, `DecisionTrace` e `OutcomeEvent`:** revisão conjunta produto, backend, IA, segurança e dados.
5. **Criar baseline:** revisar manualmente 150–300 conversas e identificar as cinco falhas/oportunidades mais frequentes.
6. **Instrumentar o funil atual:** busca → recomendação → carrinho → pagamento → resultado.
7. **Definir a política de experimentos:** holdout, limites de segurança, aprovação e rollback.
8. **Escolher um protótipo de alto impacto:** Vendedor Visual para uma categoria OU Resgate de Pix, conforme dados dos parceiros.
9. **Validar disposição a pagar:** entrevistas baseadas em protótipos e resultado, não em lista de features.
10. **Revisar claims da landing page:** remover ou comprovar números não sustentados e alinhar a mensagem futura à receita verificável.

### Critério para escolher o primeiro protótipo

- escolher **Resgate de Pix** se houver volume suficiente de pagamentos expirados e permissão para mensagens ativas;
- escolher **Vendedor Visual** se mídia já representar parcela relevante das conversas e o catálogo tiver imagens/estoque confiáveis;
- não desenvolver os dois simultaneamente antes de o Outcome Ledger estar operacional.

---

## 15. Definição de sucesso ao fim de 12 meses

O plano será considerado bem-sucedido se:

- o WhatsAgent provar uplift incremental de margem em pelo menos dois tenants;
- toda versão de agente em produção tiver snapshot, avaliação e histórico de rollout;
- pelo menos 80% dos fluxos geradores de receita tiverem casos de regressão;
- Vendedor Visual ou Revenue Rescue tornar-se motivo explícito de compra/expansão;
- tempo até primeiro valor cair para até 7 dias no vertical escolhido;
- não houver incidente de vazamento entre tenants nem automação material fora de política;
- insights conversacionais gerarem decisões recorrentes de catálogo/operação;
- a narrativa comercial migrar de “chatbot com IA” para “receita conversacional verificável”.

---

## 16. Fontes e evidências

### Evidência interna

- `CLAUDE.md` — arquitetura, fluxo ponta a ponta e convenções do produto.
- `packages/database/prisma/schema.prisma` — tenant, agente, conhecimento, guardrails, contatos, conversas, mensagens, pedidos, pagamentos, analytics e CRM.
- `apps/ai-orchestrator/src/graph/` — LangGraph, tools, visão, RAG e guardrail.
- `apps/channel-service/src/` — webhook Meta, mídia, filas e envio.
- `apps/api/src/modules/` — agente, analytics, CRM, pedidos, pagamentos, conversas e billing.
- `.plans/22-ai-lead-scoring.md` e `.plans/28-multicanal-campanhas.md` — capacidades planejadas usadas como fundação.

### Mercado e plataforma — consultados em 22/07/2026

- [Meta — coleção oficial da WhatsApp Business Platform](https://www.postman.com/meta/whatsapp-business-platform/overview): Cloud API, Business Management API, Flows e Embedded Signup; Flows cobre interações estruturadas como agendamento, navegação de produtos e feedback.
- [Meta — campanhas centralizadas, chamadas e voz para empresas](https://about.fb.com/news/2025/07/centralized-campaigns-ai-support-businesses-whatsapp/): direção oficial para chamadas, voice messages e suporte habilitado por IA.
- [respond.io — inbox, AI Agents e CRM](https://respond.io/omnichannel-ai-crm-conversation-platform): agentes que qualificam/fecham, contexto de CRM, roteamento e visibilidade de receita.
- [Wati — suporte, campanhas e agentes](https://www.wati.io/lp/whatsapp-support-agent/): campanhas, Click-to-WhatsApp, catálogo, recuperação, copiloto, voz e múltiplos números.
- [Blip — plataforma conversacional](https://www.blip.ai/): builder, IA, pagamentos e analytics.
- [Blip — Desk Score](https://help.blip.ai/hc/pt-br/articles/37508015695127-Desk-Score-The-Quality-Revolution-in-Customer-Service-with-AI): avaliação automática de conversas e coaching.
- [Zenvia Customer Cloud](https://zenvia.com/customer-cloud/): chatbots de IA, integrações, governança e analytics de Click-to-WhatsApp.

---

## 17. Recomendação final

Executar primeiro o que cria aprendizado proprietário, não o que apenas amplia a lista de funcionalidades:

```text
1. medir resultado e versionar o agente
2. encontrar falhas/oportunidades e testar com segurança
3. lançar um diferencial de receita visível
4. transformar resultado em motor de decisão
5. empacotar por vertical e, só então, criar efeito de rede
```

Se essa sequência for preservada, o WhatsAgent pode deixar de ser comparado por quantidade de automações e passar a ser escolhido pela capacidade de **provar, aprender e ampliar o resultado econômico de cada conversa**.
