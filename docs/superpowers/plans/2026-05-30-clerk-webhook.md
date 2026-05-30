# Clerk Webhook — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o endpoint `POST /webhooks/clerk` na API que recebe eventos do Clerk e sincroniza `Tenant` + `User` no banco automaticamente quando um usuário se cadastra.

**Architecture:** Um novo `ClerkWebhookModule` com controller e service dedicados. O controller valida a assinatura Svix antes de qualquer processamento. O service contém toda a lógica de negócio de criação/atualização de registros no banco via Prisma.

**Tech Stack:** NestJS, Prisma, `svix` (verificação de assinatura), Jest

---

## Arquivo Map

| Ação | Arquivo |
|---|---|
| Criar | `apps/api/src/modules/clerk/clerk-webhook.controller.ts` |
| Criar | `apps/api/src/modules/clerk/clerk-webhook.service.ts` |
| Criar | `apps/api/src/modules/clerk/clerk-webhook.module.ts` |
| Criar | `apps/api/src/modules/clerk/clerk-webhook.service.spec.ts` |
| Modificar | `apps/api/src/app.module.ts` |
| Modificar | `apps/api/package.json` (adicionar `svix`) |

---

## Task 1: Instalar dependência `svix`

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Instalar o pacote**

```bash
pnpm --filter @whatsagent/api add svix
```

- [ ] **Step 2: Verificar instalação**

```bash
pnpm --filter @whatsagent/api list svix
```

Expected: linha com `svix x.x.x`

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): adiciona svix para verificacao de webhook do Clerk"
```

---

## Task 2: Criar o service com testes

**Files:**
- Create: `apps/api/src/modules/clerk/clerk-webhook.service.ts`
- Create: `apps/api/src/modules/clerk/clerk-webhook.service.spec.ts`

### Contexto dos tipos Clerk

O payload `user.created` do Clerk tem esta estrutura relevante:
```ts
{
  id: string                          // clerkId
  first_name: string | null
  last_name: string | null
  image_url: string
  email_addresses: Array<{
    email_address: string
    id: string
  }>
  primary_email_address_id: string
}
```

- [ ] **Step 1: Escrever os testes**

Criar `apps/api/src/modules/clerk/clerk-webhook.service.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { ClerkWebhookService } from "./clerk-webhook.service";
import { PrismaService } from "../../common/prisma/prisma.service";

const mockPrisma = {
  tenant: { create: jest.fn() },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const clerkUserPayload = {
  id: "user_clerk_123",
  first_name: "João",
  last_name: "Silva",
  image_url: "https://img.clerk.com/avatar.jpg",
  primary_email_address_id: "iea_1",
  email_addresses: [{ id: "iea_1", email_address: "joao@exemplo.com.br" }],
};

describe("ClerkWebhookService", () => {
  let service: ClerkWebhookService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ClerkWebhookService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ClerkWebhookService>(ClerkWebhookService);
    jest.clearAllMocks();
  });

  describe("handleUserCreated", () => {
    it("deve criar Tenant e User quando usuario nao existe", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: "tenant_abc" });
      mockPrisma.user.create.mockResolvedValue({ id: "user_abc" });

      await service.handleUserCreated(clerkUserPayload);

      expect(mockPrisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "João Silva",
            status: "TRIAL",
            planType: "STARTER",
          }),
        }),
      );
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clerkId: "user_clerk_123",
            email: "joao@exemplo.com.br",
            name: "João Silva",
            role: "OWNER",
            isActive: true,
          }),
        }),
      );
    });

    it("nao deve criar duplicado se usuario ja existe no banco", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user_existente" });

      await service.handleUserCreated(clerkUserPayload);

      expect(mockPrisma.tenant.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it("usa prefixo do email como nome quando first_name e null", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: "tenant_abc" });
      mockPrisma.user.create.mockResolvedValue({ id: "user_abc" });

      await service.handleUserCreated({ ...clerkUserPayload, first_name: null, last_name: null });

      expect(mockPrisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "joao" }),
        }),
      );
    });
  });

  describe("handleUserUpdated", () => {
    it("deve atualizar name, email e avatarUrl se usuario existe", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user_abc" });

      await service.handleUserUpdated(clerkUserPayload);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { clerkId: "user_clerk_123" },
        data: {
          name: "João Silva",
          email: "joao@exemplo.com.br",
          avatarUrl: "https://img.clerk.com/avatar.jpg",
        },
      });
    });

    it("nao faz nada se usuario nao existe no banco", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.handleUserUpdated(clerkUserPayload);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("handleUserDeleted", () => {
    it("deve desativar usuario", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user_abc" });

      await service.handleUserDeleted("user_clerk_123");

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { clerkId: "user_clerk_123" },
        data: { isActive: false },
      });
    });

    it("nao faz nada se usuario nao existe", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.handleUserDeleted("user_clerk_123");

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
pnpm --filter @whatsagent/api test -- --testPathPattern=clerk-webhook.service
```

Expected: FAIL — `Cannot find module './clerk-webhook.service'`

- [ ] **Step 3: Implementar o service**

Criar `apps/api/src/modules/clerk/clerk-webhook.service.ts`:

```ts
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

interface ClerkUserPayload {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
  primary_email_address_id: string;
  email_addresses: Array<{ id: string; email_address: string }>;
}

@Injectable()
export class ClerkWebhookService {
  private readonly logger = new Logger(ClerkWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleUserCreated(data: ClerkUserPayload): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { clerkId: data.id } });
    if (existing) {
      this.logger.warn(`user.created ignorado — clerkId ${data.id} ja existe`);
      return;
    }

    const email = data.email_addresses.find((e) => e.id === data.primary_email_address_id)
      ?.email_address ?? data.email_addresses[0]?.email_address ?? "";

    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || email.split("@")[0];
    const slug = this.buildSlug(email);

    const tenant = await this.prisma.tenant.create({
      data: { name, slug, status: "TRIAL", planType: "STARTER" },
    });

    await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        clerkId: data.id,
        email,
        name,
        avatarUrl: data.image_url || null,
        role: "OWNER",
        isActive: true,
      },
    });

    this.logger.log(`Tenant + User criados para ${email} (tenant: ${tenant.id})`);
  }

  async handleUserUpdated(data: ClerkUserPayload): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { clerkId: data.id } });
    if (!existing) return;

    const email = data.email_addresses.find((e) => e.id === data.primary_email_address_id)
      ?.email_address ?? data.email_addresses[0]?.email_address ?? existing.email;

    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || email.split("@")[0];

    await this.prisma.user.update({
      where: { clerkId: data.id },
      data: { name, email, avatarUrl: data.image_url || null },
    });
  }

  async handleUserDeleted(clerkId: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!existing) return;

    await this.prisma.user.update({ where: { clerkId }, data: { isActive: false } });
    this.logger.log(`User desativado: clerkId ${clerkId}`);
  }

  private buildSlug(email: string): string {
    const prefix = email.split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30);
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${prefix}-${suffix}`;
  }
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
pnpm --filter @whatsagent/api test -- --testPathPattern=clerk-webhook.service
```

Expected: PASS — 6 testes passando

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/clerk/
git commit -m "feat(api): adiciona ClerkWebhookService com criacao de Tenant+User"
```

---

## Task 3: Criar o controller

**Files:**
- Create: `apps/api/src/modules/clerk/clerk-webhook.controller.ts`

O `main.ts` já tem `rawBody: true` no `NestFactory.create`, então `req.rawBody` está disponível como `Buffer`.

- [ ] **Step 1: Criar o controller**

Criar `apps/api/src/modules/clerk/clerk-webhook.controller.ts`:

```ts
import {
  Controller, Post, Headers, Req, HttpCode,
  BadRequestException, Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Webhook } from "svix";
import { ClerkWebhookService } from "./clerk-webhook.service";
import { Request } from "express";

@Controller("webhooks")
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(
    private readonly service: ClerkWebhookService,
    private readonly config: ConfigService,
  ) {}

  @Post("clerk")
  @HttpCode(200)
  async receive(
    @Req() req: Request,
    @Headers("svix-id") svixId: string,
    @Headers("svix-timestamp") svixTimestamp: string,
    @Headers("svix-signature") svixSignature: string,
  ) {
    const secret = this.config.get<string>("CLERK_WEBHOOK_SECRET") ?? "";
    const wh = new Webhook(secret);

    let event: { type: string; data: Record<string, unknown> };
    try {
      event = wh.verify(req.rawBody as Buffer, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as typeof event;
    } catch {
      throw new BadRequestException("Invalid webhook signature");
    }

    this.logger.log(`Clerk event: ${event.type}`);

    switch (event.type) {
      case "user.created":
        await this.service.handleUserCreated(event.data as Parameters<ClerkWebhookService["handleUserCreated"]>[0]);
        break;
      case "user.updated":
        await this.service.handleUserUpdated(event.data as Parameters<ClerkWebhookService["handleUserUpdated"]>[0]);
        break;
      case "user.deleted":
        await this.service.handleUserDeleted(event.data.id as string);
        break;
      default:
        this.logger.debug(`Evento ignorado: ${event.type}`);
    }

    return { received: true };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/clerk/clerk-webhook.controller.ts
git commit -m "feat(api): adiciona ClerkWebhookController com validacao Svix"
```

---

## Task 4: Criar o module e registrar no AppModule

**Files:**
- Create: `apps/api/src/modules/clerk/clerk-webhook.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Criar o module**

Criar `apps/api/src/modules/clerk/clerk-webhook.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { ClerkWebhookController } from "./clerk-webhook.controller";
import { ClerkWebhookService } from "./clerk-webhook.service";
import { PrismaModule } from "../../common/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [ClerkWebhookController],
  providers: [ClerkWebhookService],
})
export class ClerkWebhookModule {}
```

- [ ] **Step 2: Registrar no AppModule**

Modificar `apps/api/src/app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./common/prisma/prisma.module";
import { ProductsModule } from "./modules/products/products.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { GatewaysModule } from "./gateways/gateways.module";
import { BillingModule } from "./modules/billing/billing.module";
import { SuperAdminModule } from "./modules/super-admin/super-admin.module";
import { ClerkWebhookModule } from "./modules/clerk/clerk-webhook.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule, ProductsModule, OrdersModule, PaymentsModule,
    AnalyticsModule, GatewaysModule, BillingModule, SuperAdminModule,
    ClerkWebhookModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 3: Rodar todos os testes da API**

```bash
pnpm --filter @whatsagent/api test
```

Expected: todos os testes passando (incluindo os novos do clerk-webhook.service)

- [ ] **Step 4: Build para confirmar que não há erros de TypeScript**

```bash
pnpm --filter @whatsagent/api build
```

Expected: build sem erros

- [ ] **Step 5: Commit final**

```bash
git add apps/api/src/modules/clerk/ apps/api/src/app.module.ts
git commit -m "feat(api): integra ClerkWebhookModule no AppModule"
```

---

## Task 5: Teste manual via Clerk Dashboard

**Pré-requisito:** API rodando localmente (`pnpm --filter @whatsagent/api dev`)

- [ ] **Step 1: Expor a API localmente com ngrok**

```bash
ngrok http 3002
```

Copiar a URL gerada, ex: `https://abc123.ngrok-free.app`

- [ ] **Step 2: Atualizar a URL do webhook no Clerk**

No painel do Clerk → Webhooks → endpoint criado → **Edit** → trocar a URL para:
`https://abc123.ngrok-free.app/webhooks/clerk`

- [ ] **Step 3: Disparar evento de teste**

No painel do Clerk → Webhooks → endpoint → aba **Testing** → selecionar `user.created` → **Send Example**

- [ ] **Step 4: Verificar no banco**

```bash
pnpm db:studio
```

Abrir o Prisma Studio em `http://localhost:5555` e confirmar que um `Tenant` e um `User` foram criados.

- [ ] **Step 5: Verificar logs da API**

Expected nos logs:
```
[ClerkWebhookController] Clerk event: user.created
[ClerkWebhookService] Tenant + User criados para example@clerk.dev (tenant: uuid-aqui)
```

- [ ] **Step 6: Adicionar user.updated e user.deleted no Clerk**

No painel do Clerk → Webhooks → endpoint → **Subscribed events** → **Edit** → adicionar `user.updated` e `user.deleted`
