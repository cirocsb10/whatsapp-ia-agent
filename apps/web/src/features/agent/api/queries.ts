"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/fetcher";
import type { CreateGuardRuleDto, GuardRule, UpdateGuardRuleDto } from "@/types/guard-rule";

export interface AgentConfig {
  agentName: string;
  tone: string;
  greetingMessage: string;
  inactivityMessage: string;
  closingMessage: string;
  outOfHoursMessage: string;
  handoffMessage: string;
  autoHandoffThreshold: number;
  handoffOrderValueBrl: number | null;
  inactivityTimeoutMin: number;
  sessionTtlHours: number;
  maxConversationLength: number;
  businessHours: unknown;
  llmModel: string;
  llmTemperature: number;
  maxResponseLength: number;
  systemPromptBase: string | null;
  isPublished: boolean;
  [key: string]: unknown;
}

export interface KnowledgeItem {
  id: string;
  name: string;
  type: string;
  isIndexed: boolean;
  chunkCount?: number;
}

export const agentKeys = {
  all: ["agent"] as const,
  config: ["agent", "config"] as const,
  knowledge: ["agent", "knowledge"] as const,
  rules: ["agent", "rules"] as const,
};

export function useAgentConfig() {
  return useQuery({
    queryKey: agentKeys.config,
    queryFn: () => api.get<AgentConfig>("/agent/config"),
    staleTime: 30_000,
  });
}

export function useKnowledge() {
  return useQuery({
    queryKey: agentKeys.knowledge,
    queryFn: () => api.get<KnowledgeItem[]>("/agent/knowledge"),
    staleTime: 15_000,
    refetchInterval: (query) => {
      const items = query.state.data ?? [];
      return items.some((i) => !i.isIndexed) ? 3_000 : false;
    },
  });
}

export function useGuardRules() {
  return useQuery({
    queryKey: agentKeys.rules,
    queryFn: () => api.get<GuardRule[]>("/agent/rules"),
    staleTime: 30_000,
  });
}

export function useUpdateAgentConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      api.patch<AgentConfig>("/agent/config", patch),
    onSuccess: (data) => {
      qc.setQueryData(agentKeys.config, data);
    },
  });
}

export function useCreateKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type: string; content: string }) =>
      api.post<KnowledgeItem>("/agent/knowledge", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: agentKeys.knowledge }),
  });
}

export function useDeleteKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/agent/knowledge/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: agentKeys.knowledge }),
  });
}

export function useSaveGuardRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id?: string; dto: CreateGuardRuleDto | UpdateGuardRuleDto }) =>
      id
        ? api.patch<GuardRule>(`/agent/rules/${id}`, dto)
        : api.post<GuardRule>("/agent/rules", dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: agentKeys.rules }),
  });
}

export function useDeleteGuardRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/agent/rules/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: agentKeys.rules }),
  });
}

export function useToggleGuardRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<GuardRule>(`/agent/rules/${id}`, { isActive }),
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: agentKeys.rules });
      const previous = qc.getQueryData<GuardRule[]>(agentKeys.rules);
      qc.setQueryData<GuardRule[]>(agentKeys.rules, (old = []) =>
        old.map((r) => (r.id === id ? { ...r, isActive } : r)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(agentKeys.rules, ctx.previous);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: agentKeys.rules }),
  });
}

export function useAgentChat() {
  return useMutation({
    mutationFn: (message: string) =>
      api.post<{ reply: string }>("/agent/chat", { message }),
  });
}
