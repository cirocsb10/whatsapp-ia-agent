export type ProductStatus = "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK" | "DISCONTINUED";

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
  totalPages?: number;
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
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  OUT_OF_STOCK: "Esgotado",
  DISCONTINUED: "Descontinuado",
};

export const STATUS_COLOR: Record<ProductStatus, string> = {
  ACTIVE: "#22c55e",
  INACTIVE: "#94a3b8",
  OUT_OF_STOCK: "#f59e0b",
  DISCONTINUED: "#ef4444",
};

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
