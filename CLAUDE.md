# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**WhatsAgent** is a multi-tenant SaaS platform for WhatsApp AI-powered customer service. It is a **Turborepo monorepo** with three services and a frontend, communicating via RabbitMQ.

## Commands

### Root (run from repo root)

```bash
pnpm dev          # Start all apps in parallel via Turborepo
pnpm build        # Build all apps
pnpm test         # Run all tests
pnpm lint         # Lint all apps
pnpm format       # Prettier all TS/TSX/JS/JSON/MD files

pnpm db:migrate   # Run Prisma migrations (dev)
pnpm db:seed      # Seed the database
pnpm db:studio    # Open Prisma Studio

pnpm docker:up    # Start PostgreSQL, Redis, RabbitMQ via Docker Compose
pnpm docker:down  # Stop Docker services
```

### Per-service (use `pnpm --filter <name> <script>`)

```bash
# Channel Service (@whatsagent/channel-service) — NestJS, port 3001
pnpm --filter @whatsagent/channel-service dev
pnpm --filter @whatsagent/channel-service test
pnpm --filter @whatsagent/channel-service test:e2e

# Back-office API (@whatsagent/api) — NestJS, port 3002
pnpm --filter @whatsagent/api dev
pnpm --filter @whatsagent/api test

# Frontend (@whatsagent/web) — Next.js 14, port 3000
pnpm --filter @whatsagent/web dev
pnpm --filter @whatsagent/web lint

# Prisma database package (@whatsagent/database)
pnpm --filter @whatsagent/database migrate:dev
pnpm --filter @whatsagent/database studio
```

### AI Orchestrator (Python, port 8000)

The orchestrator uses a `.venv` and `uv` for dependency management:

```bash
cd apps/ai-orchestrator
uv venv .venv && uv sync           # Install dependencies
.venv/Scripts/uvicorn src.main:app --reload --port 8000   # Dev server (Windows)
pytest                              # Run tests
pytest tests/path/to/test.py       # Run single test file
pytest -k "test_name"              # Run specific test
```

## Architecture

### Service Map

```
port 3000 — web         (Next.js 14 App Router, Clerk Auth, Zustand, Recharts)
port 3001 — channel-service  (NestJS, receives Meta webhook, pushes to RabbitMQ)
port 3002 — api         (NestJS, back-office REST + Socket.io real-time)
port 8000 — ai-orchestrator  (FastAPI + LangGraph, consumes RabbitMQ)

Infrastructure (Docker Compose dev):
  PostgreSQL 15 + pgvector — all persistent data
  Redis 7     — sessions, BullMQ job queues, cache
  RabbitMQ    — cross-service messaging (exchanges: "messages", "ai")
```

### Message Flow (end-to-end)

1. WhatsApp user sends a message → Meta Cloud API fires HMAC-signed webhook to **channel-service** `POST /webhooks/meta`
2. Channel-service validates HMAC, downloads audio (if any) via Whisper, publishes `msg.inbound` event to RabbitMQ exchange `messages`
3. **ai-orchestrator** consumes `msg.inbound` from queue `ai.process`, runs the LangGraph state machine, publishes response to exchange `ai` routing key `ai.response`
4. Channel-service (or api) picks up `ai.response` and sends the reply via Meta Cloud API

### LangGraph State Machine (`apps/ai-orchestrator/src/graph/`)

Nodes in order: `entry → route → reasoning → guard_rail → output → END`

- `entry_node`: builds the dynamic system prompt via `PromptBuilderService`
- `route_node`: classifies intent
- `reasoning_node`: runs the LLM with bound tools (`ALL_TOOLS`)
- `guard_rail_node`: checks for hallucinations/policy violations; can force-handoff
- `output_node`: formats the final reply; triggers human handoff if `should_handoff=True`

The compiled graph is a singleton (`get_agent_graph()`). All config comes from `src/config.py` (pydantic-settings, reads `.env`).

### Multi-tenancy

All database tables include `tenant_id`. The **api** service injects tenant context on every request via an interceptor/decorator (`@CurrentTenant`). The channel-service resolves the tenant from the WhatsApp phone number before publishing to RabbitMQ.

### Packages

- `packages/database` — Prisma schema + migrations + client export. All services that need DB access install `@prisma/client` and reference this schema.
- `packages/shared-types` — TypeScript types shared across services (conversation, order, RabbitMQ event payloads).

### Frontend Structure (`apps/web/src/`)

Route groups:
- `(dashboard)/` — authenticated tenant back-office (sidebar + header layout)
- `(onboarding)/` — setup wizard
- `(public)/` — landing page, login

Key libs: `ky` (HTTP client), `socket.io-client` (real-time), `zustand` (state), `recharts` (charts), `shadcn/ui` + Tailwind CSS v4.

### Design System

Dark OLED palette. Primary colors: `#020617` (bg), `#22C55E` (green/CTA), `#6366F1` (indigo/AI). Font: Plus Jakarta Sans. Cards use glassmorphism (`bg-slate-900/80` + `backdrop-blur-2xl`). Icons: Lucide React at 20×20px (`w-5 h-5`).

## Key Conventions

- **RabbitMQ exchanges**: `messages` (topic) for inbound, `ai` (topic) for AI responses. Routing keys: `msg.inbound`, `ai.response`.
- **BullMQ** is used for internal Node.js job queues (within channel-service and api); RabbitMQ is for cross-service communication.
- **Agents never initiate** conversations — the system is 100% reactive. This keeps Meta Cloud API costs at zero (service conversations) and reduces ban risk.
- **Opt-out handling**: if contact sends "parar"/"stop"/"cancelar", channel-service must set `isOptedOut=true` and block further replies.
- **Guard rails** (`guard_rules` table, per-tenant) control anti-hallucination behavior; the LangGraph `guard_rail` node checks them before every response.
- **Audio messages**: channel-service downloads the media from Meta, transcribes via OpenAI Whisper, and sends the transcript as text to the AI pipeline.

## Environment Variables

See `.env.example` at the root. Key groups:
- `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL` — infra
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` — auth
- `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_WEBHOOK_SECRET` — WhatsApp
- `OPENAI_API_KEY` — LLM + Whisper + embeddings
- `MERCADOPAGO_ACCESS_TOKEN`, `STRIPE_SECRET_KEY` — payments (MP for tenant orders, Stripe for platform billing)
- `CHANNEL_SERVICE_URL`, `AI_ORCHESTRATOR_URL`, `BACKOFFICE_API_URL` — internal service URLs
