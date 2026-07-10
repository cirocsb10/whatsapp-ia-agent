"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/fetcher";

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  createdAt: string;
  contact?: { phone: string; name?: string };
  items?: Array<{ productName: string; quantity: number }>;
}

export interface OrdersPage {
  items: Order[];
  total: number;
  page: number;
  totalPages: number;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  notes: string | null;
  createdAt: string;
  confirmedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  contact: { phone: string; name: string | null };
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    priceCents: number;
    subtotalCents: number;
  }>;
  payments: Array<{
    id: string;
    method: string;
    status: string;
    amountCents: number;
    pixCopyPaste: string | null;
    paidAt: string | null;
  }>;
}

export interface ProductResult {
  id: string;
  name: string;
  priceCents: number;
}

export const orderKeys = {
  all: ["orders"] as const,
  list: (page: number, limit: number) => ["orders", "list", page, limit] as const,
  detail: (id: string) => ["orders", "detail", id] as const,
  productSearch: (q: string) => ["orders", "product-search", q] as const,
};

export function useOrders(page: number, limit = 20) {
  return useQuery({
    queryKey: orderKeys.list(page, limit),
    queryFn: () => api.get<OrdersPage>(`/orders?page=${page}&limit=${limit}`),
    staleTime: 15_000,
  });
}

export function useOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: orderKeys.detail(orderId ?? "__none__"),
    queryFn: () => api.get<OrderDetail>(`/orders/${orderId as string}`),
    enabled: !!orderId,
    staleTime: 15_000,
  });
}

export function useProductSearch(search: string, enabled: boolean) {
  return useQuery({
    queryKey: orderKeys.productSearch(search),
    queryFn: async () => {
      const data = await api.get<{ items: ProductResult[] }>(
        `/products?search=${encodeURIComponent(search)}&limit=5&status=ACTIVE`,
      );
      return (data.items ?? []).map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents }));
    },
    enabled: enabled && !!search.trim(),
    staleTime: 30_000,
  });
}

export interface CreateOrderInput {
  contactPhone: string;
  items: Array<{ productId: string; quantity: number }>;
  notes?: string | undefined;
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => api.post<Order>("/orders", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.all }),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      api.patch<Order>(`/orders/${orderId}/status`, { status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.all }),
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.patch<Order>(`/orders/${orderId}/cancel`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: orderKeys.all }),
  });
}
