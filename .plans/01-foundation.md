# WhatsAgent — Plan 0: Foundation & Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar o monorepo Turborepo completo, Docker Compose com todos os serviços, schema Prisma com todas as tabelas, autenticação Clerk, pacotes compartilhados e pipeline CI/CD — base para todos os sub-planos subsequentes.

**Architecture:** Turborepo monorepo com pnpm workspaces. PostgreSQL 15 + pgvector + Redis 7 + RabbitMQ 3.12 no Docker Compose. Prisma ORM com schema multi-tenant (shared DB, tenant_id). Clerk para auth (webhooks sincronizam user no DB local).

**Tech Stack:** pnpm 9 · Turborepo 2 · Docker Compose 3.9 · PostgreSQL 15 + pgvector · Redis 7 · RabbitMQ 3.12 · Prisma 5 · Clerk · TypeScript 5 · GitHub Actions · Jest · ESLint + Prettier

---

## Estrutura de Arquivos deste Plano

```
Criar:
  package.json                         (root workspace)
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
  .eslintrc.base.js
  .prettierrc
  docker-compose.yml
  docker-compose.test.yml
  .env.example
  .github/workflows/ci.yml
  packages/database/prisma/schema.prisma
  packages/database/src/index.ts
  packages/database/package.json
  packages/shared-types/src/index.ts
  packages/shared-types/src/tenant.types.ts
  packages/shared-types/src/conversation.types.ts
  packages/shared-types/src/order.types.ts
  packages/shared-types/src/events.types.ts
  packages/shared-types/package.json
  apps/web/package.json                (scaffold Next.js)
  apps/api/package.json                (scaffold NestJS)
  apps/channel-service/package.json    (scaffold NestJS)
  apps/ai-orchestrator/pyproject.toml  (scaffold FastAPI)
```

---

### Task 1: Inicializar Monorepo com Turborepo + pnpm

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`

- [ ] **Step 1: Criar package.json root**

```json
{
  "name": "whatsagent",
  "version": "0.0.0",
  "private": true,
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "format": "prettier --write \"**/*.{ts,tsx,js,json,md}\"",
    "db:migrate": "pnpm --filter @whatsagent/database migrate:dev",
    "db:seed": "pnpm --filter @whatsagent/database seed",
    "db:studio": "pnpm --filter @whatsagent/database studio",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "prettier": "^3.3.3",
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "eslint": "^9.11.0"
  }
}
```

- [ ] **Step 2: Criar pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Criar turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "dependsOn": ["^build"],
      "cache": false
    },
    "lint": {
      "outputs": []
    },
    "db:migrate:dev": {
      "cache": false
    }
  }
}
```

- [ ] **Step 4: Instalar dependências**

```bash
npm install -g pnpm@9
pnpm install
```

Expected: `node_modules/.pnpm/` criado na raiz.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml
git commit -m "chore: initialize turborepo monorepo with pnpm workspaces"
```

---

### Task 2: Docker Compose — Todos os Serviços de Infraestrutura

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.test.yml`
- Create: `infra/docker/postgres/init.sql`

- [ ] **Step 1: Criar docker-compose.yml**

```yaml
version: "3.9"

services:
  # ─── PostgreSQL 15 + pgvector ───────────────────────────────────────
  postgres:
    image: pgvector/pgvector:pg15
    container_name: whatsagent-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: whatsagent
      POSTGRES_PASSWORD: whatsagent_secret
      POSTGRES_DB: whatsagent
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U whatsagent"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Redis 7 ────────────────────────────────────────────────────────
  redis:
    image: redis:7.2-alpine
    container_name: whatsagent-redis
    restart: unless-stopped
    command: redis-server --requirepass redis_secret --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "redis_secret", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── RabbitMQ 3.12 ──────────────────────────────────────────────────
  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    container_name: whatsagent-rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: whatsagent
      RABBITMQ_DEFAULT_PASS: rabbitmq_secret
      RABBITMQ_DEFAULT_VHOST: /
    ports:
      - "5672:5672"
      - "15672:15672"   # Management UI: http://localhost:15672
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 15s
      timeout: 10s
      retries: 5

  # ─── MinIO (S3-compatible para dev local) ───────────────────────────
  minio:
    image: minio/minio:latest
    container_name: whatsagent-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio_access_key
      MINIO_ROOT_PASSWORD: minio_secret_key
    ports:
      - "9000:9000"
      - "9001:9001"    # Console: http://localhost:9001
    volumes:
      - minio_data:/data

  # ─── Bull Board (Queue Monitor UI) ──────────────────────────────────
  bull-board:
    image: deadly0/bull-board:latest
    container_name: whatsagent-bull-board
    restart: unless-stopped
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: redis_secret
    ports:
      - "3100:3000"    # UI: http://localhost:3100
    depends_on:
      redis:
        condition: service_healthy

  # ─── Mailhog (Email dev) ────────────────────────────────────────────
  mailhog:
    image: mailhog/mailhog:latest
    container_name: whatsagent-mailhog
    restart: unless-stopped
    ports:
      - "8025:8025"    # UI: http://localhost:8025
      - "1025:1025"    # SMTP

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
  minio_data:
```

- [ ] **Step 2: Criar infra/docker/postgres/init.sql**

```sql
-- Habilitar extensão pgvector para busca semântica
CREATE EXTENSION IF NOT EXISTS vector;

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Habilitar extensão para unaccent (buscas sem acentos)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Schema de audit logs (imutável)
CREATE SCHEMA IF NOT EXISTS audit;
```

- [ ] **Step 3: Criar docker-compose.test.yml** (para CI e testes de integração)

```yaml
version: "3.9"

services:
  postgres-test:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: whatsagent_test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data   # in-memory para velocidade

  redis-test:
    image: redis:7.2-alpine
    ports:
      - "6380:6379"
    command: redis-server

  rabbitmq-test:
    image: rabbitmq:3.12-alpine
    ports:
      - "5673:5672"
```

- [ ] **Step 4: Subir e verificar**

```bash
docker compose up -d
docker compose ps
```

Expected output: todos os serviços com status `healthy` ou `running`.

```bash
# Verificar PostgreSQL
docker exec whatsagent-postgres psql -U whatsagent -c "SELECT version();"
# Verificar extensão vector
docker exec whatsagent-postgres psql -U whatsagent -d whatsagent -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
# Verificar Redis
docker exec whatsagent-redis redis-cli -a redis_secret ping
# Expected: PONG
```

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker-compose.test.yml infra/
git commit -m "chore: add docker compose with postgres/redis/rabbitmq/minio"
```

---

### Task 3: Package database — Prisma Schema Completo

**Files:**
- Create: `packages/database/package.json`
- Create: `packages/database/prisma/schema.prisma`
- Create: `packages/database/src/index.ts`
- Create: `packages/database/src/seed.ts`

- [ ] **Step 1: Criar packages/database/package.json**

```json
{
  "name": "@whatsagent/database",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "migrate:dev": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "generate": "prisma generate",
    "studio": "prisma studio",
    "seed": "tsx src/seed.ts",
    "reset": "prisma migrate reset --force"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0"
  },
  "devDependencies": {
    "prisma": "^5.20.0",
    "tsx": "^4.19.0"
  },
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  }
}
```

- [ ] **Step 2: Criar prisma/schema.prisma (schema completo)**

```prisma
// packages/database/prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector"), uuidOssp(map: "uuid-ossp"), unaccent]
}

// ─── ENUMS ─────────────────────────────────────────────────────────────────

enum TenantStatus {
  ACTIVE
  SUSPENDED
  TRIAL
  CANCELLED
}

enum UserRole {
  OWNER      // Dono do tenant — acesso total
  ADMIN      // Admin do tenant — quase tudo exceto billing
  AGENT      // Atendente humano — só inbox e conversas
  VIEWER     // Só leitura
}

enum WhatsAppStatus {
  DISCONNECTED
  CONNECTING
  CONNECTED
  BANNED
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

enum MessageType {
  TEXT
  AUDIO
  IMAGE
  DOCUMENT
  STICKER
  REACTION
  LOCATION
  CONTACT
  TEMPLATE
  INTERACTIVE
  SYSTEM      // Mensagem interna do sistema
}

enum ConversationStatus {
  ACTIVE
  PAUSED       // Aguardando resposta do cliente
  HUMAN_HANDOFF
  CLOSED
  ARCHIVED
}

enum HandoffReason {
  KEYWORD_TRIGGER
  LOW_CONFIDENCE
  ORDER_VALUE_THRESHOLD
  TIMEOUT
  CUSTOMER_REQUEST
  OUT_OF_SCOPE
  REPEATED_FAILURE
  MANUAL
}

enum OrderStatus {
  DRAFT
  AWAITING_PAYMENT
  PAYMENT_CONFIRMED
  PROCESSING
  READY_FOR_PICKUP
  OUT_FOR_DELIVERY
  DELIVERED
  CANCELLED
  REFUNDED
}

enum PaymentStatus {
  PENDING
  APPROVED
  REJECTED
  REFUNDED
  EXPIRED
}

enum PaymentMethod {
  PIX
  CREDIT_CARD
  DEBIT_CARD
  BOLETO
}

enum GuardRuleType {
  TEXT_BLOCK         // Bloquear texto específico
  SEMANTIC_BLOCK     // Bloquear semanticamente similar
  NUMERIC_CAP        // Limitar valor numérico
  PRODUCT_RESTRICT   // Restringir produtos
  HANDOFF_TRIGGER    // Acionar handoff
  REGEX_MATCH        // Padrão regex
}

enum GuardRuleAction {
  BLOCK             // Bloqueia completamente, envia fallback
  REWRITE           // Pede ao LLM para reescrever
  HANDOFF           // Dispara handoff
  LOG_ONLY          // Só loga, não bloqueia
}

enum ProductStatus {
  ACTIVE
  INACTIVE
  OUT_OF_STOCK
  DISCONTINUED
}

enum AgentTone {
  FORMAL
  INFORMAL
  FRIENDLY
  TECHNICAL
  REGIONAL
}

enum PlanType {
  STARTER    // até 500 msgs/mês
  GROWTH     // até 5000 msgs/mês
  SCALE      // até 20000 msgs/mês
  ENTERPRISE // ilimitado
}

// ─── PLATAFORMA ─────────────────────────────────────────────────────────────

model Tenant {
  id                String         @id @default(uuid())
  name              String
  slug              String         @unique  // subdomínio: slug.whatsagent.com.br
  status            TenantStatus   @default(TRIAL)
  planType          PlanType       @default(STARTER)
  
  // WhatsApp config
  whatsappPhoneId   String?        // Meta Cloud API: phone number ID
  whatsappStatus    WhatsAppStatus @default(DISCONNECTED)
  metaAccessToken   String?        // Encrypted
  whatsappNumber    String?        // Número formatado: +5511999999999
  
  // Billing Stripe (plataforma)
  stripeCustomerId  String?
  stripeSubId       String?
  
  // Metadata
  timezone          String         @default("America/Sao_Paulo")
  locale            String         @default("pt-BR")
  logoUrl           String?
  
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  
  // Relations
  users             User[]
  agentConfig       AgentConfig?
  products          Product[]
  contacts          Contact[]
  conversations     Conversation[]
  orders            Order[]
  guardRules        GuardRule[]
  knowledgeBases    KnowledgeBase[]
  analyticsEvents   AnalyticsEvent[]
  auditLogs         AuditLog[]
  billing           PlatformBilling?
  
  @@index([slug])
  @@index([status])
}

model User {
  id          String    @id @default(uuid())
  tenantId    String
  clerkId     String    @unique  // Clerk user ID
  email       String
  name        String
  avatarUrl   String?
  role        UserRole  @default(AGENT)
  isActive    Boolean   @default(true)
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  // Auditoria
  auditLogs   AuditLog[]
  
  @@index([tenantId])
  @@index([clerkId])
  @@index([tenantId, role])
}

// ─── CONFIGURAÇÃO DO AGENTE ─────────────────────────────────────────────────

model AgentConfig {
  id              String      @id @default(uuid())
  tenantId        String      @unique
  
  // Persona
  agentName       String      @default("Assistente")
  tone            AgentTone   @default(FRIENDLY)
  
  // Mensagens configuradas
  greetingMessage String      @default("Olá! Como posso ajudar você hoje?")
  inactivityMessage String    @default("Ainda está por aqui? 😊")
  closingMessage  String      @default("Foi um prazer atender você! Até logo.")
  
  // Horários de funcionamento (JSON: { mon: {open: "09:00", close: "18:00"}, ... })
  businessHours   Json        @default("{}")
  outOfHoursMessage String    @default("No momento estamos fechados. Retornaremos em breve!")
  
  // Configurações do LLM
  llmModel        String      @default("gpt-4o-mini")
  llmTemperature  Float       @default(0.3)  // Baixa para consistência
  maxResponseLength Int       @default(500)  // Chars máximos na resposta
  
  // Handoff configs
  handoffMessage  String      @default("Estou transferindo você para um de nossos atendentes.")
  autoHandoffThreshold Float  @default(0.3)  // Confiança mínima, abaixo → handoff
  handoffOrderValueBrl Float? // Pedidos acima deste valor → handoff
  
  // Limites de sessão
  sessionTtlHours Int         @default(24)
  inactivityTimeoutMin Int    @default(30)
  maxConversationLength Int   @default(50)   // Msgs antes de nova sessão
  
  // System prompt base (customizável)
  systemPromptBase String?
  
  // Publicado?
  isPublished     Boolean     @default(false)
  publishedAt     DateTime?
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  tenant          Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model KnowledgeBase {
  id          String    @id @default(uuid())
  tenantId    String
  
  name        String    // "FAQ Produtos", "Política de Entrega"
  type        String    // "faq" | "document" | "text" | "url"
  content     String    // Texto bruto
  fileUrl     String?   // S3 URL para documentos
  
  // Embedding status
  isIndexed   Boolean   @default(false)
  indexedAt   DateTime?
  chunkCount  Int?
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  chunks      KnowledgeChunk[]
  
  @@index([tenantId])
  @@index([tenantId, isIndexed])
}

model KnowledgeChunk {
  id              String                  @id @default(uuid())
  knowledgeBaseId String
  tenantId        String
  
  content         String
  embedding       Unsupported("vector(1536)")? // text-embedding-3-small
  chunkIndex      Int
  
  knowledgeBase   KnowledgeBase          @relation(fields: [knowledgeBaseId], references: [id], onDelete: Cascade)
  
  @@index([knowledgeBaseId])
  @@index([tenantId])
}

// ─── GUARD RULES ──────────────────────────────────────────────────────────

model GuardRule {
  id          String          @id @default(uuid())
  tenantId    String
  
  name        String          // "Não mencionar concorrentes"
  description String?
  type        GuardRuleType
  action      GuardRuleAction
  priority    Int             @default(100)  // Menor = maior prioridade
  isActive    Boolean         @default(true)
  
  // Configuração específica por tipo (JSON flexível)
  // TEXT_BLOCK: { "patterns": ["concorrente X", "empresa Y"] }
  // NUMERIC_CAP: { "field": "discount_percent", "max": 10 }
  // HANDOFF_TRIGGER: { "keywords": ["reembolso", "reclamação"], "threshold": 0.8 }
  config      Json
  
  // Ação alternativa
  fallbackMessage String?     // Mensagem a enviar se regra acionada
  
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  
  tenant      Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@index([tenantId, isActive])
  @@index([tenantId, priority])
}

// ─── CATÁLOGO ──────────────────────────────────────────────────────────────

model Category {
  id        String    @id @default(uuid())
  tenantId  String
  name      String
  slug      String
  parentId  String?
  
  parent    Category?   @relation("CategoryParent", fields: [parentId], references: [id])
  children  Category[]  @relation("CategoryParent")
  products  Product[]
  
  @@unique([tenantId, slug])
  @@index([tenantId])
}

model Product {
  id            String        @id @default(uuid())
  tenantId      String
  categoryId    String?
  
  name          String
  description   String?
  sku           String?
  
  priceCents    Int           // Preço em centavos para evitar float
  comparePriceCents Int?      // Preço "de" para exibir promoção
  
  stockQty      Int           @default(0)
  reservedQty   Int           @default(0)  // Reservado durante negociação
  lowStockThreshold Int       @default(5)
  
  status        ProductStatus @default(ACTIVE)
  
  // Imagens: array de URLs S3
  imageUrls     String[]
  
  // Tags para busca
  tags          String[]
  
  // Variações (JSON: [{ name: "Cor", values: ["Preto", "Branco"] }])
  variations    Json          @default("[]")
  
  // Embedding para busca semântica
  embedding     Unsupported("vector(1536)")?
  embeddingText String?       // Texto usado para gerar o embedding
  isEmbedded    Boolean       @default(false)
  
  weight        Float?        // kg
  dimensions    Json?         // { width, height, depth } em cm
  
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  
  tenant        Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  category      Category?     @relation(fields: [categoryId], references: [id])
  orderItems    OrderItem[]
  
  @@index([tenantId, status])
  @@index([tenantId, isEmbedded])
  @@index([tenantId, sku])
}

// ─── CONTATOS & CONVERSAS ─────────────────────────────────────────────────

model Contact {
  id            String    @id @default(uuid())
  tenantId      String
  
  // WhatsApp
  phone         String    // +5511999999999
  name          String?   // Nome do perfil WhatsApp
  avatarUrl     String?
  
  // Dados capturados pelo agente
  email         String?
  cpf           String?
  address       Json?     // { street, city, state, zip }
  
  // Segmentação
  tags          String[]
  notes         String?
  
  // Lifecycle
  firstSeenAt   DateTime  @default(now())
  lastSeenAt    DateTime  @default(now())
  totalOrders   Int       @default(0)
  totalSpentBrl Float     @default(0)
  
  tenant        Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversations Conversation[]
  orders        Order[]
  
  @@unique([tenantId, phone])
  @@index([tenantId])
  @@index([tenantId, phone])
}

model Conversation {
  id              String              @id @default(uuid())
  tenantId        String
  contactId       String
  
  status          ConversationStatus  @default(ACTIVE)
  
  // Handoff info
  assignedUserId  String?             // ID do agente humano se em handoff
  handoffReason   HandoffReason?
  handoffAt       DateTime?
  
  // Metadados
  startedAt       DateTime            @default(now())
  closedAt        DateTime?
  lastMessageAt   DateTime?
  
  // Contexto do agente (snapshot do LangGraph state)
  currentStage    String?             // greeting/catalog/negotiation/payment/closed
  cartSnapshot    Json?               // Estado do carrinho ao encerrar
  
  // Analytics
  resolutionType  String?             // "ai_resolved" | "human_resolved" | "abandoned"
  csatScore       Int?                // 1-5 se coletado
  
  tenant          Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  contact         Contact             @relation(fields: [contactId], references: [id])
  messages        Message[]
  orders          Order[]
  handoffEvents   HandoffEvent[]
  
  @@index([tenantId, status])
  @@index([tenantId, contactId])
  @@index([tenantId, lastMessageAt])
}

model Message {
  id              String           @id @default(uuid())
  conversationId  String
  tenantId        String
  
  // Meta API IDs
  waMessageId     String?          @unique  // ID da mensagem no WhatsApp
  
  direction       MessageDirection
  type            MessageType      @default(TEXT)
  
  // Conteúdo
  text            String?
  audioUrl        String?          // S3 URL do áudio
  audioTranscript String?          // Transcrição pelo Whisper
  imageUrl        String?
  documentUrl     String?
  documentName    String?
  
  // Para mensagens do agente
  isFromAi        Boolean          @default(false)
  aiModel         String?          // qual modelo gerou
  aiTokensUsed    Int?
  aiLatencyMs     Int?
  
  // Debug LangGraph (só em modo dev/staging)
  aiDebugTrace    Json?            // Nodes executados, tool calls
  
  sentAt          DateTime         @default(now())
  deliveredAt     DateTime?
  readAt          DateTime?
  failedAt        DateTime?
  failureReason   String?
  
  conversation    Conversation     @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  @@index([conversationId])
  @@index([tenantId, sentAt])
  @@index([waMessageId])
}

// ─── PEDIDOS & PAGAMENTOS ─────────────────────────────────────────────────

model Order {
  id              String      @id @default(uuid())
  tenantId        String
  contactId       String
  conversationId  String?
  
  orderNumber     String      @unique  // ORD-YYMMDD-XXXXX
  status          OrderStatus @default(DRAFT)
  
  subtotalCents   Int
  discountCents   Int         @default(0)
  shippingCents   Int         @default(0)
  totalCents      Int
  
  // Delivery
  deliveryType    String?     // "pickup" | "delivery"
  deliveryAddress Json?
  
  // Observações
  notes           String?
  internalNotes   String?
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  confirmedAt     DateTime?
  deliveredAt     DateTime?
  cancelledAt     DateTime?
  
  tenant          Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  contact         Contact     @relation(fields: [contactId], references: [id])
  conversation    Conversation? @relation(fields: [conversationId], references: [id])
  items           OrderItem[]
  payments        Payment[]
  
  @@index([tenantId, status])
  @@index([tenantId, contactId])
  @@index([orderNumber])
}

model OrderItem {
  id            String    @id @default(uuid())
  orderId       String
  productId     String
  
  productName   String    // Snapshot do nome no momento da compra
  priceCents    Int       // Snapshot do preço
  quantity      Int
  subtotalCents Int
  
  variationSelected Json? // { "Cor": "Preto", "Tamanho": "M" }
  
  order         Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product       Product   @relation(fields: [productId], references: [id])
}

model Payment {
  id              String        @id @default(uuid())
  orderId         String
  tenantId        String
  
  method          PaymentMethod
  status          PaymentStatus @default(PENDING)
  amountCents     Int
  
  // Gateway data
  gatewayId       String?       // ID na Mercado Pago/Stripe
  gatewayResponse Json?
  
  // PIX specific
  pixQrCode       String?       // QR code base64
  pixCopyPaste    String?
  pixExpiresAt    DateTime?
  
  // Links
  paymentUrl      String?
  
  paidAt          DateTime?
  expiredAt       DateTime?
  refundedAt      DateTime?
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  order           Order         @relation(fields: [orderId], references: [id])
  
  @@index([orderId])
  @@index([tenantId, status])
  @@index([gatewayId])
}

// ─── EVENTOS & ANALYTICS ──────────────────────────────────────────────────

model HandoffEvent {
  id              String        @id @default(uuid())
  tenantId        String
  conversationId  String
  
  reason          HandoffReason
  triggeredBy     String        // "ai" | "user" | "operator"
  ruleId          String?       // ID da GuardRule que acionou
  
  agentUserId     String?       // Quem assumiu
  assumedAt       DateTime?
  resolvedAt      DateTime?
  
  notes           String?
  
  createdAt       DateTime      @default(now())
  
  conversation    Conversation  @relation(fields: [conversationId], references: [id])
  
  @@index([tenantId, createdAt])
  @@index([conversationId])
}

model AnalyticsEvent {
  id          String    @id @default(uuid())
  tenantId    String
  
  // Evento
  eventType   String    // "conversation_started" | "message_sent" | "order_created" | etc
  eventData   Json
  
  // Contexto
  contactId   String?
  sessionId   String?
  
  occurredAt  DateTime  @default(now())
  
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@index([tenantId, eventType, occurredAt])
  @@index([tenantId, occurredAt])
}

model AuditLog {
  id          String    @id @default(uuid())
  tenantId    String
  userId      String?
  
  action      String    // "product.created" | "agent_config.updated" | etc
  resourceId  String?
  resourceType String?
  
  oldValues   Json?     // Estado anterior
  newValues   Json?     // Estado novo
  
  ipAddress   String?
  userAgent   String?
  
  createdAt   DateTime  @default(now())
  
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user        User?     @relation(fields: [userId], references: [id])
  
  // Particionado por mês (comentário arquitetural — implementar via Citus ou pg_partman em produção)
  @@index([tenantId, createdAt])
  @@index([tenantId, action])
}

// ─── BILLING DA PLATAFORMA ───────────────────────────────────────────────

model PlatformBilling {
  id                String    @id @default(uuid())
  tenantId          String    @unique
  
  stripeCustomerId  String?
  stripeSubId       String?
  
  currentPlan       PlanType  @default(STARTER)
  
  // Uso corrente (unidade: conversas, não mensagens individuais)
  // Limites por plano: STARTER=500 | GROWTH=3000 | SCALE=10000 | ENTERPRISE=ilimitado
  conversationsThisMonth Int  @default(0)
  conversationsLimit     Int  @default(100)  // Trial começa com 100
  
  billingCycleStart DateTime?
  billingCycleEnd   DateTime?
  
  trialEndsAt       DateTime?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 3: Criar packages/database/src/index.ts**

```typescript
// packages/database/src/index.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

// Singleton em dev para evitar conexões extras com hot reload
export const prisma = global.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export * from "@prisma/client";
export type { PrismaClient };
```

- [ ] **Step 4: Criar seed.ts para dados iniciais**

```typescript
// packages/database/src/seed.ts
import { PrismaClient, UserRole, PlanType, AgentTone } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Criar tenant de desenvolvimento
  const devTenant = await prisma.tenant.upsert({
    where: { slug: "dev-tenant" },
    update: {},
    create: {
      name: "Loja Demonstração",
      slug: "dev-tenant",
      status: "ACTIVE",
      planType: PlanType.GROWTH,
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
    },
  });

  // Criar usuário owner
  await prisma.user.upsert({
    where: { clerkId: "dev_owner_clerk_id" },
    update: {},
    create: {
      tenantId: devTenant.id,
      clerkId: "dev_owner_clerk_id",
      email: "owner@dev-tenant.com",
      name: "Admin Dev",
      role: UserRole.OWNER,
    },
  });

  // Criar AgentConfig padrão
  await prisma.agentConfig.upsert({
    where: { tenantId: devTenant.id },
    update: {},
    create: {
      tenantId: devTenant.id,
      agentName: "Carla",
      tone: AgentTone.FRIENDLY,
      greetingMessage:
        "Olá! Sou a Carla, assistente virtual da Loja Demonstração. Como posso ajudar você hoje?",
      llmModel: "gpt-4o-mini",
      llmTemperature: 0.3,
      businessHours: {
        mon: { open: "09:00", close: "18:00", active: true },
        tue: { open: "09:00", close: "18:00", active: true },
        wed: { open: "09:00", close: "18:00", active: true },
        thu: { open: "09:00", close: "18:00", active: true },
        fri: { open: "09:00", close: "18:00", active: true },
        sat: { open: "09:00", close: "13:00", active: true },
        sun: { open: "00:00", close: "00:00", active: false },
      },
    },
  });

  // Criar categorias de produtos
  const category = await prisma.category.upsert({
    where: { tenantId_slug: { tenantId: devTenant.id, slug: "camisetas" } },
    update: {},
    create: {
      tenantId: devTenant.id,
      name: "Camisetas",
      slug: "camisetas",
    },
  });

  // Criar produtos de exemplo
  const products = [
    {
      name: "Camiseta Premium Preta",
      description: "Camiseta 100% algodão, corte slim, lavável à máquina",
      priceCents: 5990,
      stockQty: 50,
      tags: ["camiseta", "preta", "slim", "algodão", "premium"],
    },
    {
      name: "Camiseta Estampada Branca",
      description: "Camiseta estampada exclusiva, algodão macio, unissex",
      priceCents: 4990,
      stockQty: 30,
      tags: ["camiseta", "branca", "estampada", "unissex"],
    },
    {
      name: "Camiseta Polo Azul",
      description: "Polo clássica com botões, tecido piquet, elegante",
      priceCents: 8990,
      stockQty: 20,
      tags: ["polo", "azul", "elegante", "piquet", "botões"],
    },
  ];

  for (const p of products) {
    await prisma.product.create({
      data: {
        tenantId: devTenant.id,
        categoryId: category.id,
        ...p,
        variations: [
          { name: "Tamanho", values: ["P", "M", "G", "GG"] },
        ],
      },
    });
  }

  // Criar regra anti-alucinação de exemplo
  await prisma.guardRule.create({
    data: {
      tenantId: devTenant.id,
      name: "Não mencionar concorrentes",
      type: "TEXT_BLOCK",
      action: "REWRITE",
      priority: 10,
      config: {
        patterns: ["marca rival", "concorrente", "outra loja"],
      },
      fallbackMessage:
        "Posso ajudar com informações sobre nossos produtos. O que gostaria de saber?",
    },
  });

  console.log("✅ Seed concluído!");
  console.log(`   Tenant: ${devTenant.name} (ID: ${devTenant.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 5: Instalar e rodar migration**

```bash
cd packages/database
pnpm install
pnpm prisma generate
pnpm migrate:dev --name init
pnpm seed
```

Expected: Migration criada em `prisma/migrations/`, seed exibe "✅ Seed concluído!"

- [ ] **Step 6: Commit**

```bash
git add packages/database/
git commit -m "feat(db): add complete prisma schema with all domain models"
```

---

### Task 4: Package shared-types

**Files:**
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/src/events.types.ts`
- Create: `packages/shared-types/src/conversation.types.ts`
- Create: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Criar package.json**

```json
{
  "name": "@whatsagent/shared-types",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src/"
  }
}
```

- [ ] **Step 2: Criar events.types.ts** (payloads de eventos RabbitMQ)

```typescript
// packages/shared-types/src/events.types.ts

// Exchanges RabbitMQ
export const EXCHANGES = {
  MESSAGES: "messages",
  AI: "ai",
  NOTIFICATIONS: "notifications",
  HANDOFF: "handoff",
} as const;

// Routing keys
export const ROUTING_KEYS = {
  MSG_INBOUND: "msg.inbound",
  MSG_OUTBOUND: "msg.outbound",
  AI_PROCESS: "ai.process",
  AI_RESPONSE: "ai.response",
  HANDOFF_CREATE: "handoff.create",
  HANDOFF_ACCEPT: "handoff.accept",
  NOTIFICATION_PUSH: "notification.push",
} as const;

// ─── Payload: mensagem recebida do WhatsApp ───────────────────────────────
export interface InboundMessageEvent {
  tenantId: string;
  whatsappPhoneId: string;
  waMessageId: string;
  from: string;           // Phone number: 5511999999999
  timestamp: number;      // Unix
  type: "text" | "audio" | "image" | "document" | "location";
  text?: string;
  audioId?: string;       // WhatsApp media ID (antes do download)
  audioUrl?: string;      // S3/MinIO URL após download
  audioTranscript?: string; // Transcrição Whisper (preenchida pelo Channel Service)
  imageId?: string;
  imageUrl?: string;
  documentId?: string;
  documentName?: string;
  locationLat?: number;
  locationLng?: number;
}

// ─── Payload: AI processou e tem resposta para enviar ───────────────────
export interface AiResponseEvent {
  tenantId: string;
  conversationId: string;
  waPhoneId: string;
  toPhone: string;
  messages: OutboundMessage[];  // Pode ser múltiplas msgs
  triggerHandoff?: boolean;
  handoffReason?: string;
}

export interface OutboundMessage {
  type: "text" | "image" | "template";
  text?: string;
  imageUrl?: string;
  templateName?: string;
  templateParams?: string[];
}

// ─── Payload: handoff criado ─────────────────────────────────────────────
export interface HandoffCreatedEvent {
  tenantId: string;
  conversationId: string;
  contactId: string;
  contactPhone: string;
  contactName?: string;
  reason: string;
  urgency: "low" | "medium" | "high";
}

// ─── Payload: notificação push ───────────────────────────────────────────
export interface PushNotificationEvent {
  tenantId: string;
  targetUserIds?: string[];  // null = todos do tenant
  title: string;
  body: string;
  data?: Record<string, unknown>;
  type: "handoff" | "order" | "payment" | "alert";
}
```

- [ ] **Step 3: Criar conversation.types.ts**

```typescript
// packages/shared-types/src/conversation.types.ts

export interface ConversationSession {
  tenantId: string;
  conversationId: string;
  contactPhone: string;
  currentStage: ConversationStage;
  cart: CartItem[];
  lastMessages: MessageSummary[];
  agentContext: Record<string, unknown>;
  createdAt: number;  // Unix
  updatedAt: number;
}

export type ConversationStage =
  | "greeting"
  | "discovery"      // Identificando necessidades
  | "catalog"        // Apresentando produtos
  | "negotiation"    // Negociando (preço, qtd)
  | "payment"        // Link enviado, aguardando pagamento
  | "post_payment"   // Confirmado, roteando entrega
  | "closed"
  | "handoff";

export interface CartItem {
  productId: string;
  productName: string;
  priceCents: number;
  quantity: number;
  variationSelected?: Record<string, string>;
}

export interface MessageSummary {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// WebSocket events (front-end)
export type WsEvent =
  | { type: "new_message"; payload: WsNewMessage }
  | { type: "conversation_status"; payload: WsConvStatus }
  | { type: "handoff_created"; payload: WsHandoff }
  | { type: "agent_typing"; payload: { conversationId: string } }
  | { type: "order_updated"; payload: WsOrderUpdate };

export interface WsNewMessage {
  conversationId: string;
  tenantId: string;
  messageId: string;
  direction: "inbound" | "outbound";
  type: string;
  text?: string;
  audioUrl?: string;
  sentAt: string;
  isFromAi: boolean;
}

export interface WsConvStatus {
  conversationId: string;
  status: string;
  assignedUserId?: string;
}

export interface WsHandoff {
  conversationId: string;
  contactPhone: string;
  contactName?: string;
  reason: string;
  urgency: string;
  createdAt: string;
}

export interface WsOrderUpdate {
  orderId: string;
  orderNumber: string;
  status: string;
  totalCents: number;
}
```

- [ ] **Step 4: Criar src/index.ts**

```typescript
// packages/shared-types/src/index.ts
export * from "./events.types";
export * from "./conversation.types";
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/
git commit -m "feat(types): add shared RabbitMQ event types and WebSocket types"
```

---

### Task 5: Configuração TypeScript + ESLint + Prettier

**Files:**
- Create: `tsconfig.base.json`
- Create: `.prettierrc`
- Create: `.eslintrc.base.js`
- Create: `.env.example`

- [ ] **Step 1: Criar tsconfig.base.json**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "incremental": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", "dist", ".turbo", "coverage"]
}
```

- [ ] **Step 2: Criar .prettierrc**

```json
{
  "singleQuote": false,
  "semi": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 3: Criar .env.example** (documentação de todas as variáveis)

```bash
# ═══════════════════════════════════════════════════════════════
# WhatsAgent — Environment Variables Template
# Copie este arquivo para .env.local e preencha os valores
# NUNCA commite o .env.local no git
# ═══════════════════════════════════════════════════════════════

# ─── INFRA ─────────────────────────────────────────────────────
DATABASE_URL="postgresql://whatsagent:whatsagent_secret@localhost:5432/whatsagent"
REDIS_URL="redis://:redis_secret@localhost:6379"
RABBITMQ_URL="amqp://whatsagent:rabbitmq_secret@localhost:5672"
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="minio_access_key"
MINIO_SECRET_KEY="minio_secret_key"
MINIO_BUCKET="whatsagent-media"

# ─── CLERK AUTH ────────────────────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..."

# ─── AI PROVIDERS ──────────────────────────────────────────────
# OpenAI (padrão — obrigatório para Whisper e Embeddings)
OPENAI_API_KEY="sk-..."
OPENAI_MODEL_COMPLEX="gpt-4o"
OPENAI_MODEL_SIMPLE="gpt-4o-mini"
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
OPENAI_WHISPER_MODEL="whisper-1"

# Anthropic Claude (opcional — habilitar por tenant via AgentConfig.llm_model)
# Modelos: claude-opus-4-8 | claude-sonnet-4-6 | claude-haiku-4-5-20251001
ANTHROPIC_API_KEY=""

# Google Gemini (opcional)
# Modelos: gemini-2.0-flash | gemini-1.5-pro | gemini-1.5-flash
GOOGLE_API_KEY=""

# Ollama — modelos locais sem enviar dados para cloud (opcional)
# Modelos: llama3.3 | mistral | qwen2.5 | deepseek-r1
# Requer servidor Ollama rodando: https://ollama.ai
OLLAMA_URL="http://localhost:11434"
OLLAMA_ENABLED="false"

# ─── META CLOUD API ────────────────────────────────────────────
META_APP_ID=""
META_APP_SECRET=""
META_VERIFY_TOKEN="whatsagent_verify_2025"
META_WEBHOOK_SECRET=""
# Número de teste Meta: usar para sandbox
META_TEST_PHONE_NUMBER_ID=""

# ─── MERCADO PAGO ──────────────────────────────────────────────
MERCADOPAGO_ACCESS_TOKEN="APP_USR-..."
MERCADOPAGO_WEBHOOK_SECRET=""
MERCADOPAGO_NOTIFICATION_URL="https://seu-dominio.com/webhooks/mercadopago"

# ─── STRIPE (Billing da plataforma) ───────────────────────────
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
# Price IDs — criar no Stripe Dashboard
# Preços: STARTER R$197/mês | GROWTH R$497/mês | SCALE R$997/mês
# Anuais (20% off): R$157,60 | R$397,60 | R$797,60 (cobrado mensalmente)
STRIPE_PRICE_STARTER_MONTHLY=""
STRIPE_PRICE_STARTER_ANNUAL=""
STRIPE_PRICE_GROWTH_MONTHLY=""
STRIPE_PRICE_GROWTH_ANNUAL=""
STRIPE_PRICE_SCALE_MONTHLY=""
STRIPE_PRICE_SCALE_ANNUAL=""
# Metered billing para excedente (R$0,60/conversa STARTER/GROWTH | R$0,40 SCALE)
STRIPE_METER_ID_CONVERSATIONS=""

# ─── STORAGE AWS S3 (produção) ─────────────────────────────────
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION="sa-east-1"
AWS_S3_BUCKET="whatsagent-media-prod"

# ─── MONITORING ────────────────────────────────────────────────
SENTRY_DSN=""
NEXT_PUBLIC_POSTHOG_KEY=""
NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"

# ─── SERVICES (portas locais) ──────────────────────────────────
PORT_WEB=3000
PORT_API=3002
PORT_CHANNEL=3001
PORT_AI_ORCHESTRATOR=8000

# ─── INTERNAL SERVICE AUTH ─────────────────────────────────────
# Token usado pelo AI Orchestrator para chamar Back-office API sem JWT Clerk
INTERNAL_API_TOKEN="whatsagent_internal_secret_change_in_prod"

# ─── NODE ENV ──────────────────────────────────────────────────
NODE_ENV="development"
LOG_LEVEL="debug"   # debug | info | warn | error
```

- [ ] **Step 4: Atualizar .gitignore**

```bash
cat >> .gitignore << 'EOF'
# Env files
.env
.env.local
.env.*.local

# Turborepo
.turbo/

# Build outputs
dist/
.next/
.output/
build/

# Coverage
coverage/

# Prisma generated
packages/database/node_modules/

# Python
__pycache__/
*.py[cod]
.venv/
apps/ai-orchestrator/.venv/
EOF
```

- [ ] **Step 5: Commit**

```bash
git add tsconfig.base.json .prettierrc .eslintrc.base.js .env.example .gitignore
git commit -m "chore: add tsconfig base, prettier, eslint config and env template"
```

---

### Task 6: CI/CD com GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Criar .github/workflows/ci.yml**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: "20"
  PYTHON_VERSION: "3.12"
  PNPM_VERSION: "9"

jobs:
  # ─── Lint & Type Check ─────────────────────────────────────────────────
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Lint
        run: pnpm turbo lint
      
      - name: Type check
        run: pnpm turbo build --filter=!apps/web  # type check via build

  # ─── Tests (TypeScript) ────────────────────────────────────────────────
  test-ts:
    name: Tests (TypeScript)
    runs-on: ubuntu-latest
    needs: lint
    
    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: whatsagent_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7.2-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/whatsagent_test
      REDIS_URL: redis://localhost:6379
      NODE_ENV: test
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "pnpm"
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run DB migrations
        run: pnpm db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/whatsagent_test
      
      - name: Run tests
        run: pnpm turbo test --filter=!apps/ai-orchestrator
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  # ─── Tests (Python) ───────────────────────────────────────────────────
  test-python:
    name: Tests (Python)
    runs-on: ubuntu-latest
    needs: lint
    
    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: whatsagent_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7.2-alpine
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: "pip"
      
      - name: Install Python dependencies
        run: |
          cd apps/ai-orchestrator
          pip install uv
          uv sync
      
      - name: Run Python tests
        run: |
          cd apps/ai-orchestrator
          uv run pytest tests/ -v --cov=src --cov-report=xml
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/whatsagent_test
          REDIS_URL: redis://localhost:6379
          OPENAI_API_KEY: sk-test-fake-key-for-tests
```

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "ci: add github actions ci pipeline for ts and python"
```

---

### Task 7: Scaffold das Apps (estrutura inicial)

- [ ] **Step 1: Criar scaffold Next.js**

```bash
cd apps
pnpm create next-app@latest web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --no-turbopack \
  --import-alias "@/*"
```

- [ ] **Step 2: Criar scaffold NestJS para api e channel-service**

```bash
# API
npm install -g @nestjs/cli@latest
cd apps
nest new api --package-manager pnpm --skip-git
nest new channel-service --package-manager pnpm --skip-git
```

- [ ] **Step 3: Criar scaffold Python ai-orchestrator**

```bash
cd apps/ai-orchestrator
pip install uv
uv init --python 3.12
uv add fastapi uvicorn pydantic pydantic-settings \
       langgraph langchain langchain-openai \
       openai sqlalchemy asyncpg alembic \
       redis aio-pika python-multipart \
       httpx tenacity structlog
uv add --dev pytest pytest-asyncio pytest-cov httpx
```

- [ ] **Step 4: Commit**

```bash
git add apps/
git commit -m "chore: scaffold all app workspaces (next.js, nestjs x2, fastapi)"
```

---

## Verificação do Plan 0

Antes de prosseguir para os próximos planos, confirmar:

- [ ] `docker compose up -d` → todos os serviços healthy
- [ ] `pnpm db:migrate` → migrations executadas sem erros
- [ ] `pnpm db:seed` → seed criado com tenant e produtos
- [ ] `docker exec whatsagent-postgres psql -U whatsagent -d whatsagent -c "\dt"` → lista todas as tabelas
- [ ] `pnpm --filter @whatsagent/web dev` → Next.js sobe em http://localhost:3000
- [ ] `pnpm --filter @whatsagent/api start:dev` → NestJS API sobe em http://localhost:3002
- [ ] GitHub Actions passa no PR de teste
- [ ] `pnpm turbo lint` → sem erros de lint
