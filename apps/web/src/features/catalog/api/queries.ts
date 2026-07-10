"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/fetcher";
import type {
  Product,
  ProductStats,
  ProductsResponse,
  ProductStatus,
  Category,
  ImportProductItem,
  ImportResult,
} from "@/types/product";

export interface ProductListParams {
  page: number;
  limit: number;
  search?: string | undefined;
  status?: ProductStatus | undefined;
  minPriceCents?: number | undefined;
  maxPriceCents?: number | undefined;
  minStock?: number | undefined;
  categoryId?: string | undefined;
  sortBy?: string | undefined;
  sortOrder?: string | undefined;
}

export const catalogKeys = {
  all: ["products"] as const,
  stats: ["products", "stats"] as const,
  list: (params: ProductListParams) => ["products", "list", params] as const,
  categories: ["categories"] as const,
};

function buildProductQuery(params: ProductListParams): string {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.status) qs.set("status", params.status);
  if (params.minPriceCents !== undefined) qs.set("minPriceCents", String(params.minPriceCents));
  if (params.maxPriceCents !== undefined) qs.set("maxPriceCents", String(params.maxPriceCents));
  if (params.minStock !== undefined) qs.set("minStock", String(params.minStock));
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  return qs.toString();
}

export function useProductStats() {
  return useQuery({
    queryKey: catalogKeys.stats,
    queryFn: () => api.get<ProductStats>("/products/stats"),
    staleTime: 30_000,
  });
}

export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: catalogKeys.list(params),
    queryFn: () => api.get<ProductsResponse>(`/products?${buildProductQuery(params)}`),
    staleTime: 20_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories,
    queryFn: () => api.get<Category[]>("/categories"),
    staleTime: 5 * 60_000,
  });
}

export interface ProductInput {
  name: string;
  description?: string | undefined;
  sku?: string | undefined;
  priceCents: number;
  comparePriceCents?: number | undefined;
  stockQty: number;
  lowStockThreshold: number;
  status: string;
  tags: string[];
}

export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ProductInput }) =>
      id ? api.put<Product>(`/products/${id}`, input) : api.post<Product>("/products", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: catalogKeys.all }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/products/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: catalogKeys.all }),
  });
}

export function useImportProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (products: ImportProductItem[]) =>
      api.post<ImportResult>("/products/import", { products }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: catalogKeys.all }),
  });
}
