# WhatsAgent — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir uma plataforma SaaS multi-tenant de agente de IA para atendimento e vendas via WhatsApp, cobrindo desde a integração com Meta Cloud API até o orquestrador LangGraph, back-office completo e dashboard profissional.

**Architecture:** Monorepo (Turborepo) com 3 serviços principais — Channel Service (NestJS), AI Orchestrator (Python/FastAPI+LangGraph), e Back-office API (NestJS) — mais um frontend Next.js 14. Todos os serviços comunicam via RabbitMQ (cross-service) e BullMQ/Redis (jobs internos Node.js). Multi-tenancy via shared schema com Row-Level Security no PostgreSQL + tenant_id em todos os queries.

**Tech Stack:** Next.js 14 (App Router) · NestJS 10 · Python 3.12 + FastAPI · LangGraph 1.x + LangChain · PostgreSQL 15 + pgvector · Redis 7 · RabbitMQ 3.12 · BullMQ · Prisma ORM · shadcn/ui · Tailwind CSS · Socket.io · Clerk Auth · Stripe · Mercado Pago · OpenAI GPT-4o + Whisper · Docker + Kubernetes · Turborepo · GitHub Actions

---

## Sub-Planos (Execução Sequencial por Dependência)

| # | Plano | Depende de | Duração Est. |
|---|-------|------------|--------------|
| 0 | [Foundation & Infrastructure](whatsagent-plan-0-foundation.md) | — | 1 semana |
| 1 | [Channel Service](whatsagent-plan-1-channel-service.md) | Plan 0 | 2 semanas |
| 2 | [AI Orchestrator](whatsagent-plan-2-ai-orchestrator.md) | Plan 0 | 3 semanas |
| 3 | [Back-office API](whatsagent-plan-3-backoffice-api.md) | Plan 0 | 2 semanas |
| 4 | [Frontend Dashboard](whatsagent-plan-4-frontend.md) | Plans 1,2,3 | 3 semanas |
| 5 | [Rules Engine & Analytics](whatsagent-plan-5-rules-analytics.md) | Plans 2,3,4 | 2 semanas |
| 6 | [Multi-Tenant, Billing & Advanced](whatsagent-plan-6-multitenant-billing.md) | Plans 0-5 | 2 semanas |

**Total estimado MVP (Plans 0–4):** ~11 semanas  
**Produto completo (Plans 0–6):** ~15 semanas

---

## Arquitetura Completa do Sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL LAYER                                   │
│  [WhatsApp Clients]          [Tenants Back-office]        [Super Admin] │
└────────────┬────────────────────────┬────────────────────────┬──────────┘
             │ HTTPS Webhook          │ HTTPS REST/WS          │ HTTPS REST
             ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       INGRESS / API GATEWAY                             │
│              Nginx + SSL Termination (prod: Kubernetes Ingress)         │
└────────────┬────────────────────────┬────────────────────────┬──────────┘
             │                        │                        │
             ▼                        ▼                        ▼
┌────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  CHANNEL SERVICE   │  │  BACKOFFICE API      │  │  FRONTEND (Next.js) │
│  NestJS + BullMQ   │  │  NestJS + Socket.io  │  │  App Router + SSR   │
│  Port: 3001        │  │  Port: 3002          │  │  Port: 3000         │
│                    │  │                     │  │                     │
│  • Webhook HMAC    │  │  • REST CRUD APIs   │  │  • Dashboard UI     │
│  • Msg Classifier  │  │  • RBAC/Auth        │  │  • Inbox Realtime   │
│  • Audio Download  │  │  • Inventory API    │  │  • Agent Config     │
│  • Queue Producer  │  │  • Orders API       │  │  • Analytics        │
│  • Meta API Client │  │  • Multi-tenant     │  │  • Test Simulator   │
└────────┬───────────┘  └──────────┬──────────┘  └─────────────────────┘
         │                         │
         └────────────┬────────────┘
                      │ AMQP (RabbitMQ)
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      AI ORCHESTRATOR SERVICE                            │
│                   Python 3.12 + FastAPI + LangGraph                    │
│                          Port: 8000                                     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    LangGraph State Machine                       │   │
│  │  [Entry] → [Route] → [Reason+Tools] → [Guard Rail] → [Output]  │   │
│  │                ↕           ↕               ↕                    │   │
│  │            [Handoff]  [Tool Exec]    [Rewrite/Fallback]         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Tools: catalog_search | get_stock | generate_payment_link | create_order│
│         transfer_to_human | verify_hours | get_history | add_to_cart   │
└──────────┬──────────────────────────────────────────────────────────────┘
           │
     ┌─────┼──────────────────────┬─────────────────────┐
     ▼     ▼                      ▼                     ▼
┌─────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  REDIS 7    │  │  POSTGRESQL 15       │  │  RABBITMQ 3.12       │
│             │  │  + pgvector          │  │                      │
│  • Sessions │  │  • All tenant data   │  │  • msg.inbound       │
│  • Cart     │  │  • Conversations     │  │  • msg.outbound      │
│  • Cache    │  │  • Embeddings        │  │  • ai.process        │
│  • BullMQ   │  │  • Audit logs        │  │  • notifications     │
│  • Pub/Sub  │  │  • Orders            │  │  • handoff.events    │
└─────────────┘  └──────────────────────┘  └──────────────────────┘
                          │
                  ┌───────┴──────────┐
                  ▼                  ▼
         ┌──────────────┐  ┌──────────────────┐
         │  OPENAI APIs │  │  MERCADO PAGO /  │
         │  GPT-4o      │  │  STRIPE          │
         │  Whisper-1   │  │  Payment GW      │
         │  Embeddings  │  │                  │
         └──────────────┘  └──────────────────┘
```

---

## UI/UX Design System

### Paleta de Cores Principal (Dark OLED + Professional)

```
Design Token          Hex         Tailwind        Uso
─────────────────────────────────────────────────────────────────────────
--bg-base             #020617     bg-[#020617]    Fundo global (OLED black)
--bg-surface-1        #0F172A     bg-slate-900    Cards, sidebars
--bg-surface-2        #1E293B     bg-slate-800    Cards secundários, inputs
--bg-surface-3        #334155     bg-slate-700    Hover states, borders
--color-primary       #22C55E     bg-green-500    CTA, ações principais (WhatsApp DNA)
--color-primary-dim   #16A34A     bg-green-600    Hover do CTA
--color-accent        #6366F1     bg-indigo-500   AI features, badges de IA
--color-accent-dim    #4F46E5     bg-indigo-600   Hover accent
--color-warning       #F59E0B     bg-amber-500    Alertas, pendências
--color-danger        #EF4444     bg-red-500      Erros, cancelamentos
--color-success       #22C55E     bg-green-500    Confirmações
--text-primary        #F8FAFC     text-slate-50   Texto principal
--text-secondary      #CBD5E1     text-slate-300  Subtítulos
--text-muted          #64748B     text-slate-500  Labels, placeholders
--border-default      #1E293B     border-slate-800 Bordas sutis
--border-focus        #6366F1     border-indigo-500 Focus ring
```

### Glassmorphism Cards (componente base)
```css
.glass-card {
  background: rgba(15, 23, 42, 0.8);          /* bg-slate-900/80 */
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05);
}
```

### Tipografia
```
Font Family: Plus Jakarta Sans
Import: https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap

Hierarquia:
H1: 36px / weight 700 / tracking -0.02em / line-height 1.2
H2: 28px / weight 700 / tracking -0.01em / line-height 1.25
H3: 22px / weight 600 / tracking 0      / line-height 1.3
H4: 18px / weight 600 / tracking 0      / line-height 1.4
Body: 15px / weight 400 / line-height 1.6
Small: 13px / weight 400 / line-height 1.5
Label: 12px / weight 500 / tracking 0.04em / uppercase
Mono: JetBrains Mono 13px (código, debug logs)
```

### Componentes de Interface por Tela

#### 1. Landing Page (Marketing)
- **Layout:** Hero com gradiente #020617 → #0F172A, headline animada com Typewriter
- **Seções:** Hero CTA → Social Proof (logos) → Features Bento Grid → How It Works → Pricing Cards → Testimonials → Final CTA
- **Animações:** Framer Motion scroll-triggered, floating WhatsApp mock-up com mensagens animadas
- **Efeito especial:** Particle/glow background no hero (tsParticles verde)

#### 2. Dashboard Principal (Analytics Overview)
- **Layout:** Sidebar esquerda (240px colapsável) + Header top (64px) + Main content area
- **Sidebar:** Logo + Nav items com ícones Lucide + Avatar usuário na base
- **KPI Cards (topo):** 4 cards glassmorphism — Conversas Hoje, Taxa Resolução IA, Receita do Dia, Handoffs Pendentes
- **Charts:** Recharts — LineChart (conversas/dia últimos 30d), BarChart (resolução por hora), PieChart (canais)
- **Tabela:** Últimas conversas com status badge colorido (ativa/aguardando/finalizada/handoff)

#### 3. Unified Inbox (Conversas ao Vivo)
- **Layout:** 3 colunas — Lista conversas (280px) + Chat view (flex) + Context panel (320px)
- **Lista:** Avatar contato + nome + última mensagem preview + timestamp + badge status
- **Chat:** Bolhas estilo WhatsApp (verde = agente/bot, cinza = cliente) + typing indicator + audio player inline
- **Context:** Dados do cliente + histórico de pedidos + actions (assumir, encerrar, notas)
- **Real-time:** WebSocket — novas mensagens chegam sem refresh

#### 4. Configuração do Agente IA
- **Layout:** Wizard com steps (Persona → Knowledge Base → Regras → Horários → Teste)
- **Persona editor:** Form com campos name, tone selector (visual cards), greeting template
- **Knowledge Base:** Upload de PDFs com progress, editor de FAQs inline (markdown), preview de embeddings
- **Test Simulator:** Chat iframe integrado — operador conversa com o próprio agente antes de publicar
- **Debug Panel:** Accordion com LangGraph nodes executados + tool calls + guard rail decisions

#### 5. Gestão de Catálogo
- **Layout:** Grid/Table toggle + filtros sidebar + search full-text
- **Product Card:** Imagem produto + nome + preço + estoque (badge colorido) + ações rápidas
- **Drawer de edição:** Form completo com multi-imagem, variações, categoria, status
- **Bulk Import:** Drop zone CSV/Excel + preview tabela + mapeamento de colunas

#### 6. Gestão de Pedidos
- **Layout:** Kanban por status (DRAFT → AWAITING_PAYMENT → CONFIRMED → PROCESSING → DELIVERED) + list view
- **Order Card:** Número do pedido + cliente + valor + data + badges de pagamento
- **Order Detail:** Timeline de eventos + itens + payment link info + actions

#### 7. Analytics Avançado
- **Funil:** Conversas → Catálogo Consultado → Pagamento Gerado → Pago
- **Heatmap:** Horários de maior volume de mensagens
- **Performance IA:** Taxa de acerto por intenção + handoff reasons breakdown
- **Revenue:** MRR cards + cohort retention (futuro)

#### 8. Human Support Panel
- **Badge contador** no ícone do menu (fila de handoffs)
- **Queue view:** Cards ordenados por tempo de espera + priority flag
- **Chat view:** Mesmo componente do Inbox com banner "HANDOFF ATIVO" destacado
- **Actions:** Notas internas, retornar para IA, encerrar, tags

#### 9. Super Admin (Operator Panel)
- **Tenants table:** Nome, plano, status WhatsApp, uso de mensagens, receita
- **Tenant detail:** Config completa, impersonation, métricas
- **Billing overview:** Stripe integration com MRR, churn, próximas cobranças

#### 10. Onboarding / Setup Wizard
- **Multi-step flow:** Conta → Empresa → WhatsApp QR/API Key → Primeiro produto → Preview
- **Progresso visual:** Steps no topo com animação de completion

### Ícones
```
Biblioteca: Lucide React (consistente, MIT license)
Tamanho padrão: 20x20px (w-5 h-5)
Ícones chave:
  MessageSquare = conversas
  Bot = agente IA
  Package = produtos/catálogo
  ShoppingCart = pedidos
  BarChart3 = analytics
  Users = equipe/contatos
  Settings = configurações
  Zap = automações/regras
  PhoneCall = handoff humano
  Shield = segurança
  Webhook = integrações
```

---

## Estrutura do Monorepo

```
whatsapp-ia-agent/
├── apps/
│   ├── web/                          # Next.js 14 App Router
│   │   ├── app/
│   │   │   ├── (public)/             # Landing page, login
│   │   │   ├── (dashboard)/          # Tenant back-office
│   │   │   │   ├── layout.tsx        # Sidebar + header
│   │   │   │   ├── page.tsx          # Dashboard overview
│   │   │   │   ├── inbox/            # Unified inbox
│   │   │   │   ├── agent/            # AI agent config
│   │   │   │   ├── catalog/          # Products
│   │   │   │   ├── orders/           # Orders & payments
│   │   │   │   ├── analytics/        # Reports
│   │   │   │   ├── support/          # Human panel
│   │   │   │   └── settings/         # Tenant settings
│   │   │   └── (admin)/              # Super admin
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui base
│   │   │   ├── chat/                 # Inbox components
│   │   │   ├── charts/               # Recharts wrappers
│   │   │   ├── agent/                # Agent config components
│   │   │   └── shared/               # Layout, nav, etc
│   │   ├── lib/
│   │   │   ├── api.ts                # API client (ky)
│   │   │   ├── socket.ts             # Socket.io client
│   │   │   └── store/                # Zustand stores
│   │   └── hooks/                    # Custom React hooks
│   │
│   ├── api/                          # NestJS Back-office API
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/             # JWT + Clerk webhooks
│   │   │   │   ├── tenants/          # Tenant management
│   │   │   │   ├── users/            # User RBAC
│   │   │   │   ├── products/         # Inventory CRUD
│   │   │   │   ├── orders/           # Order lifecycle
│   │   │   │   ├── conversations/    # Chat history
│   │   │   │   ├── analytics/        # Metrics queries
│   │   │   │   ├── agent-config/     # Persona, KB, rules
│   │   │   │   ├── payments/         # Mercado Pago webhooks
│   │   │   │   └── notifications/    # Push, email
│   │   │   ├── common/
│   │   │   │   ├── guards/           # Auth, RBAC guards
│   │   │   │   ├── decorators/       # @CurrentTenant, @Role
│   │   │   │   ├── interceptors/     # Tenant context injector
│   │   │   │   └── pipes/            # Validation
│   │   │   └── gateways/
│   │   │       └── events.gateway.ts # Socket.io real-time
│   │   └── test/
│   │
│   ├── channel-service/              # NestJS Channel Service
│   │   ├── src/
│   │   │   ├── webhook/              # Meta API webhook receiver
│   │   │   ├── messaging/            # Send message via Meta API
│   │   │   ├── audio/                # Download + Whisper transcription
│   │   │   ├── session/              # Redis conversation sessions
│   │   │   └── queue/                # BullMQ producers
│   │   └── test/
│   │
│   └── ai-orchestrator/              # Python FastAPI + LangGraph
│       ├── src/
│       │   ├── main.py               # FastAPI app entry
│       │   ├── graph/
│       │   │   ├── agent.py          # LangGraph graph definition
│       │   │   ├── nodes.py          # All graph nodes
│       │   │   ├── state.py          # ConversationState TypedDict
│       │   │   └── tools.py          # All LangChain tools
│       │   ├── services/
│       │   │   ├── llm.py            # OpenAI client abstraction
│       │   │   ├── embeddings.py     # pgvector semantic search
│       │   │   ├── session.py        # Redis session manager
│       │   │   ├── prompt_builder.py # Dynamic system prompt
│       │   │   └── guard_rail.py     # Anti-hallucination pipeline
│       │   ├── consumers/
│       │   │   └── rabbitmq.py       # RabbitMQ message consumer
│       │   ├── models/
│       │   │   └── schemas.py        # Pydantic models
│       │   └── db/
│       │       └── postgres.py       # SQLAlchemy async
│       ├── tests/
│       └── pyproject.toml
│
├── packages/
│   ├── database/                     # Prisma schema + seed + migrations
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Todos os modelos
│   │   │   └── migrations/
│   │   └── src/
│   │       └── index.ts              # Prisma client export
│   │
│   ├── shared-types/                 # TypeScript types compartilhados
│   │   └── src/
│   │       ├── tenant.types.ts
│   │       ├── conversation.types.ts
│   │       ├── order.types.ts
│   │       └── events.types.ts       # RabbitMQ event payloads
│   │
│   └── ui-kit/                       # Componentes shadcn/ui customizados
│       └── src/
│           ├── components/
│           └── styles/
│               └── globals.css       # Design tokens CSS vars
│
├── infra/
│   ├── docker/
│   │   ├── Dockerfile.web
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.channel
│   │   └── Dockerfile.ai
│   ├── k8s/
│   │   ├── namespaces/
│   │   ├── deployments/
│   │   ├── services/
│   │   ├── ingress/
│   │   └── configmaps/
│   └── terraform/
│       ├── main.tf
│       ├── variables.tf
│       └── modules/
│           ├── eks/
│           ├── rds/
│           └── elasticache/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint + test em PRs
│       └── deploy.yml                # Deploy em main merge
│
├── docker-compose.yml                # Dev local completo
├── docker-compose.test.yml           # E2E test environment
├── turbo.json                        # Turborepo pipeline
├── package.json                      # Root workspace
└── .env.example                      # Todas as vars necessárias
```

---

## Schema do Banco de Dados (Visão Geral)

### Tabelas Principais

```
tenants              → Empresa/cliente da plataforma
├── users            → Operadores do tenant (RBAC)
├── agent_configs    → Persona, KPIs, regras do agente
├── knowledge_bases  → Documentos indexados (RAG)
├── products         → Catálogo de produtos
├── product_vectors  → Embeddings dos produtos (pgvector)
├── contacts         → Clientes do WhatsApp
├── conversations    → Threads de conversa
│   └── messages     → Mensagens individuais
├── sessions         → Estado Redis espelhado (checkpoint)
├── orders           → Pedidos gerados
│   └── order_items  → Itens do pedido
├── payments         → Transações de pagamento
├── guard_rules      → Regras anti-alucinação configuradas
├── handoff_events   → Histórico de transferências
├── analytics_events → Eventos para analytics
└── audit_logs       → Log imutável de ações back-office

platform_billing     → Billing Stripe do tenant na plataforma
plan_features        → Features por plano de assinatura
```

---

## Variáveis de Ambiente (Completo)

```bash
# === INFRA ===
DATABASE_URL=postgresql://user:pass@localhost:5432/whatsagent
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://user:pass@localhost:5672

# === AUTH (Clerk) ===
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# === WHATSAPP META CLOUD API ===
META_APP_ID=...
META_APP_SECRET=...
META_VERIFY_TOKEN=...
META_WEBHOOK_SECRET=...  # HMAC-SHA256

# === OPENAI ===
OPENAI_API_KEY=sk-...
OPENAI_MODEL_COMPLEX=gpt-4o
OPENAI_MODEL_SIMPLE=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_WHISPER_MODEL=whisper-1

# === PAYMENTS ===
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=...
STRIPE_SECRET_KEY=sk_...          # plataforma SaaS billing
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# === STORAGE ===
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=sa-east-1
AWS_S3_BUCKET=whatsagent-media

# === MONITORING ===
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# === SERVICES (internal) ===
CHANNEL_SERVICE_URL=http://channel-service:3001
AI_ORCHESTRATOR_URL=http://ai-orchestrator:8000
BACKOFFICE_API_URL=http://api:3002
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=ws://localhost:3002
```

---

## Pricing Definido

| Plano | Preço/mês | Conversas | Excedente | Margem bruta est. |
|-------|-----------|-----------|-----------|-------------------|
| Trial | Grátis (14d) | 100 | — | — |
| STARTER | R$ 197 | 500 | R$ 0,60/conv | ~85% |
| GROWTH | R$ 497 | 3.000 | R$ 0,60/conv | ~64% |
| SCALE | R$ 997 | 10.000 | R$ 0,40/conv | ~40% |
| ENTERPRISE | Sob consulta | Ilimitado | — | negociado |

**Anuais:** 20% de desconto (cobrado mensalmente via Stripe).
**Unidade:** "Conversa" = thread completa com 1 contato (não mensagens individuais).
**Custo dominante:** OpenAI API — mix 80% gpt-4o-mini + 20% gpt-4o.
**Meta Cloud API:** conversas de serviço (usuário inicia) são gratuitas na janela 24h.

---

## Estratégia de Infraestrutura (Deploy Progressivo)

Evitar custo de infra desnecessário no início. Migrar para infraestrutura mais robusta conforme receita cresce.

### Fase 1 — MVP (0–5 tenants) · Custo: ~R$110/mês

| Serviço | Plataforma | Plano | Custo |
|---------|-----------|-------|-------|
| API + Channel Service | Railway | Starter (~$5/serviço) | R$ 55 |
| AI Orchestrator (Python) | Railway | Starter | R$ 55 |
| Frontend (Next.js) | Vercel | Hobby (grátis) | R$ 0 |
| PostgreSQL + pgvector | Supabase | Free (500MB) | R$ 0 |
| Redis | Upstash | Free (10k req/dia) | R$ 0 |
| RabbitMQ | CloudAMQP | Free (1M msgs/mês) | R$ 0 |
| Storage (áudios/imagens) | Cloudflare R2 | Free (10GB) | R$ 0 |
| Auth | Clerk | Free (10k MAU) | R$ 0 |
| Monitoramento | Sentry | Free (5k erros/mês) | R$ 0 |
| **Total fixo** | | | **~R$ 110/mês** |

**Break-even: 1 cliente STARTER (R$197) já cobre tudo.**

### Fase 2 — Crescimento (5–30 tenants) · Custo: ~R$350/mês

Quando atingir limites dos tiers gratuitos:

| Upgrade | Gatilho | Custo adicional |
|---------|---------|----------------|
| Supabase Pro | DB > 500MB ou > 2GB storage | +R$ 110/mês |
| Upstash Pro | > 10k req/dia ou latência alta | +R$ 55/mês |
| CloudAMQP Lemur | > 1M msgs/mês | +R$ 55/mês |
| Vercel Pro | Build lento ou > 100GB bandwidth | +R$ 110/mês |
| **Total** | | **~R$ 330–440/mês** |

**Break-even: 3 clientes STARTER ou 1 GROWTH.**

### Fase 3 — Escala (30–100 tenants) · Custo: ~R$800/mês

Migrar para VPS dedicado (mais controle e custo por GB melhor):

| Serviço | Plataforma | Custo |
|---------|-----------|-------|
| VPS principal (8 vCPU, 16GB) | Hetzner CX41 | R$ 220/mês |
| PostgreSQL gerenciado | Supabase Pro ou RDS | R$ 220/mês |
| Redis gerenciado | Upstash Pay-as-you-go | R$ 110/mês |
| RabbitMQ | CloudAMQP ou self-hosted | R$ 110/mês |
| CDN + Storage | Cloudflare R2 + CDN | R$ 55/mês |
| Backups automáticos | Incluído no DB gerenciado | R$ 0 |
| **Total** | | **~R$ 715–825/mês** |

**Break-even: 6 clientes STARTER ou 2 GROWTH.**

### Fase 4 — Produto maduro (100+ tenants) · Custo: R$1.500–3.000/mês

Kubernetes (EKS/GKE) com auto-scaling, namespace por tenant tier, SLA contratual.
A receita nesse ponto (100× R$197 mínimo = R$19.700/mês) cobre com folga.

---

### Regra de migração

```
Métrica                → Ação
─────────────────────────────────────────────────────────
DB > 400MB             → Upgrade Supabase Pro
Redis > 8k req/dia     → Upgrade Upstash
Latência API > 500ms   → Adicionar instância Railway
Tenants > 25           → Migrar para VPS Hetzner
Tenants > 80           → Kubernetes
```

### O que nunca terceirizar (custo fixo inescapável)

| Item | Por quê não dá pra eliminar |
|------|---------------------------|
| OpenAI API | Custo variável — só existe se houver conversa |
| Clerk Auth | Free até 10k MAU — suficiente para ~200 tenants com 50 usuários |
| Meta Cloud API | Gratuito para mensagens de serviço (usuário inicia) |
| Stripe | 2,9% só sobre o que entra — sem receita, sem custo |

---

## Decisões Técnicas Justificadas

| Decisão | Alternativa Considerada | Justificativa |
|---------|------------------------|---------------|
| LangGraph vs CrewAI | CrewAI, AutoGen | LangGraph: melhor para fluxos stateful com branching complexo; LangSmith nativo para debugging; 57% das orgs em prod usam |
| NestJS vs Fastify | Fastify, Express | NestJS: DI nativo, módulos, decorators, WebSocket built-in; essencial para codebase grande e testável |
| Clerk vs Auth.js | Auth.js, Firebase Auth | Clerk: MFA nativo, org/tenant concept nativo, webhooks, menor boilerplate; custo justificado pela velocidade |
| PostgreSQL+pgvector vs Pinecone | Pinecone, Weaviate | pgvector: elimina dependência externa, dados co-localizados, menor latência, sem custo adicional |
| BullMQ vs SQS | AWS SQS, Celery | BullMQ: Redis-native (já usamos), APIs ricas, UI com Bull Board, zero infra adicional no dev |
| RabbitMQ vs Kafka | Kafka | RabbitMQ: menor complexidade, routing nativo, prefetch por consumer; Kafka seria overkill para MVP |
| Mercado Pago vs Stripe (tenant) | Stripe para tudo | MP: maior adoção no Brasil, Pix nativo com webhook imediato; Stripe mantido para billing da plataforma |
| Turborepo vs Nx | Nx | Turborepo: menor curva, pipeline simples, excelente com pnpm workspaces |
| shadcn/ui vs Chakra | Chakra, MUI, Ant | shadcn: sem bundle overhead (copy/paste), dark mode nativo, customizável ao máximo, Tailwind-native |

---

## Dependências de Execução dos Sub-Planos

```
Plan 0 (Foundation)
    ├── Monorepo + Turborepo
    ├── Docker Compose (todos os serviços)
    ├── Prisma schema completo + migrations
    ├── Clerk Auth setup
    ├── CI/CD GitHub Actions
    └── Shared types package
         │
         ├── Plan 1 (Channel Service) ─────────────────────────┐
         │       Meta API webhook + BullMQ + Whisper            │
         │                                                      │
         ├── Plan 2 (AI Orchestrator) ───────────────────┐     │
         │       LangGraph + Tools + Guard Rails          │     │
         │                                                │     │
         └── Plan 3 (Back-office API) ──────────────────┐│     │
                 REST CRUD + RBAC + Socket.io            ││     │
                                                         ▼▼     ▼
                                               Plan 4 (Frontend)
                                               Next.js + All screens
                                                         │
                                    ┌────────────────────┤
                                    ▼                    ▼
                             Plan 5 (Rules)      Plan 6 (Multi-tenant)
                             Rule Engine +       Billing + Onboarding +
                             Analytics           Super Admin
```

---

## Estratégia de Testes

| Camada | Ferramenta | Cobertura Mínima |
|--------|-----------|------------------|
| Unit (TS) | Jest + ts-jest | 80% linhas |
| Unit (Python) | pytest + pytest-asyncio | 80% linhas |
| Integration (API) | Jest + Supertest | Todos os endpoints |
| Integration (DB) | Jest + testcontainers | Queries críticas |
| E2E (Frontend) | Playwright | Fluxos principais |
| Load | k6 | 100 msgs/s no Channel Service |
| AI Quality | LangSmith evals | Taxa acerto > 90% |

---

## Fase de Desenvolvimento por Semana

```
Semana 1:    Plan 0 completo — Foundation & Infrastructure
Semana 2-3:  Plan 1 — Channel Service (webhook, queue, Whisper)
Semana 2-4:  Plan 2 — AI Orchestrator (paralelo com Plan 1)
Semana 2-3:  Plan 3 — Back-office API (paralelo com Plans 1-2)
Semana 5-7:  Plan 4 — Frontend (aguarda Plans 1-3)
Semana 8-9:  Plan 5 — Rules Engine + Analytics
Semana 10-11: Plan 6 — Multi-tenant, Billing, Super Admin
─────────────────────────────────────────────────────
MVP Go-Live: Semana 8 (Plans 0-4 completos + pilot tenant)
Produto completo: Semana 11
```

---

## Proteções Anti-Banimento WhatsApp

**Decisão arquitetural:** o agente é **100% reativo** — nunca inicia conversa. Sempre é o cliente quem manda a primeira mensagem para o número do tenant. Isso elimina os principais riscos de banimento e torna todas as conversas gratuitas na Meta Cloud API (janela de serviço de 24h).

### Impacto desta decisão

| Item | Consequência |
|------|-------------|
| Custo Meta API | **R$0** — conversas de serviço (usuário inicia) são gratuitas |
| Risco de banimento por spam | **Muito baixo** — não há disparo proativo |
| Warm-up de número novo | **Simplificado** — volume cresce organicamente conforme clientes chegam |
| Opt-in | **Implícito e documentado** — cliente iniciou, logo deu consentimento |
| Templates | **Desnecessários** no fluxo principal — só necessário se futuramente enviar notificações pós-venda |

### Proteção 1 — Monitor de saúde do número (Plan 1: Channel Service)

Mesmo sendo reativo, picos de volume de resposta ou alto índice de bloqueio podem degradar o rating. Job diário que consulta a Meta Cloud API:

```
GET https://graph.facebook.com/v21.0/{phone-number-id}
Retorna: quality_rating = "GREEN" | "YELLOW" | "RED"
```

| Rating | Ação automática |
|--------|----------------|
| GREEN | Nenhuma |
| YELLOW | Banner de alerta no dashboard + email ao tenant |
| RED | Suspender envios + notificação urgente |

```typescript
// apps/api/src/queue/phone-health.processor.ts
// Cron: todo dia às 07:00 (BullMQ repeat)
// Para cada tenant com whatsappStatus = CONNECTED:
//   GET Meta Graph API → quality_rating
//   Se mudou → atualizar DB + emitir WsEvent ao frontend
//   Se RED → setar flag no Redis bloqueando envios + email urgente
```

Adicionar ao schema Prisma:
```prisma
// No modelo Tenant:
whatsappQualityRating  String?   // "GREEN" | "YELLOW" | "RED"
whatsappQualityCheckedAt DateTime?
```

### Proteção 2 — Opt-out e documentação de consentimento (Plan 0 + Plan 3)

Cliente inicia → consentimento implícito. Registrar para proteção LGPD e defesa junto ao Meta:

```prisma
// No modelo Contact:
optInAt         DateTime? // timestamp da primeira mensagem recebida
optInMessage    String?   // texto da primeira mensagem (evidência)
isOptedOut      Boolean   @default(false)
optOutAt        DateTime?
```

Regras:
- Primeira mensagem recebida de um contato → registrar `optInAt` e `optInMessage` automaticamente
- Se contato enviar "parar", "stop", "cancelar", "sair", "não quero" → setar `isOptedOut = true`, bloquear respostas, registrar `optOutAt`
- Channel Service verifica `isOptedOut` antes de qualquer envio
- Sem necessidade de pedir opt-in explícito — o próprio ato de mandar mensagem é o consentimento

### O que NÃO precisa ser implementado (simplificação)

- ~~Warm-up automático~~ — desnecessário com modelo reativo orgânico
- ~~Templates de marketing~~ — sem disparo ativo, não há necessidade no MVP
- ~~Opt-in form~~ — consentimento é capturado pela própria mensagem do cliente

---

## Verificação Final do Master Plan

Para validar que o sistema está funcional end-to-end:

- [ ] Docker Compose sobe todos os serviços sem erros (`docker compose up -d`)
- [ ] Webhook Meta recebe e processa mensagem de teste
- [ ] Mensagem de texto percorre todo o pipeline: webhook → queue → LangGraph → resposta Meta API
- [ ] Mensagem de áudio é transcrita pelo Whisper e processada
- [ ] Ferramenta `catalog_search` retorna produtos relevantes via pgvector
- [ ] Pagamento Pix é gerado e confirmado via webhook Mercado Pago
- [ ] Handoff para humano notifica operador em tempo real via WebSocket
- [ ] Back-office mostra conversa com histórico completo
- [ ] Regra anti-alucinação bloqueia resposta indevida
- [ ] Dashboard exibe KPIs corretos
- [ ] Tenant isolado não vê dados de outro tenant
- [ ] CI passa em todos os PRs (lint + test + build)
