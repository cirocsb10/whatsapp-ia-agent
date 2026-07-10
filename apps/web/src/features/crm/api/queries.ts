"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/fetcher";
import type { Deal, FunnelStage, CrmStats, ContactSearchResult } from "@/types/crm";

export const crmKeys = {
  stages: ["crm", "stages"] as const,
  deals: ["crm", "deals"] as const,
  stats: ["crm", "stats"] as const,
  contacts: (q: string) => ["crm", "contacts", q] as const,
};

export function useStages() {
  return useQuery({
    queryKey: crmKeys.stages,
    queryFn: () => api.get<FunnelStage[]>("/crm/stages"),
    staleTime: 5 * 60_000,
  });
}

export function useDeals() {
  return useQuery({
    queryKey: crmKeys.deals,
    queryFn: () => api.get<Deal[]>("/crm/deals"),
    staleTime: 30_000,
  });
}

export function useCrmStats() {
  return useQuery({
    queryKey: crmKeys.stats,
    queryFn: () => api.get<CrmStats>("/crm/stats"),
    staleTime: 30_000,
  });
}

export function useContactSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: crmKeys.contacts(query),
    queryFn: () =>
      api.get<ContactSearchResult[]>(`/crm/contacts/search?q=${encodeURIComponent(query)}`),
    enabled,
    staleTime: 60_000,
  });
}

export interface DealInput {
  title: string;
  stageId: string;
  valueCents: number;
  notes?: string | undefined;
  contactId?: string | undefined;
}

/** Cria (POST) ou atualiza (PUT) um negócio e concilia o cache de deals + stats. */
export function useSaveDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: DealInput }) =>
      id ? api.put<Deal>(`/crm/deals/${id}`, input) : api.post<Deal>("/crm/deals", input),
    onSuccess: (saved) => {
      qc.setQueryData<Deal[]>(crmKeys.deals, (old = []) =>
        old.some((d) => d.id === saved.id)
          ? old.map((d) => (d.id === saved.id ? saved : d))
          : [...old, saved],
      );
      void qc.invalidateQueries({ queryKey: crmKeys.stats });
    },
  });
}

/** Move um negócio de etapa com update otimista e rollback em erro. */
export function useMoveDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) =>
      api.patch<Deal>(`/crm/deals/${dealId}/stage`, { stageId }),
    onMutate: async ({ dealId, stageId }) => {
      await qc.cancelQueries({ queryKey: crmKeys.deals });
      const previous = qc.getQueryData<Deal[]>(crmKeys.deals);
      qc.setQueryData<Deal[]>(crmKeys.deals, (old = []) =>
        old.map((d) => (d.id === dealId ? { ...d, stageId } : d)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(crmKeys.deals, ctx.previous);
    },
    onSuccess: (updated) => {
      qc.setQueryData<Deal[]>(crmKeys.deals, (old = []) =>
        old.map((d) => (d.id === updated.id ? updated : d)),
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: crmKeys.stats });
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dealId: string) => api.delete<void>(`/crm/deals/${dealId}`),
    onSuccess: (_data, dealId) => {
      qc.setQueryData<Deal[]>(crmKeys.deals, (old = []) => old.filter((d) => d.id !== dealId));
      void qc.invalidateQueries({ queryKey: crmKeys.stats });
    },
  });
}
