# CRM Kanban Sales Funnel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full CRM Kanban sales funnel to WhatsAgent — visual drag-and-drop board with configurable stages, deal cards, BRL value tracking, and pipeline stats.

**Architecture:** New `FunnelStage` and `Deal` Prisma models (per-tenant), a new `CrmModule` in the NestJS API, and a new `/crm` route in the Next.js dashboard. Stages are lazy-seeded (7 defaults auto-created on first `GET /crm/stages` call per tenant). Drag-and-drop uses `@dnd-kit` with optimistic UI updates that revert on API error.

**Tech Stack:** Prisma (schema), NestJS (controller/service/dto/module), Next.js 14 App Router, @dnd-kit/core + @dnd-kit/sortable, Zustand store, existing `useApi` hook, shadcn/ui + Tailwind CSS v4 (dark OLED theme).

---

## Pre-requisite: Install @dnd-kit

Before any component code, run:

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities --filter @whatsagent/web
```

---

## File Map

### New files
**Backend:**
- `apps/api/src/modules/crm/dto/create-stage.dto.ts`
- `apps/api/src/modules/crm/dto/update-stage.dto.ts`
- `apps/api/src/modules/crm/dto/create-deal.dto.ts`
- `apps/api/src/modules/crm/dto/update-deal.dto.ts`
- `apps/api/src/modules/crm/dto/move-deal.dto.ts`
- `apps/api/src/modules/crm/crm.service.ts`
- `apps/api/src/modules/crm/crm.controller.ts`
- `apps/api/src/modules/crm/crm.module.ts`
- `apps/api/src/modules/crm/crm.service.spec.ts`

**Frontend:**
- `apps/web/src/types/crm.ts`
- `apps/web/src/lib/store/crm.store.ts`
- `apps/web/src/components/crm/DealCard.tsx`
- `apps/web/src/components/crm/KanbanColumn.tsx`
- `apps/web/src/components/crm/KanbanBoard.tsx`
- `apps/web/src/components/crm/DealFormModal.tsx`
- `apps/web/src/app/(dashboard)/crm/page.tsx`

### Modified files
- `packages/database/prisma/schema.prisma` — add FunnelStage + Deal models + back-refs on Tenant and Contact
- `apps/api/src/app.module.ts` — import CrmModule
- `apps/web/src/components/layout/Sidebar.tsx` — add CRM nav item
- `apps/web/src/app/globals.css` — add `.crm-*` CSS classes

---

## Task 1 — Prisma Schema + Migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add back-references to Tenant model**

Inside the `Tenant` model, after the `billing PlatformBilling?` line, add:
```prisma
funnelStages  FunnelStage[]
deals         Deal[]
```

- [ ] **Step 2: Add back-reference to Contact model**

Inside the `Contact` model, after `orders Order[]`, add:
```prisma
deals         Deal[]
```

- [ ] **Step 3: Append the two new models at the end of schema.prisma**

```prisma
model FunnelStage {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name      String
  color     String   @default("#6366F1")
  position  Int
  isWon     Boolean  @default(false)
  isLost    Boolean  @default(false)
  deals     Deal[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
}

model Deal {
  id         String      @id @default(uuid())
  tenantId   String
  tenant     Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  stageId    String
  stage      FunnelStage @relation(fields: [stageId], references: [id])
  contactId  String?
  contact    Contact?    @relation(fields: [contactId], references: [id], onDelete: SetNull)
  title      String
  valueCents Int         @default(0)
  notes      String?
  closedAt   DateTime?
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  @@index([tenantId, stageId])
}
```

- [ ] **Step 4: Run migration**

```bash
pnpm --filter @whatsagent/database migrate:dev -- --name add_crm_funnel
pnpm --filter @whatsagent/database generate
```

Expected output:
```
✔ Generated Prisma Client
migrations/
  └─ 20260606000000_add_crm_funnel/
       └─ migration.sql
```

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat(schema): add FunnelStage and Deal models for CRM kanban funnel"
```

---

## Task 2 — Backend: CRM Module

**Files:** all new under `apps/api/src/modules/crm/` + modify `apps/api/src/app.module.ts`

- [ ] **Step 1: Create `dto/create-stage.dto.ts`**

```typescript
import { IsString, IsInt, IsOptional, IsBoolean, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreateStageDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  position!: number;

  @IsOptional()
  @IsBoolean()
  isWon?: boolean;

  @IsOptional()
  @IsBoolean()
  isLost?: boolean;
}
```

- [ ] **Step 2: Create `dto/update-stage.dto.ts`**

```typescript
import { PartialType } from "@nestjs/mapped-types";
import { CreateStageDto } from "./create-stage.dto";

export class UpdateStageDto extends PartialType(CreateStageDto) {}
```

- [ ] **Step 3: Create `dto/create-deal.dto.ts`**

```typescript
import { IsString, IsInt, IsOptional, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreateDealDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  stageId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  valueCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  contactId?: string;
}

export class ListDealsDto {
  @IsOptional()
  @IsString()
  stageId?: string;
}
```

- [ ] **Step 4: Create `dto/update-deal.dto.ts`**

```typescript
import { PartialType } from "@nestjs/mapped-types";
import { CreateDealDto } from "./create-deal.dto";

export class UpdateDealDto extends PartialType(CreateDealDto) {}
```

- [ ] **Step 5: Create `dto/move-deal.dto.ts`**

```typescript
import { IsString } from "class-validator";

export class MoveDealDto {
  @IsString()
  stageId!: string;
}
```

- [ ] **Step 6: Create `crm.service.ts`**

```typescript
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateStageDto } from "./dto/create-stage.dto";
import { UpdateStageDto } from "./dto/update-stage.dto";
import { CreateDealDto, ListDealsDto } from "./dto/create-deal.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";
import { MoveDealDto } from "./dto/move-deal.dto";

const DEFAULT_STAGES = [
  { name: "Novo Lead",        color: "#6366F1", position: 0, isWon: false, isLost: false },
  { name: "Contato Feito",    color: "#06B6D4", position: 1, isWon: false, isLost: false },
  { name: "Qualificado",      color: "#F59E0B", position: 2, isWon: false, isLost: false },
  { name: "Proposta Enviada", color: "#8B5CF6", position: 3, isWon: false, isLost: false },
  { name: "Negociação",       color: "#F97316", position: 4, isWon: false, isLost: false },
  { name: "Ganho",            color: "#22C55E", position: 5, isWon: true,  isLost: false },
  { name: "Perdido",          color: "#EF4444", position: 6, isWon: false, isLost: true  },
];

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Stages ─────────────────────────────────────────────────────────────

  async findAllStages(tenantId: string) {
    const count = await this.prisma.funnelStage.count({ where: { tenantId } });
    if (count === 0) {
      await this.prisma.funnelStage.createMany({
        data: DEFAULT_STAGES.map((s) => ({ ...s, tenantId })),
      });
    }
    return this.prisma.funnelStage.findMany({
      where: { tenantId },
      orderBy: { position: "asc" },
    });
  }

  async createStage(tenantId: string, dto: CreateStageDto) {
    return this.prisma.funnelStage.create({
      data: {
        tenantId,
        name: dto.name,
        color: dto.color ?? "#6366F1",
        position: dto.position,
        isWon: dto.isWon ?? false,
        isLost: dto.isLost ?? false,
      },
    });
  }

  async updateStage(tenantId: string, id: string, dto: UpdateStageDto) {
    await this._findStageOrThrow(tenantId, id);
    return this.prisma.funnelStage.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.isWon !== undefined && { isWon: dto.isWon }),
        ...(dto.isLost !== undefined && { isLost: dto.isLost }),
      },
    });
  }

  async removeStage(tenantId: string, id: string) {
    await this._findStageOrThrow(tenantId, id);
    const dealCount = await this.prisma.deal.count({ where: { stageId: id, tenantId } });
    if (dealCount > 0) {
      throw new BadRequestException(
        `Não é possível excluir a etapa pois ela contém ${dealCount} negócio(s). Mova-os antes de excluir.`,
      );
    }
    await this.prisma.funnelStage.delete({ where: { id } });
  }

  private async _findStageOrThrow(tenantId: string, id: string) {
    const stage = await this.prisma.funnelStage.findFirst({ where: { id, tenantId } });
    if (!stage) throw new NotFoundException(`Etapa ${id} não encontrada`);
    return stage;
  }

  // ─── Deals ───────────────────────────────────────────────────────────────

  async findAllDeals(tenantId: string, query: ListDealsDto) {
    return this.prisma.deal.findMany({
      where: {
        tenantId,
        ...(query.stageId && { stageId: query.stageId }),
      },
      orderBy: { createdAt: "asc" },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        stage:   { select: { id: true, name: true, color: true } },
      },
    });
  }

  async createDeal(tenantId: string, dto: CreateDealDto) {
    await this._findStageOrThrow(tenantId, dto.stageId);
    return this.prisma.deal.create({
      data: {
        tenantId,
        title: dto.title,
        stageId: dto.stageId,
        valueCents: dto.valueCents ?? 0,
        notes: dto.notes ?? null,
        contactId: dto.contactId ?? null,
      },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        stage:   { select: { id: true, name: true, color: true } },
      },
    });
  }

  async updateDeal(tenantId: string, id: string, dto: UpdateDealDto) {
    await this._findDealOrThrow(tenantId, id);
    if (dto.stageId) await this._findStageOrThrow(tenantId, dto.stageId);
    return this.prisma.deal.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.stageId !== undefined && { stageId: dto.stageId }),
        ...(dto.valueCents !== undefined && { valueCents: dto.valueCents }),
        ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
        ...(dto.contactId !== undefined && { contactId: dto.contactId ?? null }),
      },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        stage:   { select: { id: true, name: true, color: true } },
      },
    });
  }

  async moveDeal(tenantId: string, id: string, dto: MoveDealDto) {
    await this._findDealOrThrow(tenantId, id);
    await this._findStageOrThrow(tenantId, dto.stageId);
    return this.prisma.deal.update({
      where: { id },
      data: { stageId: dto.stageId },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        stage:   { select: { id: true, name: true, color: true } },
      },
    });
  }

  async removeDeal(tenantId: string, id: string) {
    await this._findDealOrThrow(tenantId, id);
    await this.prisma.deal.delete({ where: { id } });
  }

  private async _findDealOrThrow(tenantId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({ where: { id, tenantId } });
    if (!deal) throw new NotFoundException(`Negócio ${id} não encontrado`);
    return deal;
  }

  // ─── Stats ───────────────────────────────────────────────────────────────

  async getStats(tenantId: string) {
    const openStages = await this.prisma.funnelStage.findMany({
      where: { tenantId, isWon: false, isLost: false },
      select: { id: true },
    });
    const openStageIds = openStages.map((s) => s.id);

    const [pipelineAgg, openCount, byStageGroups, allStages] = await Promise.all([
      this.prisma.deal.aggregate({
        where: { tenantId, stageId: { in: openStageIds } },
        _sum: { valueCents: true },
      }),
      this.prisma.deal.count({ where: { tenantId, stageId: { in: openStageIds } } }),
      this.prisma.deal.groupBy({
        by: ["stageId"],
        where: { tenantId },
        _count: { _all: true },
        _sum: { valueCents: true },
      }),
      this.prisma.funnelStage.findMany({
        where: { tenantId },
        select: { id: true, name: true, color: true },
      }),
    ]);

    const stageMap = new Map(allStages.map((s) => [s.id, s]));
    const byStage = byStageGroups.map((g) => ({
      stageId:    g.stageId,
      stageName:  stageMap.get(g.stageId)?.name ?? "",
      stageColor: stageMap.get(g.stageId)?.color ?? "#6366F1",
      count:      g._count._all,
      valueCents: g._sum.valueCents ?? 0,
    }));

    return {
      pipelineValueCents: pipelineAgg._sum.valueCents ?? 0,
      openCount,
      byStage,
    };
  }

  // ─── Contact search (for deal modal) ────────────────────────────────────

  async searchContacts(tenantId: string, q: string) {
    return this.prisma.contact.findMany({
      where: {
        tenantId,
        ...(q.trim() && {
          OR: [
            { name: { contains: q.trim(), mode: "insensitive" } },
            { phone: { contains: q.trim() } },
          ],
        }),
      },
      select: { id: true, name: true, phone: true },
      take: 20,
      orderBy: { name: "asc" },
    });
  }
}
```

- [ ] **Step 7: Create `crm.controller.ts`**

```typescript
import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from "@nestjs/common";
import { CrmService } from "./crm.service";
import { CreateStageDto } from "./dto/create-stage.dto";
import { UpdateStageDto } from "./dto/update-stage.dto";
import { CreateDealDto, ListDealsDto } from "./dto/create-deal.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";
import { MoveDealDto } from "./dto/move-deal.dto";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("crm")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class CrmController {
  constructor(private readonly service: CrmService) {}

  @Get("stages")
  findStages(@CurrentTenantId() tenantId: string) {
    return this.service.findAllStages(tenantId);
  }

  @Post("stages")
  @Roles("OWNER", "ADMIN")
  createStage(@CurrentTenantId() tenantId: string, @Body() dto: CreateStageDto) {
    return this.service.createStage(tenantId, dto);
  }

  @Put("stages/:id")
  @Roles("OWNER", "ADMIN")
  updateStage(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.service.updateStage(tenantId, id, dto);
  }

  @Delete("stages/:id")
  @Roles("OWNER", "ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeStage(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.service.removeStage(tenantId, id);
  }

  @Get("deals")
  findDeals(@CurrentTenantId() tenantId: string, @Query() query: ListDealsDto) {
    return this.service.findAllDeals(tenantId, query);
  }

  @Post("deals")
  @Roles("OWNER", "ADMIN", "AGENT")
  createDeal(@CurrentTenantId() tenantId: string, @Body() dto: CreateDealDto) {
    return this.service.createDeal(tenantId, dto);
  }

  @Put("deals/:id")
  @Roles("OWNER", "ADMIN", "AGENT")
  updateDeal(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.service.updateDeal(tenantId, id, dto);
  }

  @Patch("deals/:id/stage")
  @Roles("OWNER", "ADMIN", "AGENT")
  moveDeal(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: MoveDealDto,
  ) {
    return this.service.moveDeal(tenantId, id, dto);
  }

  @Delete("deals/:id")
  @Roles("OWNER", "ADMIN", "AGENT")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDeal(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.service.removeDeal(tenantId, id);
  }

  @Get("stats")
  getStats(@CurrentTenantId() tenantId: string) {
    return this.service.getStats(tenantId);
  }

  @Get("contacts/search")
  searchContacts(
    @CurrentTenantId() tenantId: string,
    @Query("q") q: string = "",
  ) {
    return this.service.searchContacts(tenantId, q);
  }
}
```

- [ ] **Step 8: Create `crm.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";

@Module({
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
```

- [ ] **Step 9: Register CrmModule in `apps/api/src/app.module.ts`**

Add import at top:
```typescript
import { CrmModule } from "./modules/crm/crm.module";
```

Add `CrmModule` to the `imports` array (after `AgentModule`).

- [ ] **Step 10: Write the test file `crm.service.spec.ts`**

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { CrmService } from "./crm.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";

const mockPrisma = {
  funnelStage: {
    count:      jest.fn(),
    createMany: jest.fn(),
    findMany:   jest.fn(),
    findFirst:  jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
  },
  deal: {
    findMany:  jest.fn(),
    findFirst: jest.fn(),
    create:    jest.fn(),
    update:    jest.fn(),
    delete:    jest.fn(),
    count:     jest.fn(),
    aggregate: jest.fn(),
    groupBy:   jest.fn(),
  },
  contact: { findMany: jest.fn() },
};

describe("CrmService", () => {
  let service: CrmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrmService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CrmService>(CrmService);
    jest.clearAllMocks();
  });

  describe("findAllStages", () => {
    it("deve semear os 7 estágios padrão quando o tenant não tem etapas", async () => {
      mockPrisma.funnelStage.count.mockResolvedValue(0);
      mockPrisma.funnelStage.createMany.mockResolvedValue({ count: 7 });
      mockPrisma.funnelStage.findMany.mockResolvedValue([]);

      await service.findAllStages("tenant-123");

      expect(mockPrisma.funnelStage.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ name: "Novo Lead", tenantId: "tenant-123" }),
            expect.objectContaining({ name: "Ganho", isWon: true }),
            expect.objectContaining({ name: "Perdido", isLost: true }),
          ]),
        }),
      );
      expect(mockPrisma.funnelStage.createMany.mock.calls[0][0].data).toHaveLength(7);
    });

    it("não deve semear se já existem etapas", async () => {
      mockPrisma.funnelStage.count.mockResolvedValue(3);
      mockPrisma.funnelStage.findMany.mockResolvedValue([]);

      await service.findAllStages("tenant-123");

      expect(mockPrisma.funnelStage.createMany).not.toHaveBeenCalled();
    });

    it("deve ordenar etapas por position", async () => {
      mockPrisma.funnelStage.count.mockResolvedValue(2);
      mockPrisma.funnelStage.findMany.mockResolvedValue([]);

      await service.findAllStages("tenant-123");

      expect(mockPrisma.funnelStage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { position: "asc" } }),
      );
    });
  });

  describe("removeStage", () => {
    it("deve lançar BadRequestException se a etapa tiver negócios", async () => {
      mockPrisma.funnelStage.findFirst.mockResolvedValue({ id: "stage-1", tenantId: "tenant-123" });
      mockPrisma.deal.count.mockResolvedValue(3);

      await expect(service.removeStage("tenant-123", "stage-1")).rejects.toThrow(BadRequestException);
      expect(mockPrisma.funnelStage.delete).not.toHaveBeenCalled();
    });

    it("deve excluir etapa vazia sem erro", async () => {
      mockPrisma.funnelStage.findFirst.mockResolvedValue({ id: "stage-1", tenantId: "tenant-123" });
      mockPrisma.deal.count.mockResolvedValue(0);
      mockPrisma.funnelStage.delete.mockResolvedValue({});

      await service.removeStage("tenant-123", "stage-1");

      expect(mockPrisma.funnelStage.delete).toHaveBeenCalledWith({ where: { id: "stage-1" } });
    });

    it("deve lançar NotFoundException para etapa de outro tenant", async () => {
      mockPrisma.funnelStage.findFirst.mockResolvedValue(null);

      await expect(service.removeStage("tenant-123", "stage-outro")).rejects.toThrow(NotFoundException);
    });
  });

  describe("createDeal", () => {
    it("deve criar negócio com stageId válido do tenant", async () => {
      mockPrisma.funnelStage.findFirst.mockResolvedValue({ id: "stage-1", tenantId: "tenant-123" });
      mockPrisma.deal.create.mockResolvedValue({ id: "deal-1", title: "Venda X", stageId: "stage-1" });

      const result = await service.createDeal("tenant-123", {
        title: "Venda X",
        stageId: "stage-1",
        valueCents: 50000,
      });

      expect(result.title).toBe("Venda X");
      expect(mockPrisma.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: "tenant-123", stageId: "stage-1" }),
        }),
      );
    });

    it("deve rejeitar criação com stageId de outro tenant", async () => {
      mockPrisma.funnelStage.findFirst.mockResolvedValue(null);

      await expect(
        service.createDeal("tenant-123", { title: "Deal", stageId: "stage-outro" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("moveDeal", () => {
    it("deve mover deal para nova etapa do mesmo tenant", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({ id: "deal-1", tenantId: "tenant-123" });
      mockPrisma.funnelStage.findFirst.mockResolvedValue({ id: "stage-2", tenantId: "tenant-123" });
      mockPrisma.deal.update.mockResolvedValue({ id: "deal-1", stageId: "stage-2" });

      await service.moveDeal("tenant-123", "deal-1", { stageId: "stage-2" });

      expect(mockPrisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "deal-1" }, data: { stageId: "stage-2" } }),
      );
    });

    it("deve lançar NotFoundException para deal inexistente", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(null);

      await expect(service.moveDeal("tenant-123", "nao-existe", { stageId: "stage-1" })).rejects.toThrow(NotFoundException);
    });
  });

  describe("getStats", () => {
    it("deve retornar pipelineValueCents, openCount e byStage", async () => {
      mockPrisma.funnelStage.findMany
        .mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }])
        .mockResolvedValueOnce([
          { id: "s1", name: "Novo Lead", color: "#6366F1" },
          { id: "s2", name: "Qualificado", color: "#F59E0B" },
        ]);
      mockPrisma.deal.aggregate.mockResolvedValue({ _sum: { valueCents: 150000 } });
      mockPrisma.deal.count.mockResolvedValue(3);
      mockPrisma.deal.groupBy.mockResolvedValue([
        { stageId: "s1", _count: { _all: 2 }, _sum: { valueCents: 100000 } },
        { stageId: "s2", _count: { _all: 1 }, _sum: { valueCents: 50000 } },
      ]);

      const result = await service.getStats("tenant-123");

      expect(result.pipelineValueCents).toBe(150000);
      expect(result.openCount).toBe(3);
      expect(result.byStage[0]).toMatchObject({ stageId: "s1", stageName: "Novo Lead", count: 2 });
    });

    it("deve retornar zeros quando não há negócios", async () => {
      mockPrisma.funnelStage.findMany.mockResolvedValue([]);
      mockPrisma.deal.aggregate.mockResolvedValue({ _sum: { valueCents: null } });
      mockPrisma.deal.count.mockResolvedValue(0);
      mockPrisma.deal.groupBy.mockResolvedValue([]);

      const result = await service.getStats("tenant-vazio");

      expect(result.pipelineValueCents).toBe(0);
      expect(result.openCount).toBe(0);
      expect(result.byStage).toHaveLength(0);
    });
  });

  describe("searchContacts", () => {
    it("deve filtrar contatos por nome e limitar a 20 resultados", async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        { id: "c1", name: "João Silva", phone: "11999991111" },
      ]);

      const result = await service.searchContacts("tenant-123", "João");

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-123" }), take: 20 }),
      );
      expect(result[0]?.name).toBe("João Silva");
    });

    it("deve retornar todos os contatos quando q está vazio", async () => {
      mockPrisma.contact.findMany.mockResolvedValue([]);

      await service.searchContacts("tenant-123", "");

      const call = mockPrisma.contact.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty("OR");
    });
  });
});
```

- [ ] **Step 11: Run tests**

```bash
pnpm --filter @whatsagent/api test -- crm.service.spec.ts
```

Expected: `Tests: 14 passed, 14 total`

- [ ] **Step 12: Commit**

```bash
git add apps/api/src/modules/crm apps/api/src/app.module.ts
git commit -m "feat(api): add CRM module — stages, deals CRUD, move-stage, stats, contact search"
```

---

## Task 3 — Frontend: Types + Zustand Store

**Files:**
- Create: `apps/web/src/types/crm.ts`
- Create: `apps/web/src/lib/store/crm.store.ts`

- [ ] **Step 1: Create `apps/web/src/types/crm.ts`**

```typescript
export interface FunnelStage {
  id:        string;
  tenantId:  string;
  name:      string;
  color:     string;
  position:  number;
  isWon:     boolean;
  isLost:    boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DealContact {
  id:    string;
  name:  string | null;
  phone: string;
}

export interface DealStage {
  id:    string;
  name:  string;
  color: string;
}

export interface Deal {
  id:         string;
  tenantId:   string;
  stageId:    string;
  stage:      DealStage;
  contactId:  string | null;
  contact:    DealContact | null;
  title:      string;
  valueCents: number;
  notes:      string | null;
  closedAt:   string | null;
  createdAt:  string;
  updatedAt:  string;
}

export interface CrmStats {
  pipelineValueCents: number;
  openCount:          number;
  byStage: Array<{
    stageId:    string;
    stageName:  string;
    stageColor: string;
    count:      number;
    valueCents: number;
  }>;
}

export interface ContactSearchResult {
  id:    string;
  name:  string | null;
  phone: string;
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
```

- [ ] **Step 2: Create `apps/web/src/lib/store/crm.store.ts`**

```typescript
import { create } from "zustand";
import { Deal, FunnelStage, CrmStats } from "@/types/crm";

interface CrmStore {
  stages:          FunnelStage[];
  deals:           Deal[];
  stats:           CrmStats | null;
  loading:         boolean;
  statsLoading:    boolean;

  setStages:       (stages: FunnelStage[]) => void;
  setDeals:        (deals: Deal[])         => void;
  setStats:        (stats: CrmStats)       => void;
  setLoading:      (v: boolean)            => void;
  setStatsLoading: (v: boolean)            => void;

  optimisticMove: (dealId: string, toStageId: string)   => void;
  revertMove:     (dealId: string, fromStageId: string)  => void;

  addDeal:    (deal: Deal)      => void;
  updateDeal: (deal: Deal)      => void;
  removeDeal: (dealId: string)  => void;

  addStage:    (stage: FunnelStage)  => void;
  updateStage: (stage: FunnelStage)  => void;
  removeStage: (stageId: string)     => void;
}

export const useCrmStore = create<CrmStore>((set) => ({
  stages:          [],
  deals:           [],
  stats:           null,
  loading:         false,
  statsLoading:    false,

  setStages:       (stages)       => set({ stages }),
  setDeals:        (deals)        => set({ deals }),
  setStats:        (stats)        => set({ stats }),
  setLoading:      (loading)      => set({ loading }),
  setStatsLoading: (statsLoading) => set({ statsLoading }),

  optimisticMove: (dealId, toStageId) =>
    set((s) => ({ deals: s.deals.map((d) => d.id === dealId ? { ...d, stageId: toStageId } : d) })),

  revertMove: (dealId, fromStageId) =>
    set((s) => ({ deals: s.deals.map((d) => d.id === dealId ? { ...d, stageId: fromStageId } : d) })),

  addDeal:    (deal)    => set((s) => ({ deals: [...s.deals, deal] })),
  updateDeal: (deal)    => set((s) => ({ deals: s.deals.map((d) => d.id === deal.id ? deal : d) })),
  removeDeal: (dealId)  => set((s) => ({ deals: s.deals.filter((d) => d.id !== dealId) })),

  addStage:    (stage)   => set((s) => ({ stages: [...s.stages, stage].sort((a, b) => a.position - b.position) })),
  updateStage: (stage)   => set((s) => ({ stages: s.stages.map((st) => st.id === stage.id ? stage : st) })),
  removeStage: (stageId) => set((s) => ({ stages: s.stages.filter((st) => st.id !== stageId) })),
}));
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/types/crm.ts apps/web/src/lib/store/crm.store.ts
git commit -m "feat(web): add CRM types and Zustand store with optimistic move support"
```

---

## Task 4 — Frontend: DealCard + KanbanColumn

**Files:**
- Create: `apps/web/src/components/crm/DealCard.tsx`
- Create: `apps/web/src/components/crm/KanbanColumn.tsx`

- [ ] **Step 1: Create `DealCard.tsx`**

```tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, User, Pencil, Trash2 } from "lucide-react";
import { Deal, formatBRL, formatDate } from "@/types/crm";

interface Props {
  deal:     Deal;
  onEdit:   (deal: Deal) => void;
  onDelete: (deal: Deal) => void;
}

export function DealCard({ deal, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="crm-deal-card">
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="crm-deal-drag"
        aria-label="Arrastar negócio"
      >
        <GripVertical className="w-3 h-3" />
      </button>

      <div className="crm-deal-body">
        <p className="crm-deal-title">{deal.title}</p>

        {deal.valueCents > 0 && (
          <p className="crm-deal-value">{formatBRL(deal.valueCents)}</p>
        )}

        {deal.contact && (
          <div className="crm-deal-contact">
            <User className="w-3 h-3 shrink-0" />
            <span>{deal.contact.name ?? deal.contact.phone}</span>
          </div>
        )}

        <div className="crm-deal-footer">
          <span className="crm-deal-date">{formatDate(deal.createdAt)}</span>
          <div className="crm-deal-actions">
            <button type="button" className="crm-deal-btn" onClick={() => onEdit(deal)} aria-label="Editar">
              <Pencil className="w-3 h-3" />
            </button>
            <button type="button" className="crm-deal-btn crm-deal-btn--danger" onClick={() => onDelete(deal)} aria-label="Excluir">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `KanbanColumn.tsx`**

```tsx
"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Deal, FunnelStage, formatBRL } from "@/types/crm";
import { DealCard } from "./DealCard";

interface Props {
  stage:        FunnelStage;
  deals:        Deal[];
  onAddDeal:    (stageId: string) => void;
  onEditDeal:   (deal: Deal) => void;
  onDeleteDeal: (deal: Deal) => void;
}

export function KanbanColumn({ stage, deals, onAddDeal, onEditDeal, onDeleteDeal }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const totalValue = deals.reduce((sum, d) => sum + d.valueCents, 0);

  return (
    <div className={`crm-column${isOver ? " crm-column--over" : ""}`}>
      <div className="crm-column-header">
        <div className="crm-column-header-left">
          <span className="crm-column-dot" style={{ background: stage.color }} aria-hidden />
          <span className="crm-column-name">{stage.name}</span>
          <span className="crm-column-count">{deals.length}</span>
        </div>
        <button
          type="button"
          className="crm-column-add-btn"
          onClick={() => onAddDeal(stage.id)}
          aria-label={`Adicionar negócio em ${stage.name}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {totalValue > 0 && <p className="crm-column-value">{formatBRL(totalValue)}</p>}

      <div ref={setNodeRef} className="crm-column-cards">
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onEdit={onEditDeal} onDelete={onDeleteDeal} />
          ))}
        </SortableContext>
        {deals.length === 0 && <div className="crm-column-empty">Nenhum negócio</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/crm/
git commit -m "feat(web): add DealCard and KanbanColumn components with dnd-kit sortable"
```

---

## Task 5 — Frontend: KanbanBoard with DnD Context

**Files:**
- Create: `apps/web/src/components/crm/KanbanBoard.tsx`

- [ ] **Step 1: Create `KanbanBoard.tsx`**

```tsx
"use client";

import { useCallback, useRef, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import { useCrmStore } from "@/lib/store/crm.store";
import { useApi } from "@/lib/hooks/useApi";
import { Deal } from "@/types/crm";
import { KanbanColumn } from "./KanbanColumn";
import { DealCard } from "./DealCard";

interface Props {
  onAddDeal:    (stageId: string) => void;
  onEditDeal:   (deal: Deal) => void;
  onDeleteDeal: (deal: Deal) => void;
}

export function KanbanBoard({ onAddDeal, onEditDeal, onDeleteDeal }: Props) {
  const { apiFetch } = useApi();
  const stages         = useCrmStore((s) => s.stages);
  const deals          = useCrmStore((s) => s.deals);
  const optimisticMove = useCrmStore((s) => s.optimisticMove);
  const revertMove     = useCrmStore((s) => s.revertMove);
  const updateDeal     = useCrmStore((s) => s.updateDeal);

  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const dragOriginStageId = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    if (deal) {
      setActiveDeal(deal);
      dragOriginStageId.current = deal.stageId;
    }
  }, [deals]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;

    const draggedDeal = deals.find((d) => d.id === active.id);
    if (!draggedDeal) return;

    const targetStageId =
      stages.find((s) => s.id === over.id)
        ? (over.id as string)
        : deals.find((d) => d.id === over.id)?.stageId ?? null;

    if (!targetStageId || targetStageId === draggedDeal.stageId) return;

    const originStageId = dragOriginStageId.current!;
    optimisticMove(draggedDeal.id, targetStageId);

    try {
      const res = await apiFetch(`/crm/deals/${draggedDeal.id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stageId: targetStageId }),
      });
      if (!res.ok) throw new Error("Falha ao mover negócio");
      const updated: Deal = await res.json();
      updateDeal(updated);
    } catch {
      revertMove(draggedDeal.id, originStageId);
    }
  }, [deals, stages, apiFetch, optimisticMove, revertMove, updateDeal]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="crm-board">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={deals.filter((d) => d.stageId === stage.id)}
            onAddDeal={onAddDeal}
            onEditDeal={onEditDeal}
            onDeleteDeal={onDeleteDeal}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDeal && (
          <DealCard deal={activeDeal} onEdit={() => {}} onDelete={() => {}} />
        )}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/crm/KanbanBoard.tsx
git commit -m "feat(web): add KanbanBoard with DnD context, optimistic move and error revert"
```

---

## Task 6 — Frontend: DealFormModal

**Files:**
- Create: `apps/web/src/components/crm/DealFormModal.tsx`

Note: This modal reuses existing components — `Modal` from `@/components/ui/Modal`, `FormSelect` from `@/components/ui/FormSelect`, `DecimalInput` from `@/components/ui/DecimalInput`, and `centsToMaskedPrice`/`maskedPriceToCents` from `@/lib/decimal-mask`. Verify these exports exist before implementing; adjust import paths if they differ.

- [ ] **Step 1: Create `DealFormModal.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Kanban } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/FormSelect";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { useApi } from "@/lib/hooks/useApi";
import { useCrmStore } from "@/lib/store/crm.store";
import { Deal, ContactSearchResult } from "@/types/crm";
import { centsToMaskedPrice, maskedPriceToCents } from "@/lib/decimal-mask";

interface Props {
  open:             boolean;
  onClose:          () => void;
  onSaved:          () => void;
  deal?:            Deal | null;
  initialStageId?:  string;
}

interface FormState {
  title:      string;
  stageId:    string;
  valueReais: string;
  notes:      string;
  contactId:  string;
}

const EMPTY: FormState = { title: "", stageId: "", valueReais: "", notes: "", contactId: "" };

function dealToForm(d: Deal): FormState {
  return {
    title:      d.title,
    stageId:    d.stageId,
    valueReais: d.valueCents > 0 ? centsToMaskedPrice(d.valueCents) : "",
    notes:      d.notes ?? "",
    contactId:  d.contactId ?? "",
  };
}

export function DealFormModal({ open, onClose, onSaved, deal, initialStageId }: Props) {
  const { apiFetch } = useApi();
  const stages     = useCrmStore((s) => s.stages);
  const addDeal    = useCrmStore((s) => s.addDeal);
  const updateDeal = useCrmStore((s) => s.updateDeal);

  const [form,          setForm]          = useState<FormState>(EMPTY);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [contacts,      setContacts]      = useState<ContactSearchResult[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  const isEditing = !!deal;

  useEffect(() => {
    if (!open) return;
    const base = deal
      ? dealToForm(deal)
      : { ...EMPTY, stageId: initialStageId ?? stages[0]?.id ?? "" };
    setForm(base);
    setError(null);
    setContactSearch("");
    if (deal?.contact) {
      setContacts([{ id: deal.contact.id, name: deal.contact.name, phone: deal.contact.phone }]);
    } else {
      setContacts([]);
    }
  }, [open, deal, initialStageId, stages]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setContactLoading(true);
      try {
        const res = await apiFetch(`/crm/contacts/search?q=${encodeURIComponent(contactSearch)}`);
        if (res.ok) setContacts(await res.json());
      } finally {
        setContactLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [contactSearch, open, apiFetch]);

  const setField = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.stageId) {
      setError("Título e etapa são obrigatórios.");
      return;
    }
    setSaving(true);
    setError(null);

    const valueCents = form.valueReais.trim() ? (maskedPriceToCents(form.valueReais) ?? 0) : 0;
    const body = {
      title:     form.title.trim(),
      stageId:   form.stageId,
      valueCents,
      notes:     form.notes.trim() || undefined,
      contactId: form.contactId || undefined,
    };

    try {
      const res = await apiFetch(
        isEditing ? `/crm/deals/${deal!.id}` : "/crm/deals",
        { method: isEditing ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string })?.message ?? "Erro ao salvar negócio.");
      }
      const saved: Deal = await res.json();
      isEditing ? updateDeal(saved) : addDeal(saved);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name, color: s.color }));
  const contactOptions = [
    { value: "", label: "Nenhum contato" },
    ...contacts.map((c) => ({
      value: c.id,
      label: c.name ? `${c.name} (${c.phone})` : c.phone,
    })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar negócio" : "Novo negócio"}
      subtitle={isEditing ? `Editando: ${deal?.title}` : "Preencha os dados do negócio"}
      size="md"
      headerLeading={<Kanban className="w-5 h-5 text-indigo-400" />}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button
            form="deal-form"
            type="submit"
            disabled={saving || !form.title.trim() || !form.stageId}
            className="catalog-add-btn"
            style={{ minWidth: 120 }}
          >
            {saving ? "Salvando…" : isEditing ? "Salvar" : "Adicionar"}
          </button>
        </>
      }
    >
      <form id="deal-form" onSubmit={handleSubmit}>
        <div className="form-grid-2">
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Título *</label>
            <input
              className="form-input"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Ex.: Proposta para Empresa XYZ"
              required
              maxLength={200}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Etapa *</label>
            <FormSelect
              value={form.stageId}
              onChange={(v) => setField("stageId", v)}
              options={stageOptions}
              placeholder="Selecionar etapa…"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Valor (R$)</label>
            <DecimalInput
              value={form.valueReais}
              onChange={(v) => setField("valueReais", v)}
              placeholder="0,00"
            />
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Contato</label>
            <input
              className="form-input"
              placeholder="Buscar por nome ou telefone…"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
            />
            {contactSearch.length > 0 && (
              <FormSelect
                value={form.contactId}
                onChange={(v) => setField("contactId", v)}
                options={contactOptions}
                placeholder={contactLoading ? "Buscando…" : "Selecionar contato…"}
              />
            )}
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Observações</label>
            <textarea
              className="form-input"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Anotações sobre o negócio…"
              rows={3}
              maxLength={2000}
              style={{ resize: "vertical" }}
            />
          </div>
        </div>

        {error && (
          <div style={{
            marginTop: 12, padding: "8px 12px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8, color: "#fca5a5", fontSize: 12,
          }}>
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/crm/DealFormModal.tsx
git commit -m "feat(web): add DealFormModal with stage selector, BRL value, and contact search"
```

---

## Task 7 — Frontend: CRM Page + CSS + Sidebar

**Files:**
- Create: `apps/web/src/app/(dashboard)/crm/page.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Create `apps/web/src/app/(dashboard)/crm/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Kanban, TrendingUp, LayoutGrid, DollarSign } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { DealFormModal } from "@/components/crm/DealFormModal";
import { useApi } from "@/lib/hooks/useApi";
import { useCrmStore } from "@/lib/store/crm.store";
import { Deal, CrmStats, formatBRL } from "@/types/crm";

export default function CrmPage() {
  const { apiFetch } = useApi();

  const setStages       = useCrmStore((s) => s.setStages);
  const setDeals        = useCrmStore((s) => s.setDeals);
  const setStats        = useCrmStore((s) => s.setStats);
  const setLoading      = useCrmStore((s) => s.setLoading);
  const setStatsLoading = useCrmStore((s) => s.setStatsLoading);
  const removeDeal      = useCrmStore((s) => s.removeDeal);
  const stats           = useCrmStore((s) => s.stats);
  const loading         = useCrmStore((s) => s.loading);
  const statsLoading    = useCrmStore((s) => s.statsLoading);

  const [formOpen,       setFormOpen]       = useState(false);
  const [editDeal,       setEditDeal]       = useState<Deal | null>(null);
  const [initialStageId, setInitialStageId] = useState<string | undefined>();
  const [toast,          setToast]          = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<Deal | null>(null);
  const [deleting,       setDeleting]       = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [stagesRes, dealsRes] = await Promise.all([
        apiFetch("/crm/stages"),
        apiFetch("/crm/deals"),
      ]);
      if (stagesRes.ok) setStages(await stagesRes.json());
      if (dealsRes.ok)  setDeals(await dealsRes.json());
    } finally {
      setLoading(false);
    }
  }, [apiFetch, setStages, setDeals, setLoading]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await apiFetch("/crm/stats");
      if (res.ok) setStats(await res.json() as CrmStats);
    } finally {
      setStatsLoading(false);
    }
  }, [apiFetch, setStats, setStatsLoading]);

  useEffect(() => { void loadAll(); void loadStats(); }, [loadAll, loadStats]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const isEditing = !!editDeal;

  function openCreate(stageId: string) {
    setEditDeal(null);
    setInitialStageId(stageId);
    setFormOpen(true);
  }

  function openEdit(deal: Deal) {
    setEditDeal(deal);
    setInitialStageId(undefined);
    setFormOpen(true);
  }

  function handleSaved() {
    void loadStats();
    setToast({ type: "success", msg: isEditing ? "Negócio atualizado!" : "Negócio criado!" });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/crm/deals/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir.");
      removeDeal(deleteTarget.id);
      void loadStats();
      setToast({ type: "success", msg: "Negócio excluído." });
    } catch {
      setToast({ type: "error", msg: "Falha ao excluir o negócio." });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const STAT_CARDS = [
    { label: "Pipeline total",       value: statsLoading ? "…" : formatBRL(stats?.pipelineValueCents ?? 0), icon: DollarSign, color: "#22c55e" },
    { label: "Negócios em aberto",   value: statsLoading ? "…" : String(stats?.openCount ?? 0),              icon: TrendingUp,  color: "#6366f1" },
    { label: "Etapas ativas",        value: statsLoading ? "…" : String(stats?.byStage.length ?? 0),         icon: LayoutGrid,  color: "#06b6d4" },
  ];

  return (
    <div className="fade-up flex flex-col h-screen overflow-hidden">
      <Header title="CRM" subtitle="Funil de vendas e gestão de negócios" />

      <div className="dashboard-page" style={{ flex: 1, overflow: "hidden", gap: 16 }}>
        {/* Hero */}
        <div className="catalog-hero" style={{ marginBottom: 0 }}>
          <div className="catalog-hero-content">
            <div className="catalog-hero-badge">
              <Kanban className="w-3 h-3" strokeWidth={2} />
              CRM Kanban
            </div>
            <h2 className="catalog-hero-title">Funil de Vendas</h2>
            <p className="catalog-hero-sub">Arraste os negócios entre as etapas para atualizar o funil</p>
          </div>
          <div className="catalog-hero-actions">
            <button
              type="button"
              className="catalog-add-btn"
              onClick={() => openCreate(useCrmStore.getState().stages[0]?.id ?? "")}
            >
              + Novo negócio
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {STAT_CARDS.map((s) => (
            <div key={s.label} style={{
              background: "rgba(15,23,42,0.8)", border: "1px solid var(--c-border)",
              borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: `${s.color}18`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Board */}
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#64748b", fontSize: 13 }}>Carregando funil…</p>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: "auto" }}>
            <KanbanBoard
              onAddDeal={openCreate}
              onEditDeal={openEdit}
              onDeleteDeal={(deal) => setDeleteTarget(deal)}
            />
          </div>
        )}
      </div>

      <DealFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditDeal(null); }}
        onSaved={handleSaved}
        deal={editDeal}
        initialStageId={initialStageId}
      />

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-main">
                <div className="modal-header-text">
                  <h2 className="modal-title">Excluir negócio</h2>
                  <p className="modal-subtitle">
                    Tem certeza que deseja excluir &ldquo;{deleteTarget.title}&rdquo;? Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-ghost" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                style={{
                  padding: "0 16px", height: 36, borderRadius: 8,
                  background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 600,
                  border: "none", cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`kb-toast kb-toast--${toast.type}`}
          style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add CRM nav item to Sidebar**

In `apps/web/src/components/layout/Sidebar.tsx`:

Add `Kanban` to the lucide-react import, then add a nav item in the "Configurar" section after "Catálogo":

```typescript
{ href: "/crm", label: "CRM", icon: Kanban },
```

- [ ] **Step 3: Add Kanban CSS classes to `apps/web/src/app/globals.css`**

Append before the closing `}` of `@layer components`:

```css
  /* ── CRM Kanban ─────────────────────────────────────────────────── */
  .crm-board {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    min-width: max-content;
    padding-bottom: 16px;
  }
  .crm-column {
    display: flex;
    flex-direction: column;
    width: 260px;
    min-width: 260px;
    background: var(--c-s1);
    border: 1px solid var(--c-border);
    border-radius: 12px;
    padding: 12px;
    gap: 8px;
    transition: border-color 150ms ease, background 150ms ease;
  }
  .crm-column--over {
    border-color: var(--c-indigo);
    background: var(--c-s2);
  }
  .crm-column-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .crm-column-header-left { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .crm-column-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .crm-column-name { font-size: 12px; font-weight: 600; color: var(--c-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .crm-column-count { font-size: 10px; font-weight: 600; color: var(--c-muted); background: var(--c-s2); border: 1px solid var(--c-border); border-radius: 20px; padding: 1px 6px; flex-shrink: 0; }
  .crm-column-add-btn {
    width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
    background: transparent; border: 1px solid transparent; color: var(--c-muted); cursor: pointer; flex-shrink: 0;
    transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
  }
  .crm-column-add-btn:hover { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.3); color: var(--c-indigo); }
  .crm-column-value { font-size: 11px; color: var(--c-green); font-weight: 600; margin: 0; padding: 0 2px; }
  .crm-column-cards { display: flex; flex-direction: column; gap: 6px; min-height: 48px; }
  .crm-column-empty { font-size: 11px; color: var(--c-muted); text-align: center; padding: 12px 0; font-style: italic; }
  .crm-deal-card {
    display: flex; align-items: flex-start; gap: 6px;
    background: var(--c-s2); border: 1px solid var(--c-border); border-radius: 8px;
    padding: 8px 10px 8px 6px; cursor: default;
    transition: border-color 150ms ease, box-shadow 150ms ease; position: relative;
  }
  .crm-deal-card:hover { border-color: var(--c-s3); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  .crm-deal-drag {
    flex-shrink: 0; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;
    margin-top: 2px; color: var(--c-muted); cursor: grab; background: transparent; border: none;
    border-radius: 4px; padding: 0; transition: color 150ms ease, background 150ms ease;
  }
  .crm-deal-drag:hover { color: var(--c-text); background: rgba(255,255,255,0.06); }
  .crm-deal-drag:active { cursor: grabbing; }
  .crm-deal-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .crm-deal-title { font-size: 12px; font-weight: 600; color: var(--c-text); line-height: 1.35; margin: 0; word-break: break-word; }
  .crm-deal-value { font-size: 13px; font-weight: 700; color: var(--c-green); margin: 0; }
  .crm-deal-contact { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--c-muted); overflow: hidden; white-space: nowrap; }
  .crm-deal-contact span { overflow: hidden; text-overflow: ellipsis; }
  .crm-deal-footer { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-top: 2px; }
  .crm-deal-date { font-size: 10px; color: var(--c-subtle); }
  .crm-deal-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 120ms ease; }
  .crm-deal-card:hover .crm-deal-actions { opacity: 1; }
  .crm-deal-btn {
    width: 22px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center;
    background: transparent; border: none; color: var(--c-muted); cursor: pointer; padding: 0;
    transition: color 120ms ease, background 120ms ease;
  }
  .crm-deal-btn:hover { color: var(--c-text); background: rgba(255,255,255,0.07); }
  .crm-deal-btn--danger:hover { color: #f87171; background: rgba(239,68,68,0.1); }
```

- [ ] **Step 4: Build check**

```bash
pnpm --filter @whatsagent/web build
```

Expected: `✔ Compiled successfully` with no TypeScript errors.

- [ ] **Step 5: Visual test**

```bash
pnpm dev
```

Navigate to `http://localhost:3000/crm`. Expected:
- Sidebar shows "CRM" item with Kanban icon
- Board loads with 7 default columns (auto-seeded)
- Stats bar shows R$ 0,00 / 0 open deals / 7 active stages
- "+ Novo negócio" button opens the DealFormModal
- Dragging a deal card to another column persists the move

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(dashboard)/crm/ apps/web/src/components/layout/Sidebar.tsx apps/web/src/app/globals.css
git commit -m "feat(web): add CRM page, Kanban CSS, and sidebar nav entry"
```

---

## Architectural Decisions

| Decision | Choice | Reason |
|---|---|---|
| IDs | `@default(uuid())` | Consistent with all other models in the schema |
| Stage seeding | Lazy on first `GET /crm/stages` | No extra migrations; auto-creates per tenant on first access |
| Delete stage with deals | `BadRequestException` | Prevents FK violations; forces user to move deals first |
| Move endpoint | `PATCH /crm/deals/:id/stage` | Correct REST semantics for partial update |
| Optimistic DnD | Update store before API + revert on error | Responsive UX without waiting for network round-trip |
| Pipeline value | Only stages with `isWon=false && isLost=false` | Real pipeline = deals still in negotiation |
| Column width | 260px fixed | Board horizontally scrollable; columns readable on all screen sizes |

---

## Verification

1. Run backend tests: `pnpm --filter @whatsagent/api test -- crm.service.spec.ts` → 14 tests pass
2. Run frontend build: `pnpm --filter @whatsagent/web build` → no TS errors
3. Start dev: `pnpm dev` and visit `http://localhost:3000/crm`
4. Create a deal → appears in the correct column
5. Drag card to another column → card moves, reloading the page confirms the change persisted
6. Edit a deal → modal pre-fills, save updates the card
7. Delete a deal → confirm dialog, card removed, stats update
8. Stats bar shows correct pipeline value (sum of deals in non-won/lost stages)
