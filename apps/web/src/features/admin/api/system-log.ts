"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/fetcher";

export interface SystemAccessLogItem {
  id: string;
  tenantId: string | null;
  userId: string | null;
  userEmail: string | null;
  method: string;
  endpoint: string;
  statusCode: number;
  payload: unknown;
  ip: string | null;
  userAgent: string | null;
  duration: number;
  createdAt: string;
}

export interface SystemLogPage {
  items: SystemAccessLogItem[];
  total: number;
  page: number;
  limit: number;
}

export interface SystemLogFilters {
  method?: string;
  endpoint?: string;
  ip?: string;
  from?: string;
  to?: string;
}

export const systemLogKeys = {
  list: (page: number, filters: SystemLogFilters) =>
    ["super-admin", "system-log", page, filters] as const,
};

export function useSystemLog(filters: SystemLogFilters, page: number, limit = 50) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (filters.method) params.set("method", filters.method);
  if (filters.endpoint) params.set("endpoint", filters.endpoint);
  if (filters.ip) params.set("ip", filters.ip);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  return useQuery({
    queryKey: systemLogKeys.list(page, filters),
    queryFn: () =>
      api.get<SystemLogPage>(`/super-admin/system-log?${params.toString()}`),
    staleTime: 10_000,
  });
}
