"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/fetcher";

export interface PlatformSettings {
  id: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  newTenantRegistrationOpen: boolean;
  defaultTrialDays: number;
  defaultConversationsLimit: number;
  planConversationLimits: {
    STARTER: number;
    GROWTH: number;
    SCALE: number;
    ENTERPRISE: number;
  };
  updatedAt: string;
}

export const platformSettingsKeys = {
  all: ["super-admin", "settings"] as const,
};

export function usePlatformSettings() {
  return useQuery({
    queryKey: platformSettingsKeys.all,
    queryFn: () => api.get<PlatformSettings>("/super-admin/settings"),
    staleTime: 30_000,
  });
}

export function useSavePlatformSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PlatformSettings>) =>
      api.put<PlatformSettings>("/super-admin/settings", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformSettingsKeys.all });
    },
  });
}
