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

### Versioning

Manual semver per app, no CI release automation:

```bash
node scripts/bump-version.js <api|web|channel-service> <patch|minor|major|x.y.z>
```

`scripts/build-info.js` resolves `{ version, commit, buildDate }` (git SHA via `git rev-parse --short HEAD`, falling back to platform env vars like `VERCEL_GIT_COMMIT_SHA`). `apps/api` and `apps/channel-service` generate a `build-info.json` via a `prebuild`/`predev` hook (`scripts/gen-build-info.js`) and expose it at `GET /health`. `apps/web` injects `NEXT_PUBLIC_APP_VERSION`/`NEXT_PUBLIC_BUILD_COMMIT`/`NEXT_PUBLIC_BUILD_DATE` at build time via `next.config.mjs` and shows `v{version} · {commit} · API v{apiVersion}` in the Sidebar footer (fetches API `/health` live, silent fallback if unavailable).

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
pnpm --filter @whatsagent/web test          # Jest — unit + component (Testing Library, jsdom per-file)
pnpm --filter @whatsagent/web test:e2e      # Playwright smoke (public pages only, runs in CI)
pnpm --filter @whatsagent/web test:e2e:full # Playwright full flow — LOCAL ONLY, see apps/web/tests/e2e-full/README.md
pnpm --filter @whatsagent/web lhci          # Lighthouse CI against a production build

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
port 3000 — web         (Next.js 14 App Router, JWT+BFF Auth, Zustand, Recharts)
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

- `entry_node`: builds the dynamic system prompt via `PromptBuilderService`, which queries the tenant's `AgentConfig` row (raw SQL) for `llm_model` and persona/handoff fields
- `route_node`: classifies intent
- `reasoning_node`: runs the LLM with bound tools (`ALL_TOOLS`); the LLM instance is built per-tenant from `state["llm_model"]` (falls back to `settings.openai_model_simple`)
- `guard_rail_node`: checks for hallucinations/policy violations against per-tenant `guard_rules`; also reads `AgentConfig.handoffMessage` for tenant-specific handoff copy; can force-handoff
- `output_node`: formats the final reply; triggers human handoff if `should_handoff=True`

The compiled graph is a singleton (`get_agent_graph()`). All config comes from `src/config.py` (pydantic-settings, reads `.env`).

- **Streaming**: `reasoning_node` uses `llm.astream(...)` and emits tokens via `src/services/stream_context.py` (`emit_stream`) to a per-turn contextvar-scoped publisher, routed through RabbitMQ topic `ai.stream` → api → Socket.io (`ai_stream_started/token/ended`, `ai_typing_started/stopped`) → inbox UI renders incrementally. `emit_stream` also logs `ai_first_token_latency` (ms, tenant/conversation) the first time a token fires per turn — the inbound→first-token metric, captured from a `time.perf_counter()` taken when `process_inbound_message` (`src/consumers/rabbitmq.py`) pulls the message off the queue.
- **Test simulator**: `POST /internal/simulate` (`src/routes/internal.py`, HMAC-less but gated by `x-internal-token` == `INTERNAL_API_TOKEN`) runs the exact same `graph.ainvoke()` as production (persona/tools/guard-rails/RAG) for a synthetic one-shot conversation, without publishing to RabbitMQ or sending WhatsApp messages. Called by `apps/api/src/modules/agent/chat-simulator.service.ts` (`POST /agent/chat`, used by `TestSimulator.tsx` in the agent config screens), which falls back to calling OpenAI directly only if the orchestrator is unreachable. Response includes `shouldHandoff`/`handoffReason`, surfaced in the UI as a badge.

### Auth (JWT + BFF proxy — Clerk fully removed)

- **api** (`apps/api/src/modules/auth/`): `auth.controller.ts` (register, login, google, refresh, logout, socket-ticket, me, change-password) + `auth.service.ts` — bcrypt password hashing, JWT access/refresh pairs (`@nestjs/jwt`), refresh tokens stored in Redis (`refresh:` prefix), Google OAuth token validation. `strategies/jwt.strategy.ts` is passport-jwt, Bearer token, payload `{ sub, tenantId }`.
- **Socket auth**: `POST /auth/socket-ticket` issues a 30s single-use ticket stored in Redis (`socket-ticket:` prefix) for the Socket.io handshake.
- **web** (`apps/web/src/app/api/auth/*`): Next.js route handlers (login, register, google, refresh, logout, me, forgot-password) act as a BFF that proxies to the api and sets httpOnly cookies; `apps/web/src/app/api/proxy/[...path]/route.ts` is the generic authenticated proxy for all other backend calls. Client-side: `apps/web/src/contexts/auth-context.tsx` (`AuthProvider`/`useAuth`, `credentials: "include"`) and `apps/web/src/components/auth/AuthShell.tsx` for the split-screen login UI.
- `apps/api/src/modules/clerk/` is an empty leftover directory — safe to delete, not in use.

### Multi-tenancy

All database tables include `tenant_id`. The **api** service injects tenant context on every request via an interceptor/decorator (`@CurrentTenant`). The channel-service resolves the tenant from the WhatsApp phone number before publishing to RabbitMQ.

### Packages

- `packages/database` — Prisma schema + migrations + client export. All services that need DB access install `@prisma/client` and reference this schema.
- `packages/shared-types` — TypeScript types shared across services (conversation, order, RabbitMQ event payloads).

### Frontend Structure (`apps/web/src/`)

Route groups:
- `(dashboard)/` — authenticated tenant back-office (sidebar + header layout): `overview`, `inbox`, `crm`, `catalog`, `orders`, `analytics`, `agent/{persona,rules,knowledge}`, `settings`, `support`
- `(admin)/` — super-admin/platform-operator views (separate layout): `tenants`, `email` (platform SMTP config)
- `(onboarding)/` — setup wizard, including `setup/plan` (Stripe plan selection)
- `(public)/` — landing page, login

Key libs: `ky` (HTTP client), `socket.io-client` (real-time), `zustand` (state), `recharts` (charts), `@tanstack/react-query` (server-state/cache), `@tanstack/react-virtual` (message list virtualization), `shadcn/ui` + Tailwind CSS v4.

**Feature-first components**: pages that outgrew a single file (`settings`, `agent/persona`, `inbox`, `catalog`) have their sections/panels split into `apps/web/src/features/<domain>/components/`, with shared form state/types in `features/<domain>/model/` (e.g. `features/agent/model/persona-form.ts`). The route file itself (`app/**/page.tsx`) stays thin — state + handlers + composition, no inline JSX for entire sections. New large pages should follow this pattern rather than growing as a single file.

### Back-office API modules (`apps/api/src/modules/`)

`auth`, `agent` (persona/rules/knowledge config), `analytics` (`kpis`, `kpi-trends`, `setup-status`, `conversations-chart`, `funnel`, `heatmap`, `handoff-reasons`), `billing` (Stripe — platform subscription/metering), `categories`, `crm` (funnel stages + deals kanban, `crm-progression.service.ts` for auto-progression), `orders`, `payments` (MercadoPago — tenant order payments, distinct from `billing`), `platform-email` (system SMTP sending via BullMQ `email.processor.ts`), `products`, `settings`, `super-admin`, `health`.

- **CRM**: `FunnelStage` (name, color, position, isWon/isLost) and `Deal` (stageId, contactId, title, valueCents, notes, closedAt) Prisma models, both `tenant_id`-scoped. WhatsApp contacts are auto-inserted and advanced through the funnel automatically (see Key Conventions).
- **Platform SMTP**: `PlatformSmtpSettings` is a **platform-wide singleton** (no `tenant_id`), storing host/port/username/`passwordEncrypted` (AES-256-GCM) for outbound system emails (not per-tenant messaging).

### Design System

Dark OLED palette. Primary colors: `#020617` (bg), `#22C55E` (green/CTA), `#6366F1` (indigo/AI). Font: Plus Jakarta Sans. Cards use glassmorphism (`bg-slate-900/80` + `backdrop-blur-2xl`). Icons: Lucide React at 20×20px (`w-5 h-5`).

### Observability & Error Handling (web + api)

- **Sentry**: `@sentry/nextjs` (web) and `@sentry/nestjs` (api). No-op when `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` are unset — dev is unaffected. Web: `apps/web/src/instrumentation.ts` + `instrumentation-client.ts` + `sentry.server.config.ts`/`sentry.edge.config.ts`; `next.config.mjs` wraps with `withSentryConfig` (source-map upload only runs in CI with `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` set). Api: `apps/api/src/instrument.ts` is the **first** import in `main.ts` (required for automatic instrumentation), `SentryModule` registered in `AppModule`, `SentryGlobalFilter` as the catch-all global filter — registered *after* `PrismaExceptionFilter` in `app.useGlobalFilters()` so Prisma errors keep their custom response shape (which itself calls `Sentry.captureException` directly since it short-circuits before the global filter runs).
- **Error boundaries**: one `error.tsx` per route group — `app/(dashboard)/error.tsx`, `(admin)`, `(onboarding)`, `(public)` — rendering `components/shared/RouteErrorFallback.tsx` (reports to Sentry, offers retry + a group-appropriate way back). Sits below each group's `layout.tsx`, so a crash in one page doesn't take down the sidebar/nav. `app/global-error.tsx` is the last-resort fallback for errors escaping the root layout itself.
- **Central error toast**: `shared/api/query-client.ts` wires `QueryCache`/`MutationCache` `onError` to `shared/ui/toast.store.ts` (zustand) + `shared/ui/Toaster.tsx` (mounted once in `app/providers.tsx`) — any failing query/mutation gets a standardized toast without each screen handling it ad hoc. 401s are excluded (middleware/proxy's job to refresh or redirect). Opt out per query/mutation with `meta: { skipToast: true }` for screens with their own inline error state.
- **Web Vitals**: `shared/monitoring/web-vitals.tsx`, posts to `NEXT_PUBLIC_VITALS_URL` via `sendBeacon`.

### Testing

- **Jest** (`apps/web`, `apps/api`, `apps/channel-service`): unit tests everywhere; `apps/web` also has component tests via `@testing-library/react` — opt into `jsdom` per-file with `/** @jest-environment jsdom */` (global `testEnvironment` stays `node` for plain-logic tests). `jest.setup.ts` wires `@testing-library/jest-dom` matchers via `setupFilesAfterEnv`.
- **Playwright smoke** (`apps/web/tests/e2e/`, config `playwright.config.ts`): public pages only (landing, login, protected-route redirect) — no backend needed, spins up `next dev` itself, runs in CI (`ci.yml` job `e2e-web`).
- **Playwright full flow** (`apps/web/tests/e2e-full/`, config `playwright.full.config.ts`, script `test:e2e:full`): login → cached navigation → inbound message via a signed (HMAC) webhook simulating Meta → real-time socket delivery → handoff. **Local only, not in CI** — assumes `pnpm docker:up && pnpm dev` are already running rather than orchestrating postgres/redis/rabbitmq/api/channel-service/ai-orchestrator from scratch. See `tests/e2e-full/README.md`. Requires `META_WEBHOOK_SECRET` in root `.env`/`.env.local` and the seeded dev-tenant (`pnpm db:seed`, which now sets a fixed `whatsappPhoneId` so the simulated webhook resolves to a tenant).
- **Lighthouse CI** (`apps/web/lighthouserc.json`): runs against a real **production build** (`pnpm build && next start`), not dev — dev-mode scores are meaningless (unminified, no ISR). Hard gate (`error` level) on performance/accessibility/best-practices; part of the `e2e-web` CI job.
- **pytest** (`apps/ai-orchestrator`): standard, see Commands above.

## Key Conventions

- **RabbitMQ exchanges**: `messages` (topic) for inbound, `ai` (topic) for AI responses. Routing keys: `msg.inbound`, `ai.response`.
- **BullMQ** is used for internal Node.js job queues (within channel-service and api); RabbitMQ is for cross-service communication.
- **Agents never initiate** conversations — the system is 100% reactive. This keeps Meta Cloud API costs at zero (service conversations) and reduces ban risk.
- **Opt-out handling**: if contact sends "parar"/"stop"/"cancelar", channel-service must set `isOptedOut=true` and block further replies.
- **Guard rails** (`guard_rules` table, per-tenant) control anti-hallucination behavior; the LangGraph `guard_rail` node checks them before every response.
- **Audio messages**: channel-service downloads the media from Meta, transcribes via OpenAI Whisper, and sends the transcript as text to the AI pipeline.
- **Inactivity timer** (`apps/channel-service/src/queue/`, BullMQ `INACTIVITY_QUEUE`): two-phase — a "warn" job sends the tenant's `AgentConfig.inactivityMessage`, then a "close" job (after `CLOSE_GRACE_MINUTES`) sends `AgentConfig.closingMessage`, marks the conversation `CLOSED`, and deletes the Redis session. Timeout is per-tenant via `AgentConfig.inactivityTimeoutMin`.
- **CRM auto-progression**: WhatsApp contacts are auto-inserted into the CRM and advanced through funnel stages (`crm-progression.service.ts`) based on conversation/order activity.
- **Two separate payment rails**: `payments` module (MercadoPago) is for tenant-facing order payments; `billing` module (Stripe) is for platform subscription billing of tenants themselves.
- **Route groups don't add a URL segment** — e.g. a `page.tsx` under `(dashboard)/` at the group root would resolve to the same `/` as the root `app/page.tsx`. Two `page.tsx` resolving to the same path builds without error in `next dev` but corrupts the client reference manifest in a production build (`next start` 500s on that route, dev looks fine). This bit us once (a stray `(dashboard)/page.tsx` duplicating the landing page, since removed) — check for this specifically if a route 500s in production but not in dev.

## Environment Variables

See `.env.example` at the root. Key groups:
- `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL` — infra
- `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN` (15m), `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` (7d), `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — auth (no Clerk vars remain)
- `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_WEBHOOK_SECRET` — WhatsApp
- `OPENAI_API_KEY` — LLM + Whisper + embeddings
- `MERCADOPAGO_ACCESS_TOKEN` — tenant order payments (`payments` module)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_*`, `STRIPE_METER_ID_CONVERSATIONS` — platform subscription billing (`billing` module)
- `CHANNEL_SERVICE_URL`, `AI_ORCHESTRATOR_URL`, `BACKOFFICE_API_URL` — internal service URLs
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` — error tracking (unset = no-op); `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` — CI-only, for web source-map upload; `NEXT_PUBLIC_VITALS_URL` — Web Vitals beacon endpoint
