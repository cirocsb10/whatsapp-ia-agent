"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/fetcher";

export type MessageTemplateStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED";

export type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "SENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export type CampaignRecipientStatus =
  | "PENDING"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "SKIPPED";

export interface MessageTemplate {
  id: string;
  tenantId: string;
  channelId: string;
  name: string;
  language: string;
  category: string | null;
  status: MessageTemplateStatus;
  bodyText: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AudienceQuery =
  | { type: "all" }
  | { type: "crm_stage"; stageId: string };

export interface CampaignListItem {
  id: string;
  name: string;
  status: CampaignStatus;
  audienceQuery: AudienceQuery;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  channel: { id: string; displayName: string; whatsappNumber: string | null };
  template: {
    id: string;
    name: string;
    language: string;
    status: MessageTemplateStatus;
    category: string | null;
  };
  _count: { recipients: number };
}

export interface CampaignRecipient {
  id: string;
  status: CampaignRecipientStatus;
  waMessageId: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  contact: { id: string; phone: string; name: string | null };
}

export interface CampaignDetail extends Omit<CampaignListItem, "_count"> {
  template: MessageTemplate;
  recipients: CampaignRecipient[];
}

export interface CreateCampaignInput {
  name: string;
  channelId: string;
  templateId: string;
  audienceQuery: AudienceQuery;
}

export const campaignKeys = {
  all: ["campaigns"] as const,
  list: ["campaigns", "list"] as const,
  detail: (id: string) => ["campaigns", "detail", id] as const,
  templates: (channelId?: string) =>
    ["campaigns", "templates", channelId ?? "all"] as const,
};

export function useCampaigns() {
  return useQuery({
    queryKey: campaignKeys.list,
    queryFn: () => api.get<CampaignListItem[]>("/campaigns"),
    staleTime: 15_000,
  });
}

export function useCampaign(id: string | null) {
  return useQuery({
    queryKey: campaignKeys.detail(id ?? ""),
    queryFn: () => api.get<CampaignDetail>(`/campaigns/${id}`),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useMessageTemplates(channelId?: string, approvedOnly = false) {
  const qs = new URLSearchParams();
  if (channelId) qs.set("channelId", channelId);
  if (approvedOnly) qs.set("approvedOnly", "true");
  const q = qs.toString();
  return useQuery({
    queryKey: [...campaignKeys.templates(channelId), approvedOnly],
    queryFn: () =>
      api.get<MessageTemplate[]>(`/campaigns/templates${q ? `?${q}` : ""}`),
    staleTime: 30_000,
  });
}

export function useSyncTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) =>
      api.post<MessageTemplate[]>("/campaigns/templates/sync", { channelId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: campaignKeys.all }),
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCampaignInput) =>
      api.post<CampaignListItem>("/campaigns", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: campaignKeys.list }),
  });
}

export function useDispatchCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<CampaignDetail>(`/campaigns/${id}/dispatch`),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: campaignKeys.list });
      void qc.invalidateQueries({ queryKey: campaignKeys.detail(data.id) });
    },
  });
}
