# Advanced Product Filter (Catalog) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an advanced filter panel on the catalog page that allows filtering by price range, stock level, category, and sorting — connecting the currently non-functional `SlidersHorizontal` button.

**Architecture:** Extend the backend `ListProductsDto` to accept new filter params (price range, min stock, sort), add a simple `GET /categories` endpoint, then build a slide-out `AdvancedFilterPanel` (shadcn/ui Sheet) on the frontend that wires into the existing catalog fetch loop via local React state.

**Tech Stack:** NestJS (API), class-validator DTOs, Prisma, Next.js 14 App Router, shadcn/ui Sheet, Tailwind CSS v4, TypeScript.

---

## Context

The catalog page (`apps/web/src/app/(dashboard)/catalog/page.tsx`) already has a `SlidersHorizontal` button (line ~308) with no `onClick` handler — it's a visual placeholder. The backend (`GET /products`) already accepts `search`, `status`, `categoryId`, `page`, `limit` but has no support for price range, stock, or sorting. The Prisma `Product` model has `priceCents`, `stockQty`, `tags[]`, and `categoryId` fields ready to filter on. There is also a `Category` model in the schema but no REST endpoint to list categories.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `apps/api/src/modules/products/dto/create-product.dto.ts` |
| Modify | `apps/api/src/modules/products/products.service.ts` |
| Create | `apps/api/src/modules/categories/categories.controller.ts` |
| Create | `apps/api/src/modules/categories/categories.service.ts` |
| Create | `apps/api/src/modules/categories/categories.module.ts` |
| Modify | `apps/api/src/app.module.ts` |
| Modify | `apps/web/src/types/product.ts` |
| Create | `apps/web/src/components/catalog/AdvancedFilterPanel.tsx` |
| Modify | `apps/web/src/app/(dashboard)/catalog/page.tsx` |

---

## Task 1: Backend — Extend ListProductsDto

**Files:**
- Modify: `apps/api/src/modules/products/dto/create-product.dto.ts`

- [ ] **Step 1: Add new filter fields to ListProductsDto**

Open `apps/api/src/modules/products/dto/create-product.dto.ts` and replace the existing `ListProductsDto` class with:

```typescript
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
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  minPriceCents?: number;

  @IsOptional()
  @Type(() => Number)
  maxPriceCents?: number;

  @IsOptional()
  @Type(() => Number)
  minStock?: number;

  @IsOptional()
  @IsString()
  sortBy?: "name" | "priceCents" | "stockQty" | "createdAt";

  @IsOptional()
  @IsString()
  sortOrder?: "asc" | "desc";
}
```

Make sure `Type` is imported from `class-transformer` (should already be there).

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/products/dto/create-product.dto.ts
git commit -m "feat(api): extend ListProductsDto with price range, stock and sort filters"
```

---

## Task 2: Backend — Apply New Filters in Service

**Files:**
- Modify: `apps/api/src/modules/products/products.service.ts`

- [ ] **Step 1: Update findAll to apply new filters**

Find the `findAll` method in `products.service.ts` and replace the `where` construction and `orderBy` with:

```typescript
async findAll(tenantId: string, query: ListProductsDto) {
  const {
    page = 1,
    limit = 20,
    search,
    status,
    categoryId,
    minPriceCents,
    maxPriceCents,
    minStock,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;
  const skip = (page - 1) * limit;

  const where: any = {
    tenantId,
    ...(status && { status }),
    ...(categoryId && { categoryId }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...((minPriceCents !== undefined || maxPriceCents !== undefined) && {
      priceCents: {
        ...(minPriceCents !== undefined && { gte: minPriceCents }),
        ...(maxPriceCents !== undefined && { lte: maxPriceCents }),
      },
    }),
    ...(minStock !== undefined && { stockQty: { gte: minStock } }),
  };

  const [items, total] = await Promise.all([
    this.prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    this.prisma.product.count({ where }),
  ]);

  return { items, total, page, totalPages: Math.ceil(total / limit) };
}
```

- [ ] **Step 2: Run backend tests to confirm nothing broke**

```bash
pnpm --filter @whatsagent/api test
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/products/products.service.ts
git commit -m "feat(api): apply price range, stock and sort filters in products.service"
```

---

## Task 3: Backend — GET /categories Endpoint

**Files:**
- Create: `apps/api/src/modules/categories/categories.service.ts`
- Create: `apps/api/src/modules/categories/categories.controller.ts`
- Create: `apps/api/src/modules/categories/categories.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create CategoriesService**

Create `apps/api/src/modules/categories/categories.service.ts`:

```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, parentId: true },
    });
  }
}
```

> Note: check the exact import path for `PrismaService` by looking at how other services (e.g. `products.service.ts`) import it — use the same path.

- [ ] **Step 2: Create CategoriesController**

Create `apps/api/src/modules/categories/categories.controller.ts`:

```typescript
import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CategoriesService } from "./categories.service";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";

@Controller("categories")
@UseGuards(AuthGuard("jwt"))
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.categoriesService.findAll(tenantId);
  }
}
```

> Note: check the exact path for `AuthGuard`, `CurrentTenant` decorator by looking at how `products.controller.ts` imports them — use the same paths.

- [ ] **Step 3: Create CategoriesModule**

Create `apps/api/src/modules/categories/categories.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { PrismaModule } from "../../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
```

> Note: check the import path for `PrismaModule` by looking at any existing module (e.g. `products.module.ts`) and use the same path.

- [ ] **Step 4: Register in AppModule**

Open `apps/api/src/app.module.ts`, add `CategoriesModule` to the imports array:

```typescript
import { CategoriesModule } from "./modules/categories/categories.module";

// in @Module({ imports: [...] })
CategoriesModule,
```

- [ ] **Step 5: Start API and manually test**

```bash
pnpm --filter @whatsagent/api dev
```

Then in a new terminal:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3002/categories
```

Expected: JSON array of categories (empty array `[]` is fine if no categories seeded).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/categories/ apps/api/src/app.module.ts
git commit -m "feat(api): add GET /categories endpoint for advanced filter"
```

---

## Task 4: Frontend — Add AdvancedFilters Type

**Files:**
- Modify: `apps/web/src/types/product.ts`

- [ ] **Step 1: Add AdvancedFilters interface and Category type**

Append to `apps/web/src/types/product.ts`:

```typescript
export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export interface AdvancedFilters {
  minPriceCents?: number;
  maxPriceCents?: number;
  minStock?: number;
  categoryId?: string;
  sortBy?: "name" | "priceCents" | "stockQty" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export const SORT_OPTIONS: { value: AdvancedFilters["sortBy"]; label: string }[] = [
  { value: "createdAt", label: "Data de criação" },
  { value: "name", label: "Nome" },
  { value: "priceCents", label: "Preço" },
  { value: "stockQty", label: "Estoque" },
];

export const DEFAULT_ADVANCED_FILTERS: AdvancedFilters = {
  sortBy: "createdAt",
  sortOrder: "desc",
};

export function countActiveFilters(filters: AdvancedFilters): number {
  let count = 0;
  if (filters.minPriceCents !== undefined) count++;
  if (filters.maxPriceCents !== undefined) count++;
  if (filters.minStock !== undefined) count++;
  if (filters.categoryId) count++;
  if (filters.sortBy && filters.sortBy !== "createdAt") count++;
  if (filters.sortOrder && filters.sortOrder !== "desc") count++;
  return count;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/types/product.ts
git commit -m "feat(web): add AdvancedFilters type and helpers to product types"
```

---

## Task 5: Frontend — AdvancedFilterPanel Component

**Files:**
- Create: `apps/web/src/components/catalog/AdvancedFilterPanel.tsx`

- [ ] **Step 1: Check if Sheet is available in the project**

```bash
ls apps/web/src/components/ui/ | grep -i sheet
```

If `sheet.tsx` is not present, add it:
```bash
cd apps/web && pnpm dlx shadcn@latest add sheet
```

- [ ] **Step 2: Create the AdvancedFilterPanel component**

Create `apps/web/src/components/catalog/AdvancedFilterPanel.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AdvancedFilters,
  Category,
  SORT_OPTIONS,
  DEFAULT_ADVANCED_FILTERS,
} from "@/types/product";

interface AdvancedFilterPanelProps {
  open: boolean;
  onClose: () => void;
  filters: AdvancedFilters;
  categories: Category[];
  onApply: (filters: AdvancedFilters) => void;
}

export function AdvancedFilterPanel({
  open,
  onClose,
  filters,
  categories,
  onApply,
}: AdvancedFilterPanelProps) {
  const [local, setLocal] = useState<AdvancedFilters>(filters);

  useEffect(() => {
    setLocal(filters);
  }, [filters, open]);

  function handleApply() {
    onApply(local);
    onClose();
  }

  function handleClear() {
    const cleared = { ...DEFAULT_ADVANCED_FILTERS };
    setLocal(cleared);
    onApply(cleared);
    onClose();
  }

  function setField<K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function parseCents(brl: string): number | undefined {
    const n = parseFloat(brl.replace(",", "."));
    return isNaN(n) ? undefined : Math.round(n * 100);
  }

  function centsToDisplay(cents?: number): string {
    if (cents === undefined) return "";
    return (cents / 100).toFixed(2).replace(".", ",");
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-80 bg-slate-900 border-slate-800 flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-white">Filtros avançados</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Price range */}
          <div className="space-y-3">
            <Label className="text-slate-300 text-sm font-medium">Faixa de preço (R$)</Label>
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Mín"
                className="bg-slate-800 border-slate-700 text-white"
                value={centsToDisplay(local.minPriceCents)}
                onChange={(e) => setField("minPriceCents", parseCents(e.target.value))}
              />
              <span className="text-slate-500 text-xs">até</span>
              <Input
                placeholder="Máx"
                className="bg-slate-800 border-slate-700 text-white"
                value={centsToDisplay(local.maxPriceCents)}
                onChange={(e) => setField("maxPriceCents", parseCents(e.target.value))}
              />
            </div>
          </div>

          {/* Min stock */}
          <div className="space-y-3">
            <Label className="text-slate-300 text-sm font-medium">Estoque mínimo</Label>
            <Input
              type="number"
              placeholder="Ex: 5"
              className="bg-slate-800 border-slate-700 text-white"
              min={0}
              value={local.minStock ?? ""}
              onChange={(e) =>
                setField(
                  "minStock",
                  e.target.value === "" ? undefined : parseInt(e.target.value, 10),
                )
              }
            />
          </div>

          {/* Category */}
          {categories.length > 0 && (
            <div className="space-y-3">
              <Label className="text-slate-300 text-sm font-medium">Categoria</Label>
              <Select
                value={local.categoryId ?? "all"}
                onValueChange={(v) => setField("categoryId", v === "all" ? undefined : v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-slate-300">
                    Todas as categorias
                  </SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} className="text-slate-300">
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Sort */}
          <div className="space-y-3">
            <Label className="text-slate-300 text-sm font-medium">Ordenar por</Label>
            <Select
              value={local.sortBy ?? "createdAt"}
              onValueChange={(v) => setField("sortBy", v as AdvancedFilters["sortBy"])}
            >
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value!} className="text-slate-300">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort order */}
          <div className="space-y-3">
            <Label className="text-slate-300 text-sm font-medium">Ordem</Label>
            <Select
              value={local.sortOrder ?? "desc"}
              onValueChange={(v) => setField("sortOrder", v as "asc" | "desc")}
            >
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="desc" className="text-slate-300">
                  Decrescente
                </SelectItem>
                <SelectItem value="asc" className="text-slate-300">
                  Crescente
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="flex gap-2 pt-4 border-t border-slate-800">
          <Button
            variant="ghost"
            className="flex-1 text-slate-400 hover:text-white"
            onClick={handleClear}
          >
            Limpar filtros
          </Button>
          <Button
            className="flex-1 bg-green-500 hover:bg-green-400 text-black font-semibold"
            onClick={handleApply}
          >
            Aplicar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/catalog/AdvancedFilterPanel.tsx
git commit -m "feat(web): add AdvancedFilterPanel slide-out component"
```

---

## Task 6: Frontend — Wire Catalog Page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/catalog/page.tsx`

This task has several sub-steps. Read the full catalog page file before starting — there are ~350+ lines.

- [ ] **Step 1: Add new imports at the top of catalog/page.tsx**

Add after the existing imports:

```typescript
import { AdvancedFilterPanel } from "@/components/catalog/AdvancedFilterPanel";
import {
  AdvancedFilters,
  Category,
  DEFAULT_ADVANCED_FILTERS,
  countActiveFilters,
} from "@/types/product";
```

- [ ] **Step 2: Add new state variables**

Inside the component, after the existing `const [page, setPage] = useState(1);` line, add:

```typescript
const [advFilters, setAdvFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED_FILTERS);
const [filterPanelOpen, setFilterPanelOpen] = useState(false);
const [categories, setCategories] = useState<Category[]>([]);
```

- [ ] **Step 3: Fetch categories on mount**

After the existing `useEffect` that fetches stats (or product data), add a new `useEffect`:

```typescript
useEffect(() => {
  async function loadCategories() {
    try {
      const res = await apiFetch("/categories");
      if (res.ok) {
        const data: Category[] = await res.json();
        setCategories(data);
      }
    } catch {
      // categories are optional — fail silently
    }
  }
  loadCategories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 4: Update the fetchProducts function to include advanced filters**

Find the `fetchProducts` (or equivalent) function that builds the query string for `GET /products`. It currently builds something like:

```typescript
const params = new URLSearchParams({
  page: String(page),
  limit: "20",
  ...(debouncedSearch && { search: debouncedSearch }),
  ...(STATUS_MAP[filterTab] && { status: STATUS_MAP[filterTab]! }),
});
```

Replace / extend it to also include the advanced filter params:

```typescript
const params = new URLSearchParams({
  page: String(page),
  limit: "20",
  ...(debouncedSearch && { search: debouncedSearch }),
  ...(STATUS_MAP[filterTab] && { status: STATUS_MAP[filterTab]! }),
  ...(advFilters.minPriceCents !== undefined && {
    minPriceCents: String(advFilters.minPriceCents),
  }),
  ...(advFilters.maxPriceCents !== undefined && {
    maxPriceCents: String(advFilters.maxPriceCents),
  }),
  ...(advFilters.minStock !== undefined && { minStock: String(advFilters.minStock) }),
  ...(advFilters.categoryId && { categoryId: advFilters.categoryId }),
  ...(advFilters.sortBy && { sortBy: advFilters.sortBy }),
  ...(advFilters.sortOrder && { sortOrder: advFilters.sortOrder }),
});
```

Also add `advFilters` to the dependency array of the `useEffect`/`useCallback` that calls `fetchProducts`.

- [ ] **Step 5: Reset page when advanced filters change**

Find where `setPage(1)` is called when search changes. Add the same reset for advanced filter changes:

```typescript
useEffect(() => {
  setPage(1);
}, [advFilters]);
```

- [ ] **Step 6: Wire the SlidersHorizontal button**

Find the non-functional SlidersHorizontal button (around line 308 of the original file). It looks like:

```tsx
<Button variant="outline" size="icon" ...>
  <SlidersHorizontal className="w-5 h-5" />
</Button>
```

Replace it with:

```tsx
<Button
  variant="outline"
  size="icon"
  className="relative border-slate-700 hover:border-slate-500 bg-slate-800/50"
  onClick={() => setFilterPanelOpen(true)}
>
  <SlidersHorizontal className="w-5 h-5" />
  {countActiveFilters(advFilters) > 0 && (
    <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
      {countActiveFilters(advFilters)}
    </span>
  )}
</Button>
```

- [ ] **Step 7: Render AdvancedFilterPanel at the bottom of the JSX**

Before the closing `</div>` (or `</>`) of the component's return, add:

```tsx
<AdvancedFilterPanel
  open={filterPanelOpen}
  onClose={() => setFilterPanelOpen(false)}
  filters={advFilters}
  categories={categories}
  onApply={setAdvFilters}
/>
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/(dashboard)/catalog/page.tsx
git commit -m "feat(web): wire advanced filter panel to catalog page"
```

---

## Verification

1. **Start the stack:**
   ```bash
   pnpm docker:up   # ensure PostgreSQL is running
   pnpm --filter @whatsagent/api dev     # port 3002
   pnpm --filter @whatsagent/web dev     # port 3000
   ```

2. **Open** `http://localhost:3000/catalog`

3. **Confirm the SlidersHorizontal button** is clickable and opens a slide-out panel from the right.

4. **Test price range:** Enter a min/max price, click Aplicar — the product list should update. Confirm the badge shows `1` ou `2` on the filter button.

5. **Test min stock:** Enter `1` — only products with stock ≥ 1 should appear.

6. **Test sort:** Select "Preço" + "Crescente" — cheapest products appear first.

7. **Test Limpar filtros:** All filters cleared, badge disappears, list resets to default order.

8. **Test combined filters:** Status tab "Ativos" + price range — both filters applied simultaneously.

9. **Run backend tests:**
   ```bash
   pnpm --filter @whatsagent/api test
   ```
   All tests should pass.
