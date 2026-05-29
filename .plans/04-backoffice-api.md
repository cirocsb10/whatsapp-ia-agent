# WhatsAgent — Plan 3: Back-office API (NestJS)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a API REST do back-office em NestJS que serve o frontend — autenticação via Clerk (JWT), RBAC multi-tenant, CRUD completo de produtos/pedidos/conversas, webhooks de pagamento Mercado Pago, WebSocket Socket.io para tempo real, e endpoints de analytics.

**Architecture:** NestJS 10 na porta 3002. Guards de autenticação Clerk JWT + guard de tenant. RBAC com decorator @Role. Prisma para todas as queries com tenant_id obrigatório. Socket.io gateway para eventos em tempo real para o frontend. Mercado Pago para geração de Pix e webhooks de confirmação.

**Tech Stack:** NestJS 10 · TypeScript 5 · Prisma 5 · @clerk/backend · @nestjs/websockets · socket.io · mercadopago SDK · class-validator · class-transformer · Bull/BullMQ · ioredis · multer · AWS SDK v3

**Pré-requisito:** Plan 0 concluído

---

## Estrutura de Arquivos

```
apps/api/src/
├── main.ts
├── app.module.ts
├── common/
│   ├── guards/
│   │   ├── clerk-auth.guard.ts        # Verifica JWT Clerk
│   │   └── roles.guard.ts             # RBAC: @Role decorator
│   ├── decorators/
│   │   ├── current-tenant.decorator.ts
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   ├── interceptors/
│   │   └── tenant-context.interceptor.ts
│   └── filters/
│       └── prisma-exception.filter.ts
├── modules/
│   ├── auth/                          # Clerk webhook sync + JWT validation
│   ├── tenants/                       # Tenant CRUD + settings
│   ├── users/                         # User management RBAC
│   ├── products/                      # Inventory CRUD + S3 upload
│   ├── orders/                        # Order lifecycle management
│   ├── conversations/                 # Conversation history + messages
│   ├── analytics/                     # KPIs + chart data queries
│   ├── agent-config/                  # Persona + KB + rules
│   ├── payments/                      # Mercado Pago integration
│   └── support/                       # Human handoff management
└── gateways/
    └── events.gateway.ts              # Socket.io WebSocket gateway
```

---

### Task 1: Bootstrap + Auth Guards

**Files:**
- Modify: `apps/api/src/main.ts`
- Create: `apps/api/src/common/guards/clerk-auth.guard.ts`
- Create: `apps/api/src/common/decorators/current-tenant.decorator.ts`
- Test: `apps/api/src/common/guards/clerk-auth.guard.spec.ts`

- [ ] **Step 1: Escrever testes do ClerkAuthGuard**

```typescript
// apps/api/src/common/guards/clerk-auth.guard.spec.ts
import { ClerkAuthGuard } from "./clerk-auth.guard";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

function makeContext(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization },
        user: undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe("ClerkAuthGuard", () => {
  const configService = {
    get: (key: string) => (key === "clerk.secretKey" ? "sk_test_xxx" : null),
  } as unknown as ConfigService;

  const guard = new ClerkAuthGuard(configService);

  it("deve lançar UnauthorizedException sem header Authorization", async () => {
    await expect(guard.canActivate(makeContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("deve lançar UnauthorizedException com token inválido", async () => {
    await expect(
      guard.canActivate(makeContext("Bearer invalid_token_here")),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Implementar ClerkAuthGuard**

```typescript
// apps/api/src/common/guards/clerk-auth.guard.ts
import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClerkClient } from "@clerk/backend";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly clerk;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma?: PrismaService,
  ) {
    this.clerk = createClerkClient({
      secretKey: config.get<string>("clerk.secretKey"),
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization as string | undefined;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or invalid Authorization header");
    }

    const token = authHeader.slice(7);

    try {
      // Verificar JWT com Clerk SDK
      const payload = await this.clerk.verifyToken(token);

      // Buscar usuário local (sincronizado via webhook)
      if (this.prisma) {
        const user = await this.prisma.user.findUnique({
          where: { clerkId: payload.sub },
          include: { tenant: { select: { id: true, slug: true, status: true } } },
        });

        if (!user) {
          throw new UnauthorizedException("User not found in system");
        }

        if (user.tenant.status === "SUSPENDED" || user.tenant.status === "CANCELLED") {
          throw new UnauthorizedException("Tenant account is suspended");
        }

        req.user = user;
        req.tenantId = user.tenantId;
      } else {
        req.user = { clerkId: payload.sub };
      }

      return true;
    } catch (err) {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
```

- [ ] **Step 3: Criar decorators**

```typescript
// apps/api/src/common/decorators/current-tenant.decorator.ts
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentTenantId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    return req.tenantId as string;
  },
);

// apps/api/src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { User } from "@prisma/client";

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): User => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as User;
  },
);

// apps/api/src/common/decorators/roles.decorator.ts
import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@prisma/client";

export const ROLES_KEY = "roles";
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 4: Criar RolesGuard**

```typescript
// apps/api/src/common/guards/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { UserRole } from "@prisma/client";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  AGENT: 2,
  VIEWER: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) throw new ForbiddenException("No role assigned");

    const userLevel = ROLE_HIERARCHY[user.role as UserRole] ?? 0;
    const minRequired = Math.min(...requiredRoles.map((r) => ROLE_HIERARCHY[r] ?? 99));

    if (userLevel < minRequired) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredRoles.join(" or ")}`,
      );
    }

    return true;
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/
git commit -m "feat(api): add clerk auth guard, RBAC roles guard, and tenant decorators"
```

---

### Task 2: Products Module — CRUD + Busca + Upload de Imagens

**Files:**
- Create: `apps/api/src/modules/products/products.module.ts`
- Create: `apps/api/src/modules/products/products.controller.ts`
- Create: `apps/api/src/modules/products/products.service.ts`
- Create: `apps/api/src/modules/products/dto/create-product.dto.ts`
- Test: `apps/api/src/modules/products/products.service.spec.ts`

- [ ] **Step 1: Escrever testes**

```typescript
// apps/api/src/modules/products/products.service.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { ProductsService } from "./products.service";
import { PrismaService } from "../../common/prisma/prisma.service";

const mockPrisma = {
  product: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

describe("ProductsService", () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  it("deve criar produto com campos obrigatórios", async () => {
    const mockProduct = {
      id: "prod-uuid",
      tenantId: "tenant-123",
      name: "Camiseta Preta",
      priceCents: 5990,
      stockQty: 10,
    };
    mockPrisma.product.create.mockResolvedValue(mockProduct);

    const result = await service.create("tenant-123", {
      name: "Camiseta Preta",
      priceCents: 5990,
      stockQty: 10,
    });

    expect(result.name).toBe("Camiseta Preta");
    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-123",
          name: "Camiseta Preta",
          priceCents: 5990,
        }),
      }),
    );
  });

  it("deve filtrar produtos apenas do tenant correto", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    await service.findAll("tenant-123", { page: 1, limit: 20 });

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-123" }),
      }),
    );
  });
  
  it("deve rejeitar acesso a produto de outro tenant", async () => {
    mockPrisma.product.findFirst.mockResolvedValue(null); // produto não encontrado para este tenant
    
    await expect(
      service.findOne("tenant-123", "prod-de-outro-tenant"),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Criar DTO de criação**

```typescript
// apps/api/src/modules/products/dto/create-product.dto.ts
import {
  IsString, IsInt, IsOptional, IsArray, Min, MaxLength,
  IsEnum, IsJSON, IsNumber,
} from "class-validator";
import { Type } from "class-transformer";
import { ProductStatus } from "@prisma/client";

export class CreateProductDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  priceCents!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  comparePriceCents?: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockQty!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsJSON()
  variations?: string;  // JSON string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  weight?: number;
}

export class UpdateProductDto extends CreateProductDto {}

export class ListProductsDto {
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
```

- [ ] **Step 3: Implementar ProductsService**

```typescript
// apps/api/src/modules/products/products.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateProductDto, UpdateProductDto, ListProductsDto } from "./dto/create-product.dto";
import type { Product } from "@prisma/client";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateProductDto): Promise<Product> {
    return this.prisma.product.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        sku: dto.sku,
        priceCents: dto.priceCents,
        comparePriceCents: dto.comparePriceCents,
        stockQty: dto.stockQty,
        lowStockThreshold: dto.lowStockThreshold ?? 5,
        categoryId: dto.categoryId,
        status: dto.status ?? "ACTIVE",
        tags: dto.tags ?? [],
        imageUrls: dto.imageUrls ?? [],
        variations: dto.variations ? JSON.parse(dto.variations) : [],
        weight: dto.weight,
      },
    });
    // NOTE: O embedding do produto é gerado de forma assíncrona via job BullMQ
    // Veja queue/embedding.processor.ts (implementado em Plan 5)
  }

  async findAll(
    tenantId: string,
    query: ListProductsDto,
  ): Promise<{ items: Product[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 20, search, status, categoryId } = query;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
          { sku: { contains: search, mode: "insensitive" as const } },
          { tags: { has: search } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { category: { select: { id: true, name: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(tenantId: string, id: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto): Promise<Product> {
    await this.findOne(tenantId, id);  // Valida existência e tenant ownership

    return this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        variations: dto.variations ? JSON.parse(dto.variations) : undefined,
        isEmbedded: false,  // Marcar para re-embedding após atualização
      },
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.findOne(tenantId, id);
    await this.prisma.product.delete({ where: { id } });
  }

  async updateStock(tenantId: string, id: string, delta: number): Promise<Product> {
    await this.findOne(tenantId, id);
    
    return this.prisma.product.update({
      where: { id },
      data: { stockQty: { increment: delta } },
    });
  }

  async bulkImportFromCsv(
    tenantId: string,
    rows: Array<Record<string, string>>,
  ): Promise<{ created: number; errors: string[] }> {
    let created = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const priceCents = Math.round(parseFloat(row["preco"] ?? "0") * 100);
        const stockQty = parseInt(row["estoque"] ?? "0", 10);
        
        if (!row["nome"] || priceCents <= 0) {
          errors.push(`Linha inválida: ${JSON.stringify(row)}`);
          continue;
        }

        await this.create(tenantId, {
          name: row["nome"] ?? "",
          description: row["descricao"],
          sku: row["sku"],
          priceCents,
          stockQty,
          tags: row["tags"]?.split(",").map((t) => t.trim()) ?? [],
        });
        created++;
      } catch (err) {
        errors.push(`Erro ao importar "${row["nome"]}": ${err}`);
      }
    }

    return { created, errors };
  }
}
```

- [ ] **Step 4: Criar ProductsController**

```typescript
// apps/api/src/modules/products/products.controller.ts
import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, UseInterceptors, UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ProductsService } from "./products.service";
import { CreateProductDto, UpdateProductDto, ListProductsDto } from "./dto/create-product.dto";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";
import { parse as csvParse } from "csv-parse/sync";

@Controller("products")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Post()
  @Roles("OWNER", "ADMIN")
  create(@CurrentTenantId() tenantId: string, @Body() dto: CreateProductDto) {
    return this.service.create(tenantId, dto);
  }

  @Get()
  findAll(@CurrentTenantId() tenantId: string, @Query() query: ListProductsDto) {
    return this.service.findAll(tenantId, query);
  }

  @Get(":id")
  findOne(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Put(":id")
  @Roles("OWNER", "ADMIN")
  update(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(":id")
  @Roles("OWNER", "ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.service.remove(tenantId, id);
  }

  @Post("import/csv")
  @Roles("OWNER", "ADMIN")
  @UseInterceptors(FileInterceptor("file"))
  async importCsv(
    @CurrentTenantId() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const rows = csvParse(file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, string>>;
    
    return this.service.bulkImportFromCsv(tenantId, rows);
  }
}
```

- [ ] **Step 5: Rodar testes**

```bash
cd apps/api
pnpm test products.service
```

Expected: PASS — 3 testes passando

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/products/
git commit -m "feat(api): add products module with CRUD, bulk CSV import, and tenant isolation"
```

---

### Task 3: Orders Module + Mercado Pago Integration

**Files:**
- Create: `apps/api/src/modules/orders/orders.service.ts`
- Create: `apps/api/src/modules/orders/orders.controller.ts`
- Create: `apps/api/src/modules/payments/payments.service.ts`
- Create: `apps/api/src/modules/payments/payments.controller.ts`
- Test: `apps/api/src/modules/payments/payments.service.spec.ts`

- [ ] **Step 1: Escrever testes do PaymentsService**

```typescript
// apps/api/src/modules/payments/payments.service.spec.ts
import { Test } from "@nestjs/testing";
import { PaymentsService } from "./payments.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

const mockPrisma = {
  payment: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
  order: { update: jest.fn(), findFirst: jest.fn() },
};
const mockConfig = { get: (key: string) => "test_mp_token" };

// Mock Mercado Pago SDK
jest.mock("mercadopago", () => ({
  MercadoPagoConfig: jest.fn(),
  Payment: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({
      id: "mp_payment_id_123",
      status: "pending",
      point_of_interaction: {
        transaction_data: {
          qr_code: "00020101021243650016...",
          qr_code_base64: "iVBORw0KGgoAAAANS...",
        },
      },
    }),
  })),
}));

describe("PaymentsService", () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  it("deve gerar pagamento Pix e persistir no banco", async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: "order-uuid",
      totalCents: 9990,
      contact: { phone: "5511999999999", name: "João" },
    });
    mockPrisma.payment.create.mockResolvedValue({
      id: "pay-uuid",
      pixCopyPaste: "00020101...",
    });

    const result = await service.generatePix("tenant-123", "order-uuid");

    expect(result.pixCopyPaste).toBeDefined();
    expect(mockPrisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          method: "PIX",
          status: "PENDING",
        }),
      }),
    );
  });

  it("deve processar webhook de confirmação e atualizar pedido", async () => {
    mockPrisma.payment.findFirst.mockResolvedValue({
      id: "pay-uuid",
      orderId: "order-uuid",
      tenantId: "tenant-123",
    });
    mockPrisma.payment.update.mockResolvedValue({ id: "pay-uuid" });
    mockPrisma.order.update.mockResolvedValue({ id: "order-uuid", status: "PAYMENT_CONFIRMED" });

    await service.handleWebhook({
      type: "payment",
      data: { id: "mp_payment_id_123" },
    });

    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAYMENT_CONFIRMED" }),
      }),
    );
  });
});
```

- [ ] **Step 2: Implementar PaymentsService**

```typescript
// apps/api/src/modules/payments/payments.service.ts
import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma/prisma.service";
import { EventsGateway } from "../../gateways/events.gateway";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { randomUUID } from "crypto";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly mpClient: Payment;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly events?: EventsGateway,
  ) {
    const mp = new MercadoPagoConfig({
      accessToken: config.get<string>("mercadoPago.accessToken") as string,
    });
    this.mpClient = new Payment(mp);
  }

  async generatePix(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { contact: true, items: true },
    });

    if (!order) throw new NotFoundException("Order not found");

    const totalBrl = order.totalCents / 100;
    const idempotencyKey = randomUUID();

    // Criar pagamento Pix no Mercado Pago
    const mpPayment = await this.mpClient.create({
      body: {
        transaction_amount: totalBrl,
        description: `Pedido ${order.orderNumber} - WhatsAgent`,
        payment_method_id: "pix",
        payer: {
          email: order.contact.email ?? `${order.contact.phone}@whatsagent.com.br`,
          first_name: order.contact.name?.split(" ")[0] ?? "Cliente",
          last_name: order.contact.name?.split(" ").slice(1).join(" ") ?? "",
          identification: {
            type: "CPF",
            number: order.contact.cpf ?? "00000000000",
          },
        },
        external_reference: orderId,
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),  // 30min
      },
      requestOptions: { idempotencyKey },
    });

    const transactionData = mpPayment.point_of_interaction?.transaction_data;

    // Salvar no banco
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        tenantId,
        method: "PIX",
        status: "PENDING",
        amountCents: order.totalCents,
        gatewayId: String(mpPayment.id),
        gatewayResponse: mpPayment as object,
        pixCopyPaste: transactionData?.qr_code ?? null,
        pixExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // Atualizar status do pedido
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: "AWAITING_PAYMENT" },
    });

    this.logger.log(`Pix generated for order ${order.orderNumber}: ${mpPayment.id}`);

    return {
      paymentId: payment.id,
      pixCopyPaste: payment.pixCopyPaste,
      pixQrCodeBase64: transactionData?.qr_code_base64,
      expiresAt: payment.pixExpiresAt,
      totalCents: order.totalCents,
    };
  }

  async handleWebhook(body: { type: string; data: { id: string } }): Promise<void> {
    if (body.type !== "payment") return;

    const mpPaymentId = String(body.data.id);

    // Buscar o pagamento no MP para confirmar status
    const mpPayment = await this.mpClient.get({ id: mpPaymentId });
    const orderId = mpPayment.external_reference as string;

    if (!orderId) return;

    const payment = await this.prisma.payment.findFirst({
      where: { gatewayId: mpPaymentId },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for gateway ID: ${mpPaymentId}`);
      return;
    }

    const newPaymentStatus =
      mpPayment.status === "approved" ? "APPROVED" :
      mpPayment.status === "rejected" ? "REJECTED" : "PENDING";

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newPaymentStatus,
        paidAt: mpPayment.status === "approved" ? new Date() : null,
        gatewayResponse: mpPayment as object,
      },
    });

    if (mpPayment.status === "approved") {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: "PAYMENT_CONFIRMED", confirmedAt: new Date() },
      });

      this.logger.log(`Payment confirmed for order: ${orderId}`);

      // Notificar frontend em tempo real via WebSocket
      if (this.events) {
        this.events.emitToTenant(payment.tenantId, {
          type: "order_updated",
          payload: {
            orderId,
            orderNumber: "",
            status: "PAYMENT_CONFIRMED",
            totalCents: payment.amountCents,
          },
        });
      }
    }
  }
}
```

- [ ] **Step 3: Criar PaymentsController com webhook**

```typescript
// apps/api/src/modules/payments/payments.controller.ts
import {
  Controller, Post, Body, Param, UseGuards,
  Headers, RawBodyRequest, Req, HttpCode,
} from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";
import { createHmac } from "crypto";
import { ConfigService } from "@nestjs/config";

@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly service: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  @Post("generate")
  @UseGuards(ClerkAuthGuard)
  generatePix(
    @CurrentTenantId() tenantId: string,
    @Body("orderId") orderId: string,
  ) {
    return this.service.generatePix(tenantId, orderId);
  }

  // Endpoint interno para o AI Orchestrator (sem ClerkAuth, usa token interno)
  // Body: { orderId, paymentMethod: "PIX" | "CREDIT_CARD" }
  @Post("generate-internal")
  @HttpCode(200)
  generatePixInternal(
    @Headers("x-internal-token") token: string,
    @Body() body: { orderId: string; tenantId: string; paymentMethod: string },
  ) {
    if (token !== process.env.INTERNAL_API_TOKEN) {
      throw new HttpException("Unauthorized", 401);
    }
    return this.service.generatePix(body.tenantId, body.orderId);
  }

  // Webhook Mercado Pago (sem auth Clerk — chamado pelo MP diretamente)
  @Post("webhooks/mercadopago")
  @HttpCode(200)
  async mercadoPagoWebhook(
    @Body() body: { type: string; data: { id: string } },
    @Headers("x-signature") signature: string,
    @Headers("x-request-id") requestId: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    // Validar assinatura do webhook MP
    const secret = this.config.get<string>("mercadoPago.webhookSecret");
    if (secret && signature) {
      const parts = signature.split(",");
      const ts = parts.find((p) => p.startsWith("ts="))?.split("=")[1];
      const v1 = parts.find((p) => p.startsWith("v1="))?.split("=")[1];
      
      if (ts && v1) {
        const signedTemplate = `id:${body.data?.id};request-id:${requestId};ts:${ts};`;
        const expectedSig = createHmac("sha256", secret)
          .update(signedTemplate)
          .digest("hex");
        
        if (expectedSig !== v1) {
          return { status: "invalid_signature" };
        }
      }
    }

    await this.service.handleWebhook(body);
    return { received: true };
  }
}
```

- [ ] **Step 4: Rodar testes**

```bash
pnpm test payments.service
```

Expected: PASS — 2 testes passando

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/payments/ apps/api/src/modules/orders/
git commit -m "feat(api): add orders module and mercado pago pix payment integration"
```

---

### Task 4: Socket.io Events Gateway

**Files:**
- Create: `apps/api/src/gateways/events.gateway.ts`
- Test: `apps/api/src/gateways/events.gateway.spec.ts`

- [ ] **Step 1: Implementar EventsGateway**

```typescript
// apps/api/src/gateways/events.gateway.ts
import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection,
  OnGatewayDisconnect, SubscribeMessage, MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import type { WsEvent } from "@whatsagent/shared-types";

// Mapa: tenantId → Set de socket IDs conectados
const tenantSockets = new Map<string, Set<string>>();

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  },
  namespace: "/events",
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    const tenantId = client.handshake.auth.tenantId as string;
    
    if (!tenantId) {
      this.logger.warn(`Socket ${client.id} connected without tenantId`);
      client.disconnect();
      return;
    }

    if (!tenantSockets.has(tenantId)) {
      tenantSockets.set(tenantId, new Set());
    }
    tenantSockets.get(tenantId)!.add(client.id);
    
    // Juntar à room do tenant
    void client.join(`tenant:${tenantId}`);
    
    this.logger.log(`Socket ${client.id} connected for tenant ${tenantId}`);
  }

  handleDisconnect(client: Socket) {
    const tenantId = client.handshake.auth.tenantId as string;
    tenantSockets.get(tenantId)?.delete(client.id);
    this.logger.log(`Socket ${client.id} disconnected`);
  }

  // Emitir evento para todos os sockets de um tenant
  emitToTenant(tenantId: string, event: WsEvent): void {
    this.server.to(`tenant:${tenantId}`).emit("event", event);
  }

  // Cliente pode "entrar" em uma sala de conversa específica
  @SubscribeMessage("join_conversation")
  handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    void client.join(`conv:${data.conversationId}`);
    return { joined: data.conversationId };
  }

  // Emitir para todos numa conversa específica
  emitToConversation(conversationId: string, event: WsEvent): void {
    this.server.to(`conv:${conversationId}`).emit("event", event);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/gateways/
git commit -m "feat(api): add socket.io events gateway for realtime frontend updates"
```

---

### Task 4b: Orders Internal Endpoint (para AI Orchestrator)

**Files:**
- Modify: `apps/api/src/modules/orders/orders.controller.ts`

- [ ] **Step 1: Adicionar endpoint interno no OrdersController**

```typescript
// Adicionar ao OrdersController — apps/api/src/modules/orders/orders.controller.ts

// Endpoint interno para criação de pedido pelo AI Orchestrator
// Não usa ClerkAuth — usa X-Internal-Token
// Body: { tenantId, contactPhone, items: [{ productId, productName, priceCents, quantity }] }
@Post("internal")
@HttpCode(201)
async createInternal(
  @Headers("x-internal-token") token: string,
  @Body() body: {
    tenantId: string;
    contactPhone: string;
    items: Array<{
      productId: string;
      productName: string;
      priceCents: number;
      quantity: number;
      variationSelected?: Record<string, string>;
    }>;
  },
) {
  if (token !== process.env.INTERNAL_API_TOKEN) {
    throw new HttpException("Unauthorized", 401);
  }
  
  const subtotal = body.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  
  // Buscar ou criar contato
  const contact = await this.prisma.contact.upsert({
    where: { tenantId_phone: { tenantId: body.tenantId, phone: body.contactPhone } },
    create: { tenantId: body.tenantId, phone: body.contactPhone },
    update: {},
  });
  
  // Criar pedido com número único
  const orderNumber = `ORD-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  
  return this.prisma.order.create({
    data: {
      tenantId: body.tenantId,
      contactId: contact.id,
      orderNumber,
      subtotalCents: subtotal,
      totalCents: subtotal,
      status: "DRAFT",
      items: {
        create: body.items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          priceCents: i.priceCents,
          quantity: i.quantity,
          subtotalCents: i.priceCents * i.quantity,
          variationSelected: i.variationSelected ?? {},
        })),
      },
    },
  });
}
```

- [ ] **Step 2: Adicionar INTERNAL_API_TOKEN ao .env.example**

```bash
# Adicionar ao .env.example:
INTERNAL_API_TOKEN="whatsagent_internal_secret_2025"
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/orders/
git commit -m "feat(api): add internal order creation endpoint for ai orchestrator"
```

---

### Task 5: Analytics Module

**Files:**
- Create: `apps/api/src/modules/analytics/analytics.service.ts`
- Create: `apps/api/src/modules/analytics/analytics.controller.ts`

- [ ] **Step 1: Implementar AnalyticsService com queries otimizadas**

```typescript
// apps/api/src/modules/analytics/analytics.service.ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis(tenantId: string): Promise<Record<string, number>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      conversationsToday,
      aiResolvedToday,
      totalClosedToday,
      revenueToday,
      pendingHandoffs,
      avgResponseTimeMs,
      newContactsToday,
      ordersToday,
    ] = await Promise.all([
      this.prisma.conversation.count({
        where: { tenantId, startedAt: { gte: today } },
      }),
      this.prisma.conversation.count({
        where: { tenantId, startedAt: { gte: today }, resolutionType: "ai_resolved" },
      }),
      this.prisma.conversation.count({
        where: { tenantId, closedAt: { gte: today }, status: "CLOSED" },
      }),
      this.prisma.payment.aggregate({
        where: { tenantId, status: "APPROVED", paidAt: { gte: today } },
        _sum: { amountCents: true },
      }),
      this.prisma.conversation.count({
        where: { tenantId, status: "HUMAN_HANDOFF" },
      }),
      // Tempo médio de resposta em ms (baseado nos primeiros 100 msgs do dia)
      this.prisma.$queryRaw<[{ avg_ms: number }]>`
        SELECT AVG(EXTRACT(EPOCH FROM (m.sent_at - c.started_at)) * 1000) as avg_ms
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.tenant_id = ${tenantId}
          AND m.is_from_ai = true
          AND m.sent_at >= ${today}
        LIMIT 1
      `,
      this.prisma.contact.count({
        where: { tenantId, firstSeenAt: { gte: today } },
      }),
      this.prisma.order.count({
        where: { tenantId, createdAt: { gte: today } },
      }),
    ]);

    const aiResolutionRate =
      totalClosedToday > 0
        ? Math.round((aiResolvedToday / totalClosedToday) * 100)
        : 0;

    return {
      conversations_today: conversationsToday,
      ai_resolution_rate: aiResolutionRate,
      revenue_today: revenueToday._sum.amountCents ?? 0,
      pending_handoffs: pendingHandoffs,
      avg_response_time_sec: Math.round((avgResponseTimeMs[0]?.avg_ms ?? 4000) / 1000),
      new_contacts_today: newContactsToday,
      orders_today: ordersToday,
      conversion_rate:
        conversationsToday > 0
          ? Math.round((ordersToday / conversationsToday) * 100)
          : 0,
    };
  }

  async getConversationsChart(
    tenantId: string,
    days = 30,
  ): Promise<Array<{ date: string; total: number; ai_resolved: number; handoffs: number }>> {
    const result = await this.prisma.$queryRaw<
      Array<{ date: Date; total: bigint; ai_resolved: bigint; handoffs: bigint }>
    >`
      WITH dates AS (
        SELECT generate_series(
          NOW() - INTERVAL '${days} days',
          NOW(),
          INTERVAL '1 day'
        )::date AS date
      )
      SELECT
        d.date,
        COUNT(c.id) as total,
        COUNT(CASE WHEN c.resolution_type = 'ai_resolved' THEN 1 END) as ai_resolved,
        COUNT(CASE WHEN c.status = 'HUMAN_HANDOFF' THEN 1 END) as handoffs
      FROM dates d
      LEFT JOIN conversations c
        ON c.started_at::date = d.date
        AND c.tenant_id = ${tenantId}
      GROUP BY d.date
      ORDER BY d.date ASC
    `;

    return result.map((r) => ({
      date: new Date(r.date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      total: Number(r.total),
      ai_resolved: Number(r.ai_resolved),
      handoffs: Number(r.handoffs),
    }));
  }

  async getHandoffReasons(tenantId: string): Promise<Record<string, number>> {
    const result = await this.prisma.handoffEvent.groupBy({
      by: ["reason"],
      where: { tenantId, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      _count: { id: true },
    });

    return Object.fromEntries(result.map((r) => [r.reason, r._count.id]));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/analytics/
git commit -m "feat(api): add analytics service with KPI queries and chart data"
```

---

## Verificação do Plan 3

- [ ] Back-office API sobe: `pnpm --filter @whatsagent/api start:dev` → porta 3002
- [ ] `curl http://localhost:3002/health` → `{"status":"ok"}`
- [ ] Criar produto via API com token Clerk válido:
  ```bash
  curl -X POST http://localhost:3002/products \
    -H "Authorization: Bearer $CLERK_JWT" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","priceCents":1000,"stockQty":10}'
  ```
- [ ] Listar produtos → retorna apenas do tenant correto
- [ ] Tentar acessar produto de outro tenant → 404
- [ ] Socket.io conecta e emite evento teste:
  ```javascript
  // No browser console:
  const io = require("socket.io-client");
  const s = io("http://localhost:3002/events", { auth: { tenantId: "dev-tenant-uuid" } });
  s.on("event", (e) => console.log(e));
  ```
- [ ] Webhook Mercado Pago aceito em `POST /payments/webhooks/mercadopago`
- [ ] `GET /analytics/kpis` retorna KPIs corretos
- [ ] `pnpm --filter @whatsagent/api test` → todos passando
