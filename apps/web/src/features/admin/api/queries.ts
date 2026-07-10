"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/fetcher";

export interface SuperAdminKpis {
  total_tenants: number;
  active_tenants: number;
  total_conversations: number;
}

export interface SuperAdminTenant {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELLED";
  planType: string;
  whatsappStatus: "CONNECTED" | "DISCONNECTED";
  billing: { conversationsThisMonth: number; conversationsLimit: number } | null;
  _count: { conversations: number };
}

export interface SuperAdminTenantsPage {
  items: SuperAdminTenant[];
  total: number;
}

export interface SmtpSettings {
  host: string | null;
  port: number;
  username: string | null;
  secure: boolean;
  fromEmail: string | null;
  fromName: string | null;
  hasPassword: boolean;
  configured: boolean;
}

export const adminKeys = {
  kpis: ["super-admin", "kpis"] as const,
  tenants: (page: number) => ["super-admin", "tenants", page] as const,
  smtp: ["super-admin", "email", "smtp"] as const,
};

export function useSuperAdminKpis() {
  return useQuery({
    queryKey: adminKeys.kpis,
    queryFn: () => api.get<SuperAdminKpis>("/super-admin/kpis"),
    staleTime: 30_000,
  });
}

export function useSuperAdminTenants(page: number, limit = 25) {
  return useQuery({
    queryKey: adminKeys.tenants(page),
    queryFn: () =>
      api.get<SuperAdminTenantsPage>(`/super-admin/tenants?page=${page}&limit=${limit}`),
    staleTime: 15_000,
  });
}

export function useTenantAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, action }: { tenantId: string; action: "suspend" | "activate" }) =>
      api.post<void>(`/super-admin/tenants/${tenantId}/${action}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["super-admin"] });
    },
  });
}

export function useSmtpSettings() {
  return useQuery({
    queryKey: adminKeys.smtp,
    queryFn: () => api.get<SmtpSettings>("/super-admin/email/smtp"),
    staleTime: 60_000,
  });
}

export function useSaveSmtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.put<SmtpSettings>("/super-admin/email/smtp", body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.smtp }),
  });
}

export function useTestSmtp() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<{ ok?: boolean; message?: string }>("/super-admin/email/smtp/test", body),
  });
}
