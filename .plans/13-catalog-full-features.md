# Catalog Page — Full Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all pending catalog page features: real data fetching, product list (grid + list views), CRUD modals, search/filter, stats, and Excel bulk import with client-side template download.

**Architecture:** Backend gains three additions — fixed `UpdateProductDto` using `PartialType`, a stats endpoint, and a bulk import endpoint that accepts a JSON array. Frontend rewrites the catalog page skeleton into a fully functional page using the existing `useApi` hook, `Modal` component, and CSS classes from globals.css; product components are split into focused files under `components/catalog/`; Excel import uses SheetJS (`xlsx`) to generate a template and parse uploaded files client-side before POSTing JSON to the API.

**Tech Stack:** NestJS + Prisma (backend), Next.js 14 App Router (frontend), react-hook-form, SheetJS/xlsx, `useApi` hook (Clerk auth), `Modal` + `globals.css` design system

---

## File Map

**Create:**
- `apps/api/src/modules/products/dto/import-products.dto.ts`
- `apps/web/src/types/product.ts`
- `apps/web/src/components/catalog/ProductCard.tsx`
- `apps/web/src/components/catalog/ProductListRow.tsx`
- `apps/web/src/components/catalog/ProductFormModal.tsx`
- `apps/web/src/components/catalog/DeleteProductModal.tsx`
- `apps/web/src/components/catalog/ImportProductsModal.tsx`

**Modify:**
- `apps/api/src/modules/products/dto/update-product.dto.ts`
- `apps/api/src/modules/products/products.service.ts`
- `apps/api/src/modules/products/products.controller.ts`
- `apps/web/src/app/(dashboard)/catalog/page.tsx`
- `apps/web/src/app/globals.css`

---

## Task 1: Fix UpdateProductDto

**Files:**
- Modify: `apps/api/src/modules/products/dto/update-product.dto.ts`

Current code makes all fields required on PUT requests (extends CreateProductDto without PartialType).

- [ ] **Step 1: Replace update-product.dto.ts**

```typescript
// apps/api/src/modules/products/dto/update-product.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

- [ ] **Step 2: Verify @nestjs/mapped-types is already installed**

```bash
cat apps/api/package.json | grep mapped-types
```
Expected: `"@nestjs/mapped-types"` entry. If missing, run:
```bash
pnpm --filter @whatsagent/api add @nestjs/mapped-types
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/products/dto/update-product.dto.ts
git commit -m "fix(api): make UpdateProductDto fields optional via PartialType"
```

---

## Task 2: Add GET /products/stats endpoint

**Files:**
- Modify: `apps/api/src/modules/products/products.service.ts`
- Modify: `apps/api/src/modules/products/products.controller.ts`

- [ ] **Step 1: Add getStats method to service**

Open `apps/api/src/modules/products/products.service.ts` and add after the existing `findAll` method:

```typescript
async getStats(tenantId: string): Promise<{
  total: number;
  active: number;
  inactive: number;
  outOfStock: number;
}> {
  const [total, active, inactive, outOfStock] = await Promise.all([
    this.prisma.product.count({ where: { tenantId } }),
    this.prisma.product.count({ where: { tenantId, status: 'ACTIVE' } }),
    this.prisma.product.count({ where: { tenantId, status: 'INACTIVE' } }),
    this.prisma.product.count({ where: { tenantId, status: 'OUT_OF_STOCK' } }),
  ]);
  return { total, active, inactive, outOfStock };
}
```

- [ ] **Step 2: Add route to controller**

Open `apps/api/src/modules/products/products.controller.ts`. Add this route **before** `@Get(':id')` to prevent route collision:

```typescript
@Get('stats')
@UseGuards(ClerkAuthGuard)
getStats(@CurrentTenant() tenantId: string) {
  return this.productsService.getStats(tenantId);
}
```

(Import ClerkAuthGuard and CurrentTenant if not already imported — check existing imports in the file.)

- [ ] **Step 3: Test the endpoint manually**

Start the API: `pnpm --filter @whatsagent/api dev`

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3002/products/stats
```
Expected: `{"total":0,"active":0,"inactive":0,"outOfStock":0}` (or real counts if seeded)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/products/products.service.ts apps/api/src/modules/products/products.controller.ts
git commit -m "feat(api): add GET /products/stats endpoint"
```

---

## Task 3: Add POST /products/import endpoint

**Files:**
- Create: `apps/api/src/modules/products/dto/import-products.dto.ts`
- Modify: `apps/api/src/modules/products/products.service.ts`
- Modify: `apps/api/src/modules/products/products.controller.ts`

- [ ] **Step 1: Create the import DTO**

```typescript
// apps/api/src/modules/products/dto/import-products.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ImportProductItemDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsInt()
  @Min(0)
  priceCents: number;

  @IsInt()
  @Min(0)
  stockQty: number;

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}

export class ImportProductsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportProductItemDto)
  products: ImportProductItemDto[];
}
```

- [ ] **Step 2: Add bulkImport method to service**

Add after `getStats` in `apps/api/src/modules/products/products.service.ts`:

```typescript
async bulkImport(
  tenantId: string,
  items: ImportProductItemDto[],
): Promise<{ imported: number; errors: Array<{ row: number; message: string }> }> {
  const errors: Array<{ row: number; message: string }> = [];
  let imported = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      await this.prisma.product.create({
        data: {
          tenantId,
          name: item.name,
          description: item.description ?? null,
          sku: item.sku ?? null,
          priceCents: item.priceCents,
          stockQty: item.stockQty,
          tags: item.tags ?? [],
          status: 'ACTIVE',
          lowStockThreshold: 5,
          reservedQty: 0,
        },
      });
      imported++;
    } catch (err) {
      errors.push({ row: i + 2, message: (err as Error).message });
    }
  }

  return { imported, errors };
}
```

Also add the import at the top of the service file:
```typescript
import { ImportProductItemDto } from './dto/import-products.dto';
```

- [ ] **Step 3: Add route to controller**

Add to `apps/api/src/modules/products/products.controller.ts` (before the `@Post()` create route, or after stats):

```typescript
@Post('import')
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
bulkImport(
  @CurrentTenant() tenantId: string,
  @Body() dto: ImportProductsDto,
) {
  return this.productsService.bulkImport(tenantId, dto.products);
}
```

Add the import at the top:
```typescript
import { ImportProductsDto } from './dto/import-products.dto';
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/products/dto/import-products.dto.ts apps/api/src/modules/products/products.service.ts apps/api/src/modules/products/products.controller.ts
git commit -m "feat(api): add POST /products/import endpoint for bulk Excel import"
```

---

## Task 4: Create Product TypeScript types (frontend)

**Files:**
- Create: `apps/web/src/types/product.ts`

- [ ] **Step 1: Create the types file**

```typescript
// apps/web/src/types/product.ts
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK' | 'DISCONTINUED';

export interface Product {
  id: string;
  tenantId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  priceCents: number;
  comparePriceCents: number | null;
  stockQty: number;
  reservedQty: number;
  lowStockThreshold: number;
  status: ProductStatus;
  imageUrls: string[];
  tags: string[];
  isEmbedded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductsResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductStats {
  total: number;
  active: number;
  inactive: number;
  outOfStock: number;
}

export interface ImportProductItem {
  name: string;
  description?: string;
  sku?: string;
  priceCents: number;
  stockQty: number;
  tags?: string[];
}

export interface ImportResult {
  imported: number;
  errors: Array<{ row: number; message: string }>;
}

export const STATUS_LABEL: Record<ProductStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  OUT_OF_STOCK: 'Esgotado',
  DISCONTINUED: 'Descontinuado',
};

export const STATUS_COLOR: Record<ProductStatus, string> = {
  ACTIVE: '#22c55e',
  INACTIVE: '#94a3b8',
  OUT_OF_STOCK: '#f59e0b',
  DISCONTINUED: '#ef4444',
};

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/types/product.ts
git commit -m "feat(web): add Product TypeScript types"
```

---

## Task 5: Install xlsx library and add CSS for product components

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Install xlsx in the web app**

```bash
pnpm --filter @whatsagent/web add xlsx
```

- [ ] **Step 2: Add product component CSS to globals.css**

Append the following at the end of `apps/web/src/app/globals.css`:

```css
/* ── Product Card (grid view) ─────────────────────────── */
.product-card {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid var(--c-border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
  cursor: pointer;
}
.product-card:hover {
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.15);
}
.product-card-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.product-card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}
.product-card-body { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.product-card-name { font-size: 13px; font-weight: 600; color: #e2e8f0; line-height: 1.3; }
.product-card-sku { font-size: 10px; color: #64748b; font-family: monospace; }
.product-card-price { font-size: 14px; font-weight: 700; color: #22c55e; }
.product-card-compare { font-size: 11px; color: #64748b; text-decoration: line-through; margin-left: 4px; }
.product-card-stock { font-size: 11px; color: #94a3b8; }
.product-card-stock.low { color: #f59e0b; }
.product-card-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  width: fit-content;
}
.product-card-actions {
  display: flex;
  gap: 6px;
  margin-top: auto;
}
.product-card-btn {
  flex: 1;
  height: 28px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--c-border);
  background: transparent;
  color: #94a3b8;
  transition: background 0.15s, color 0.15s;
}
.product-card-btn:hover { background: rgba(99, 102, 241, 0.1); color: #818cf8; border-color: rgba(99, 102, 241, 0.3); }
.product-card-btn.danger:hover { background: rgba(239, 68, 68, 0.1); color: #f87171; border-color: rgba(239, 68, 68, 0.3); }

/* ── Product List Row ─────────────────────────────────── */
.product-list-row {
  display: grid;
  grid-template-columns: 40px 1fr 120px 100px 80px 100px 80px;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--c-border);
  transition: background 0.1s;
}
.product-list-row:hover { background: rgba(15, 23, 42, 0.5); }
.product-list-header {
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.product-list-thumb {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: rgba(30, 41, 59, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.product-list-thumb img { width: 100%; height: 100%; object-fit: cover; border-radius: 6px; }
.product-list-name { font-size: 13px; font-weight: 500; color: #e2e8f0; }
.product-list-sku { font-size: 10px; color: #64748b; font-family: monospace; margin-top: 2px; }
.product-list-actions { display: flex; gap: 4px; }
.product-list-action-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid var(--c-border);
  background: transparent;
  color: #64748b;
  transition: all 0.15s;
}
.product-list-action-btn:hover { background: rgba(99,102,241,0.1); color: #818cf8; border-color: rgba(99,102,241,0.3); }
.product-list-action-btn.danger:hover { background: rgba(239,68,68,0.1); color: #f87171; border-color: rgba(239,68,68,0.3); }

/* ── Catalog Grid ─────────────────────────────────────── */
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  padding: 20px;
}
.catalog-list-container { padding: 0 20px 20px; }
.catalog-list-table { width: 100%; border: 1px solid var(--c-border); border-radius: 10px; overflow: hidden; }

/* ── Catalog Pagination ───────────────────────────────── */
.catalog-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--c-border);
  font-size: 12px;
  color: #64748b;
}
.catalog-pagination-btns { display: flex; gap: 4px; }
.catalog-page-btn {
  height: 28px;
  min-width: 28px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--c-border);
  background: transparent;
  color: #94a3b8;
  transition: all 0.15s;
}
.catalog-page-btn:hover { background: rgba(99,102,241,0.1); color: #818cf8; }
.catalog-page-btn.active { background: rgba(99,102,241,0.15); color: #818cf8; border-color: rgba(99,102,241,0.4); }
.catalog-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Import Modal ─────────────────────────────────────── */
.import-drop-zone {
  border: 2px dashed var(--c-border);
  border-radius: 10px;
  padding: 32px 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.import-drop-zone:hover, .import-drop-zone.dragging {
  border-color: rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.05);
}
.import-drop-zone-icon { margin-bottom: 8px; color: #64748b; }
.import-drop-zone-title { font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 4px; }
.import-drop-zone-subtitle { font-size: 11px; color: #64748b; }
.import-file-selected {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(34, 197, 94, 0.07);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 8px;
  font-size: 12px;
  color: #86efac;
}
.import-result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
}
.import-result-row.success { background: rgba(34,197,94,0.07); color: #86efac; }
.import-result-row.error { background: rgba(239,68,68,0.07); color: #fca5a5; }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): install xlsx and add CSS for product catalog components"
```

---

## Task 6: Build ProductCard component (grid view)

**Files:**
- Create: `apps/web/src/components/catalog/ProductCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/src/components/catalog/ProductCard.tsx
"use client";

import { Package, Pencil, Trash2 } from "lucide-react";
import {
  formatPrice,
  Product,
  STATUS_COLOR,
  STATUS_LABEL,
} from "@/types/product";

interface Props {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}

export function ProductCard({ product, onEdit, onDelete }: Props) {
  const isLowStock =
    product.stockQty > 0 &&
    product.stockQty <= product.lowStockThreshold;

  return (
    <div className="product-card">
      <div className="product-card-image">
        {product.imageUrls[0] ? (
          <img src={product.imageUrls[0]} alt={product.name} />
        ) : (
          <Package className="w-8 h-8" style={{ color: "#334155" }} />
        )}
      </div>

      <div className="product-card-body">
        <div className="product-card-name">{product.name}</div>
        {product.sku && (
          <div className="product-card-sku">SKU: {product.sku}</div>
        )}

        <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
          <span className="product-card-price">
            {formatPrice(product.priceCents)}
          </span>
          {product.comparePriceCents && (
            <span className="product-card-compare">
              {formatPrice(product.comparePriceCents)}
            </span>
          )}
        </div>

        <div className={`product-card-stock${isLowStock ? " low" : ""}`}>
          {product.stockQty === 0
            ? "Sem estoque"
            : isLowStock
            ? `Estoque baixo: ${product.stockQty}`
            : `Estoque: ${product.stockQty}`}
        </div>

        <div
          className="product-card-status"
          style={{
            color: STATUS_COLOR[product.status],
            background: `${STATUS_COLOR[product.status]}18`,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: STATUS_COLOR[product.status],
              display: "inline-block",
            }}
          />
          {STATUS_LABEL[product.status]}
        </div>
      </div>

      <div className="product-card-actions">
        <button
          className="product-card-btn"
          onClick={() => onEdit(product)}
          title="Editar produto"
        >
          <Pencil className="w-3 h-3" style={{ display: "inline", marginRight: 4 }} />
          Editar
        </button>
        <button
          className="product-card-btn danger"
          onClick={() => onDelete(product)}
          title="Excluir produto"
        >
          <Trash2 className="w-3 h-3" style={{ display: "inline" }} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/catalog/ProductCard.tsx
git commit -m "feat(web): add ProductCard component for catalog grid view"
```

---

## Task 7: Build ProductListRow component (list view)

**Files:**
- Create: `apps/web/src/components/catalog/ProductListRow.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/src/components/catalog/ProductListRow.tsx
"use client";

import { Package, Pencil, Trash2 } from "lucide-react";
import {
  formatPrice,
  Product,
  STATUS_COLOR,
  STATUS_LABEL,
} from "@/types/product";

interface Props {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}

export function ProductListRow({ product, onEdit, onDelete }: Props) {
  const isLowStock =
    product.stockQty > 0 && product.stockQty <= product.lowStockThreshold;

  return (
    <div className="product-list-row">
      {/* Thumbnail */}
      <div className="product-list-thumb">
        {product.imageUrls[0] ? (
          <img src={product.imageUrls[0]} alt={product.name} />
        ) : (
          <Package className="w-4 h-4" style={{ color: "#475569" }} />
        )}
      </div>

      {/* Name + SKU */}
      <div>
        <div className="product-list-name">{product.name}</div>
        {product.sku && (
          <div className="product-list-sku">SKU: {product.sku}</div>
        )}
      </div>

      {/* Price */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
        {formatPrice(product.priceCents)}
      </div>

      {/* Stock */}
      <div
        style={{
          fontSize: 12,
          color: isLowStock ? "#f59e0b" : "#94a3b8",
        }}
      >
        {product.stockQty === 0
          ? "Esgotado"
          : isLowStock
          ? `${product.stockQty} (baixo)`
          : product.stockQty}
      </div>

      {/* Tags */}
      <div
        style={{
          fontSize: 10,
          color: "#64748b",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {product.tags.slice(0, 2).join(", ") || "—"}
      </div>

      {/* Status */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 10,
          fontWeight: 600,
          color: STATUS_COLOR[product.status],
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: STATUS_COLOR[product.status],
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        {STATUS_LABEL[product.status]}
      </div>

      {/* Actions */}
      <div className="product-list-actions">
        <button
          className="product-list-action-btn"
          onClick={() => onEdit(product)}
          title="Editar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          className="product-list-action-btn danger"
          onClick={() => onDelete(product)}
          title="Excluir"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/catalog/ProductListRow.tsx
git commit -m "feat(web): add ProductListRow component for catalog list view"
```

---

## Task 8: Build ProductFormModal (create + edit)

**Files:**
- Create: `apps/web/src/components/catalog/ProductFormModal.tsx`

The form covers: name, description, SKU, priceCents (display as R$ input), comparePriceCents, stockQty, lowStockThreshold, status, tags (comma-separated input).

- [ ] **Step 1: Create the component**

```typescript
// apps/web/src/components/catalog/ProductFormModal.tsx
"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Product } from "@/types/product";
import { useApi } from "@/lib/hooks/useApi";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product?: Product | null;
}

interface FormState {
  name: string;
  description: string;
  sku: string;
  priceReais: string;
  comparePriceReais: string;
  stockQty: string;
  lowStockThreshold: string;
  status: string;
  tags: string;
}

const EMPTY: FormState = {
  name: "",
  description: "",
  sku: "",
  priceReais: "",
  comparePriceReais: "",
  stockQty: "0",
  lowStockThreshold: "5",
  status: "ACTIVE",
  tags: "",
};

function productToForm(p: Product): FormState {
  return {
    name: p.name,
    description: p.description ?? "",
    sku: p.sku ?? "",
    priceReais: (p.priceCents / 100).toFixed(2),
    comparePriceReais: p.comparePriceCents
      ? (p.comparePriceCents / 100).toFixed(2)
      : "",
    stockQty: String(p.stockQty),
    lowStockThreshold: String(p.lowStockThreshold),
    status: p.status,
    tags: p.tags.join(", "),
  };
}

export function ProductFormModal({ open, onClose, onSaved, product }: Props) {
  const { apiFetch } = useApi();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!product;

  useEffect(() => {
    if (open) {
      setForm(product ? productToForm(product) : EMPTY);
      setError(null);
    }
  }, [open, product]);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const priceCents = Math.round(parseFloat(form.priceReais.replace(",", ".")) * 100);
    const comparePriceCents = form.comparePriceReais
      ? Math.round(parseFloat(form.comparePriceReais.replace(",", ".")) * 100)
      : null;

    if (isNaN(priceCents) || priceCents < 0) {
      setError("Preço inválido.");
      setSaving(false);
      return;
    }

    const body = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      sku: form.sku.trim() || undefined,
      priceCents,
      comparePriceCents: comparePriceCents ?? undefined,
      stockQty: parseInt(form.stockQty, 10) || 0,
      lowStockThreshold: parseInt(form.lowStockThreshold, 10) || 5,
      status: form.status,
      tags: form.tags
        ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
    };

    try {
      const res = await apiFetch(
        isEditing ? `/products/${product!.id}` : "/products",
        { method: isEditing ? "PUT" : "POST", body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Erro ao salvar produto.");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar produto" : "Novo produto"}
      subtitle={isEditing ? `Editando: ${product?.name}` : "Preencha os dados do produto"}
      size="lg"
      headerLeading={<Package className="w-5 h-5 text-indigo-400" />}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" type="button">
            Cancelar
          </button>
          <button
            form="product-form"
            type="submit"
            disabled={saving || !form.name.trim() || !form.priceReais}
            className="catalog-add-btn"
            style={{ minWidth: 120 }}
          >
            {saving ? "Salvando…" : isEditing ? "Salvar" : "Adicionar"}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit}>
        <div className="form-grid-2">
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Nome *</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex.: Camiseta Preta M"
              required
              maxLength={200}
            />
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Descrição</label>
            <textarea
              className="form-input"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Descrição do produto..."
              rows={3}
              maxLength={2000}
              style={{ resize: "vertical" }}
            />
          </div>

          <div className="form-field">
            <label className="form-label">SKU</label>
            <input
              className="form-input"
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
              placeholder="Ex.: CAM-001"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Status</label>
            <select
              className="form-input"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
              <option value="OUT_OF_STOCK">Esgotado</option>
              <option value="DISCONTINUED">Descontinuado</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Preço (R$) *</label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={form.priceReais}
              onChange={(e) => set("priceReais", e.target.value)}
              placeholder="0,00"
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Preço comparativo (R$)</label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={form.comparePriceReais}
              onChange={(e) => set("comparePriceReais", e.target.value)}
              placeholder="Preço de riscado"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Estoque *</label>
            <input
              className="form-input"
              type="number"
              min="0"
              value={form.stockQty}
              onChange={(e) => set("stockQty", e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Alerta de estoque baixo</label>
            <input
              className="form-input"
              type="number"
              min="0"
              value={form.lowStockThreshold}
              onChange={(e) => set("lowStockThreshold", e.target.value)}
            />
            <span className="form-hint">Notifica quando estoque atingir este valor</span>
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Tags</label>
            <input
              className="form-input"
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="roupas, masculino, algodão (separadas por vírgula)"
            />
            <span className="form-hint">Usadas pelo AI para recomendação de produtos</span>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#fca5a5", fontSize: 12 }}>
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
git add apps/web/src/components/catalog/ProductFormModal.tsx
git commit -m "feat(web): add ProductFormModal for create/edit products"
```

---

## Task 9: Build DeleteProductModal

**Files:**
- Create: `apps/web/src/components/catalog/DeleteProductModal.tsx`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/src/components/catalog/DeleteProductModal.tsx
"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Product } from "@/types/product";
import { useApi } from "@/lib/hooks/useApi";

interface Props {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  product: Product | null;
}

export function DeleteProductModal({ open, onClose, onDeleted, product }: Props) {
  const { apiFetch } = useApi();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!product) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await apiFetch(`/products/${product.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir produto.");
      onDeleted();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Excluir produto"
      subtitle="Esta ação não pode ser desfeita"
      size="sm"
      headerLeading={<Trash2 className="w-5 h-5 text-red-400" />}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" type="button">
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ height: 34, padding: "0 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}
          >
            {deleting ? "Excluindo…" : "Excluir"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
        Tem certeza que deseja excluir{" "}
        <strong style={{ color: "#e2e8f0" }}>{product?.name}</strong>?
        Todos os dados do produto serão removidos permanentemente.
      </p>
      {error && (
        <p style={{ marginTop: 10, fontSize: 12, color: "#f87171" }}>{error}</p>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/catalog/DeleteProductModal.tsx
git commit -m "feat(web): add DeleteProductModal component"
```

---

## Task 10: Build ImportProductsModal with Excel template

**Files:**
- Create: `apps/web/src/components/catalog/ImportProductsModal.tsx`

The modal has two actions: "Baixar Template" (generates Excel client-side) and file upload (parse Excel → POST JSON to API).

Template columns: `nome*`, `descricao`, `sku`, `preco_centavos*`, `estoque*`, `tags`

- [ ] **Step 1: Create the component**

```typescript
// apps/web/src/components/catalog/ImportProductsModal.tsx
"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { ImportProductItem, ImportResult } from "@/types/product";
import { useApi } from "@/lib/hooks/useApi";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

function downloadTemplate() {
  const header = ["nome*", "descricao", "sku", "preco_centavos*", "estoque*", "tags"];
  const example = ["Camiseta Preta M", "Camiseta 100% algodão", "CAM-001", 4990, 50, "roupas|masculino"];
  const ws = XLSX.utils.aoa_to_sheet([header, example]);

  // Column widths
  ws["!cols"] = [{ wch: 30 }, { wch: 40 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 30 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");
  XLSX.writeFile(wb, "template-importacao-produtos.xlsx");
}

function parseSheet(file: File): Promise<ImportProductItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        const items: ImportProductItem[] = rows.map((row, i) => {
          const name = String(row["nome*"] ?? row["nome"] ?? "").trim();
          const priceCents = parseInt(String(row["preco_centavos*"] ?? row["preco_centavos"] ?? "0"), 10);
          const stockQty = parseInt(String(row["estoque*"] ?? row["estoque"] ?? "0"), 10);

          if (!name) throw new Error(`Linha ${i + 2}: campo "nome*" é obrigatório.`);
          if (isNaN(priceCents)) throw new Error(`Linha ${i + 2}: "preco_centavos*" deve ser um número.`);
          if (isNaN(stockQty)) throw new Error(`Linha ${i + 2}: "estoque*" deve ser um número.`);

          const tagsRaw = String(row["tags"] ?? "").trim();
          const tags = tagsRaw
            ? tagsRaw.split("|").map((t) => t.trim()).filter(Boolean)
            : undefined;

          return {
            name,
            description: String(row["descricao"] ?? "").trim() || undefined,
            sku: String(row["sku"] ?? "").trim() || undefined,
            priceCents,
            stockQty,
            tags,
          };
        });

        resolve(items);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}

export function ImportProductsModal({ open, onClose, onImported }: Props) {
  const { apiFetch } = useApi();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFileChange(f: File | null) {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      setParseError("Arquivo inválido. Use .xlsx, .xls ou .csv.");
      return;
    }
    setFile(f);
    setParseError(null);
    setResult(null);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setParseError(null);
    setResult(null);

    try {
      const products = await parseSheet(file);
      if (products.length === 0) {
        setParseError("Nenhum produto encontrado na planilha.");
        return;
      }

      const res = await apiFetch("/products/import", {
        method: "POST",
        body: JSON.stringify({ products }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Erro ao importar produtos.");
      }

      const data: ImportResult = await res.json();
      setResult(data);
      if (data.imported > 0) onImported();
    } catch (err) {
      setParseError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setFile(null);
    setParseError(null);
    setResult(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar produtos"
      subtitle="Importe vários produtos de uma vez via planilha Excel"
      size="md"
      headerLeading={<FileSpreadsheet className="w-5 h-5 text-green-400" />}
      footer={
        <>
          <button
            onClick={handleClose}
            className="btn-ghost"
            type="button"
          >
            {result ? "Fechar" : "Cancelar"}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="catalog-add-btn"
              style={{ minWidth: 120 }}
            >
              {importing ? "Importando…" : "Importar"}
            </button>
          )}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Template download */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Template Excel</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Baixe o modelo com as colunas corretas</div>
          </div>
          <button
            onClick={downloadTemplate}
            style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "rgba(99,102,241,0.12)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)", cursor: "pointer" }}
          >
            <Download className="w-3.5 h-3.5" />
            Baixar template
          </button>
        </div>

        {/* Drop zone */}
        {!result && (
          <>
            <div
              className={`import-drop-zone${dragging ? " dragging" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFileChange(e.dataTransfer.files[0] ?? null);
              }}
            >
              <div className="import-drop-zone-icon">
                <Upload className="w-8 h-8" style={{ margin: "0 auto" }} />
              </div>
              <div className="import-drop-zone-title">
                Arraste a planilha ou clique para selecionar
              </div>
              <div className="import-drop-zone-subtitle">
                Formatos suportados: .xlsx, .xls, .csv
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </div>

            {file && !parseError && (
              <div className="import-file-selected">
                <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 0 }}>×</button>
              </div>
            )}
          </>
        )}

        {parseError && (
          <div className="import-result-row error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {parseError}
          </div>
        )}

        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="import-result-row success">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {result.imported} produto{result.imported !== 1 ? "s" : ""} importado{result.imported !== 1 ? "s" : ""} com sucesso!
            </div>
            {result.errors.map((e) => (
              <div key={e.row} className="import-result-row error">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Linha {e.row}: {e.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/catalog/ImportProductsModal.tsx
git commit -m "feat(web): add ImportProductsModal with Excel template download and bulk import"
```

---

## Task 11: Rewrite catalog/page.tsx — wire everything together

**Files:**
- Modify: `apps/web/src/app/(dashboard)/catalog/page.tsx`

This task replaces the skeleton with a fully functional page that:
- Fetches stats and product list from the API
- Debounces search input (300ms)
- Wires filter tabs (all / active / inactive / out_of_stock)
- Renders grid or list view
- Opens create, edit, delete, import modals

- [ ] **Step 1: Rewrite catalog/page.tsx**

```typescript
// apps/web/src/app/(dashboard)/catalog/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eye,
  FileSpreadsheet,
  Grid3X3,
  List,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  TrendingUp,
} from "lucide-react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductListRow } from "@/components/catalog/ProductListRow";
import { ProductFormModal } from "@/components/catalog/ProductFormModal";
import { DeleteProductModal } from "@/components/catalog/DeleteProductModal";
import { ImportProductsModal } from "@/components/catalog/ImportProductsModal";
import { useApi } from "@/lib/hooks/useApi";
import {
  Product,
  ProductStats,
  ProductsResponse,
  ProductStatus,
} from "@/types/product";

type ViewMode = "grid" | "list";
type FilterTab = "all" | "active" | "inactive" | "out_of_stock";

const STATUS_MAP: Record<FilterTab, ProductStatus | undefined> = {
  all: undefined,
  active: "ACTIVE",
  inactive: "INACTIVE",
  out_of_stock: "OUT_OF_STOCK",
};

const PAGE_SIZE = 20;

export default function CatalogPage() {
  const { apiFetch } = useApi();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Data state
  const [stats, setStats] = useState<ProductStats>({ total: 0, active: 0, inactive: 0, outOfStock: 0 });
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Debounced search ref
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch stats ────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await apiFetch("/products/stats");
      if (res.ok) setStats(await res.json());
    } finally {
      setLoadingStats(false);
    }
  }, [apiFetch]);

  // ── Fetch products ─────────────────────────────────────
  const loadProducts = useCallback(
    async (p: number, q: string, tab: FilterTab) => {
      setLoadingProducts(true);
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: String(PAGE_SIZE),
        });
        if (q.trim()) params.set("search", q.trim());
        const status = STATUS_MAP[tab];
        if (status) params.set("status", status);

        const res = await apiFetch(`/products?${params}`);
        if (res.ok) {
          const data: ProductsResponse = await res.json();
          setProducts(data.items);
          setTotal(data.total);
        }
      } finally {
        setLoadingProducts(false);
      }
    },
    [apiFetch]
  );

  // Initial load
  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadProducts(page, search, filterTab);
  }, [page, filterTab, loadProducts]); // search is handled via debounce below

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      void loadProducts(1, value, filterTab);
    }, 300);
  }

  function handleTabChange(tab: FilterTab) {
    setFilterTab(tab);
    setPage(1);
  }

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Refresh after mutations ─────────────────────────────
  function onSaved() {
    void loadStats();
    void loadProducts(page, search, filterTab);
    setToast({ type: "success", msg: "Produto salvo com sucesso!" });
  }

  function onDeleted() {
    void loadStats();
    void loadProducts(page, search, filterTab);
    setToast({ type: "success", msg: "Produto excluído." });
  }

  function onImported() {
    void loadStats();
    void loadProducts(1, "", "all");
    setSearch("");
    setFilterTab("all");
    setPage(1);
  }

  // ── Edit handler ──────────────────────────────────────
  function openEdit(p: Product) {
    setEditProduct(p);
    setFormOpen(true);
  }

  function openDelete(p: Product) {
    setDeleteProduct(p);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Stats cards config ────────────────────────────────
  const STATS_CARDS = [
    { label: "Total de produtos", value: loadingStats ? "…" : stats.total, icon: Package, color: "#6366f1" },
    { label: "Produtos ativos", value: loadingStats ? "…" : stats.active, icon: TrendingUp, color: "#22c55e" },
    { label: "Inativos / Esgotados", value: loadingStats ? "…" : stats.inactive + stats.outOfStock, icon: Tag, color: "#f59e0b" },
    { label: "Visualizações IA", value: "—", icon: Eye, color: "#06b6d4" },
  ];

  return (
    <div className="catalog-page">
      {/* Hero */}
      <div className="catalog-hero">
        <div className="catalog-hero-icon">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <div className="catalog-hero-badge">Catálogo inteligente</div>
          <h1 className="catalog-hero-title">Catálogo de Produtos</h1>
          <p className="catalog-hero-subtitle">
            Gerencie seus produtos e deixe o AI recomendar para os clientes
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => setImportOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, background: "rgba(34,197,94,0.08)", color: "#86efac", border: "1px solid rgba(34,197,94,0.2)", cursor: "pointer" }}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importar
          </button>
          <button
            onClick={() => { setEditProduct(null); setFormOpen(true); }}
            className="catalog-add-btn"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Plus className="w-4 h-4" />
            Adicionar produto
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="catalog-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, padding: "0 20px 20px" }}>
        {STATS_CARDS.map((s) => (
          <div key={s.label} className="catalog-stat-card" style={{ background: "rgba(15,23,42,0.8)", border: "1px solid var(--c-border)", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>{String(s.value)}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="catalog-toolbar" style={{ padding: "0 20px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {/* Search */}
        <div className="catalog-search-wrap" style={{ flex: "1 1 220px" }}>
          <Search className="w-3.5 h-3.5" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
          <input
            className="catalog-search-input"
            placeholder="Buscar por nome, SKU..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>

        {/* Filter tabs */}
        <div className="catalog-filter-tabs">
          {(["all", "active", "inactive", "out_of_stock"] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              className={`inbox-tab${filterTab === tab ? " active" : ""}`}
              onClick={() => handleTabChange(tab)}
            >
              {{ all: "Todos", active: "Ativos", inactive: "Inativos", out_of_stock: "Esgotados" }[tab]}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="catalog-view-toggle">
          <button
            className={`inbox-filter-btn${viewMode === "grid" ? " active" : ""}`}
            onClick={() => setViewMode("grid")}
            title="Grade"
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>
          <button
            className={`inbox-filter-btn${viewMode === "list" ? " active" : ""}`}
            onClick={() => setViewMode("list")}
            title="Lista"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        <button className="inbox-filter-btn" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros
        </button>
      </div>

      {/* Content */}
      <div className="catalog-panel">
        {loadingProducts ? (
          <div className="catalog-empty">
            <div style={{ fontSize: 12, color: "#64748b" }}>Carregando produtos…</div>
          </div>
        ) : products.length === 0 ? (
          <div className="catalog-empty">
            <div className="catalog-empty-icon">
              <Package className="w-6 h-6" style={{ color: "#475569" }} />
            </div>
            <div className="catalog-empty-title">
              {search || filterTab !== "all"
                ? "Nenhum produto encontrado"
                : "Nenhum produto cadastrado"}
            </div>
            <div className="catalog-empty-sub">
              {search || filterTab !== "all"
                ? "Tente outros termos ou limpe os filtros"
                : "Adicione produtos ou importe uma planilha"}
            </div>
            {!search && filterTab === "all" && (
              <button
                className="catalog-add-btn"
                onClick={() => { setEditProduct(null); setFormOpen(true); }}
                style={{ marginTop: 12 }}
              >
                <Plus className="w-4 h-4" style={{ display: "inline", marginRight: 6 }} />
                Adicionar primeiro produto
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="catalog-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onEdit={openEdit} onDelete={openDelete} />
            ))}
          </div>
        ) : (
          <div className="catalog-list-container">
            <div className="catalog-list-table">
              <div className="product-list-row product-list-header">
                <div />
                <div>Produto</div>
                <div>Preço</div>
                <div>Estoque</div>
                <div>Tags</div>
                <div>Status</div>
                <div>Ações</div>
              </div>
              {products.map((p) => (
                <ProductListRow key={p.id} product={p} onEdit={openEdit} onDelete={openDelete} />
              ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="catalog-pagination">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total} produtos
            </span>
            <div className="catalog-pagination-btns">
              <button
                className="catalog-page-btn"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    className={`catalog-page-btn${page === p ? " active" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                className="catalog-page-btn"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ProductFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditProduct(null); }}
        onSaved={onSaved}
        product={editProduct}
      />
      <DeleteProductModal
        open={!!deleteProduct}
        onClose={() => setDeleteProduct(null)}
        onDeleted={onDeleted}
        product={deleteProduct}
      />
      <ImportProductsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={onImported}
      />

      {/* Toast */}
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

- [ ] **Step 2: Run type check**

```bash
pnpm --filter @whatsagent/web lint
```

Expected: no errors related to the new files. Fix any type errors before committing.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/catalog/page.tsx
git commit -m "feat(web): rewrite catalog page with full product list, CRUD, search/filter, and import"
```

---

## Verification

- [ ] Start all services: `pnpm docker:up && pnpm dev`
- [ ] Open http://localhost:3000/catalog
  - Stats cards show 0 (or real values if seeded)
  - Empty state with "Adicionar primeiro produto" button
- [ ] Click "Adicionar produto" → modal opens with form fields
  - Fill in name + preço → click Adicionar → product appears in grid
  - Stats update to show 1 total, 1 active
- [ ] Click Edit on a product → form pre-filled → save → list updates
- [ ] Click Delete on a product → confirmation modal → confirm → product removed
- [ ] Search for a product name → list filters in real time (300ms debounce)
- [ ] Toggle filter tabs (Ativos / Inativos / Esgotados) → list updates
- [ ] Switch grid/list view → layout changes
- [ ] Click "Importar" → modal opens
  - Click "Baixar template" → `template-importacao-produtos.xlsx` downloads
  - Upload the template (with data filled) → import result shows success count
  - After import, product list refreshes
- [ ] Verify PUT endpoint now works with partial data (Task 1 fix)
  - `curl -X PUT /products/:id -d '{"name":"Updated"}' -H "Authorization: Bearer ..."` returns 200
