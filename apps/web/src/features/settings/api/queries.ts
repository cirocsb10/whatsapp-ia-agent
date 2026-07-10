"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/fetcher";

export interface CompanySettings {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  segment: string | null;
  whatsappStatus: string;
  whatsappPhoneId: string | null;
}

export type NotificationPrefs = Record<string, boolean>;

export interface BillingSubscription {
  plan: string;
  status: string;
  renewalDate: string | null;
  usage: {
    conversations: { used: number; limit: number };
    orders: { used: number; limit: number };
    products: { used: number; limit: number };
  };
}

export interface BillingInvoice {
  id: string;
  date: string;
  amount: string;
  currency: string;
  status: string | null;
  pdfUrl: string | null;
}

export interface BillingHistory {
  invoices: BillingInvoice[];
}

export const settingsKeys = {
  company: ["settings", "company"] as const,
  notifications: ["settings", "notifications"] as const,
  billingSub: ["billing", "subscription"] as const,
  billingHistory: ["billing", "history"] as const,
};

export function useCompanySettings() {
  return useQuery({
    queryKey: settingsKeys.company,
    queryFn: () => api.get<CompanySettings>("/settings/company"),
    staleTime: 60_000,
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; timezone?: string; segment?: string | null }) =>
      api.patch<CompanySettings>("/settings/company", input),
    onSuccess: (data) => qc.setQueryData(settingsKeys.company, data),
  });
}

export function useUpdateWhatsapp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { whatsappPhoneId: string; metaAccessToken?: string }) =>
      api.patch<CompanySettings>("/settings/whatsapp", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: settingsKeys.company }),
  });
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: settingsKeys.notifications,
    queryFn: () => api.get<NotificationPrefs>("/settings/notifications"),
    staleTime: 60_000,
  });
}

export function useUpdateNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPrefs) =>
      api.patch<NotificationPrefs>("/settings/notifications", prefs),
    onSuccess: (data) => qc.setQueryData(settingsKeys.notifications, data),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api.patch<void>("/auth/change-password", input),
  });
}

export function useBillingSubscription() {
  return useQuery({
    queryKey: settingsKeys.billingSub,
    queryFn: () => api.get<BillingSubscription>("/billing/subscription"),
    staleTime: 60_000,
  });
}

export function useBillingHistory() {
  return useQuery({
    queryKey: settingsKeys.billingHistory,
    queryFn: () => api.get<BillingHistory>("/billing/history"),
    staleTime: 60_000,
  });
}

export function useBillingCheckout() {
  return useMutation({
    mutationFn: (plan: string) =>
      api.post<{ checkoutUrl: string }>("/billing/checkout", { plan }),
  });
}
