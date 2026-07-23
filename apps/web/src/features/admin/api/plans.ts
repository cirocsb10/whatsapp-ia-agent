"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/fetcher";

export type PlanType = "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE";

export interface PlanTenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  planType: PlanType;
  hasStripeSubscription: boolean;
  billing: {
    currentPlan: PlanType;
    conversationsThisMonth: number;
    conversationsLimit: number;
  } | null;
  usage: {
    conversationsThisMonth: number;
    conversationsLimit: number;
  };
}

export interface PlansOverviewPage {
  items: PlanTenantRow[];
  total: number;
  page: number;
  limit: number;
  planLimits: Record<PlanType, number>;
}

export interface OverridePlanResult {
  tenantId: string;
  previousPlan: PlanType;
  planType: PlanType;
  billing: PlanTenantRow["billing"];
  reason: string | null;
  warning: string;
}

export const plansKeys = {
  overview: (page: number) => ["super-admin", "plans", page] as const,
};

export function usePlansOverview(page: number, limit = 25) {
  return useQuery({
    queryKey: plansKeys.overview(page),
    queryFn: () =>
      api.get<PlansOverviewPage>(
        `/super-admin/plans?page=${page}&limit=${limit}`,
      ),
    staleTime: 15_000,
  });
}

export function useOverridePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      tenantId,
      planType,
      reason,
    }: {
      tenantId: string;
      planType: PlanType;
      reason?: string;
    }) =>
      api.post<OverridePlanResult>(`/super-admin/plans/${tenantId}/override`, {
        planType,
        reason,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["super-admin", "plans"] });
      void qc.invalidateQueries({ queryKey: ["super-admin", "tenants"] });
    },
  });
}
