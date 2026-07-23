"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/fetcher";

export type ChannelUserRole = "OWNER" | "ADMIN" | "AGENT" | "VIEWER";

export interface ChannelMemberUser {
  id: string;
  name: string;
  email: string;
  role: ChannelUserRole;
}

export interface ChannelMember {
  id: string;
  channelId: string;
  userId: string;
  createdAt: string;
  user: ChannelMemberUser;
}

export interface WhatsappChannel {
  id: string;
  tenantId: string;
  displayName: string;
  whatsappPhoneId: string;
  whatsappNumber: string | null;
  wabaId: string | null;
  status: "ACTIVE" | "INACTIVE";
  isDefault: boolean;
  isAiEnabled: boolean;
  hasMetaAccessToken: boolean;
  createdAt: string;
  updatedAt: string;
  members: ChannelMember[];
}

export interface CreateChannelInput {
  displayName: string;
  whatsappPhoneId: string;
  whatsappNumber?: string;
  metaAccessToken?: string;
  wabaId?: string;
  memberUserIds?: string[];
  isAiEnabled?: boolean;
}

export interface UpdateChannelInput {
  displayName?: string;
  whatsappPhoneId?: string;
  whatsappNumber?: string | null;
  metaAccessToken?: string | null;
  wabaId?: string | null;
  status?: "ACTIVE" | "INACTIVE";
  isDefault?: boolean;
  isAiEnabled?: boolean;
}

export const channelKeys = {
  all: ["channels"] as const,
  list: ["channels", "list"] as const,
  users: ["channels", "users"] as const,
};

export function useChannels() {
  return useQuery({
    queryKey: channelKeys.list,
    queryFn: () => api.get<WhatsappChannel[]>("/channels"),
    staleTime: 30_000,
  });
}

export function useChannelUsers() {
  return useQuery({
    queryKey: channelKeys.users,
    queryFn: () => api.get<ChannelMemberUser[]>("/channels/users"),
    staleTime: 60_000,
  });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChannelInput) =>
      api.post<WhatsappChannel>("/channels", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: channelKeys.all }),
  });
}

export function useUpdateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateChannelInput & { id: string }) =>
      api.patch<WhatsappChannel>(`/channels/${id}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: channelKeys.all }),
  });
}

export function useDeleteChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/channels/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: channelKeys.all }),
  });
}

export function useReplaceChannelMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
      api.put<WhatsappChannel>(`/channels/${id}/members`, { userIds }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: channelKeys.all }),
  });
}

export function useToggleChannelAi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch<WhatsappChannel>(`/channels/${id}/ai`, { enabled }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: channelKeys.all }),
  });
}
