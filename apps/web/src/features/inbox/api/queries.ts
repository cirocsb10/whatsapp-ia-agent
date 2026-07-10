import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/fetcher";

export type MessageStatus = "sent" | "delivered" | "read" | "failed";

export interface InboxMessage {
  id: string;
  conversationId: string;
  waMessageId?: string | undefined;
  direction: "inbound" | "outbound";
  type: string;
  text?: string | undefined;
  imageUrl?: string | undefined;
  audioUrl?: string | undefined;
  documentUrl?: string | undefined;
  documentName?: string | undefined;
  sentAt: string;
  isFromAi: boolean;
  messageStatus?: MessageStatus | undefined;
  optimistic?: boolean | undefined;
}

export interface InboxConversation {
  id: string;
  contact: { name?: string | undefined; phone: string };
  status: string;
  lastMessage?: string | undefined;
  lastMessageAt?: string | undefined;
  unreadCount: number;
  isHandoff: boolean;
  isAssumed: boolean;
}

export const inboxKeys = {
  conversations: ["inbox", "conversations"] as const,
  messages: (conversationId: string) => ["inbox", "messages", conversationId] as const,
};

/** Tamanho da página inicial/incremental de mensagens (B2 §3.5). */
export const MESSAGES_PAGE_SIZE = 50;

export interface MessagesPage {
  messages: InboxMessage[];
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * Busca uma página de mensagens lendo a meta de paginação dos headers
 * (X-Has-More / X-Next-Cursor), repassados pelo proxy BFF. Vai direto ao
 * `fetch` (em vez do `api`) porque precisamos inspecionar os headers.
 */
export async function fetchMessagesPage(
  conversationId: string,
  opts: { limit?: number; before?: string } = {},
): Promise<MessagesPage> {
  const params = new URLSearchParams({ limit: String(opts.limit ?? MESSAGES_PAGE_SIZE) });
  if (opts.before) params.set("before", opts.before);

  const res = await fetch(`/api/proxy/conversations/${conversationId}/messages?${params}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`messages page failed: ${res.status}`);

  const messages = (await res.json()) as InboxMessage[];
  return {
    messages,
    hasMore: res.headers.get("X-Has-More") === "true",
    nextCursor: res.headers.get("X-Next-Cursor"),
  };
}

// ─────────────────────────── Hooks ───────────────────────────
// server-state migrado da store Zustand para o cache do Query (F3 §3.5).
// Sem refetch no foco: unreadCount/preview são estado efêmero atualizado pelo
// socket; um refetch os zeraria (o backend devolve unreadCount=0). O botão
// "atualizar" usa refetch() explícito.

export function useConversations() {
  return useQuery({
    queryKey: inboxKeys.conversations,
    queryFn: () => api.get<InboxConversation[]>("/conversations"),
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: inboxKeys.messages(conversationId ?? "__none__"),
    // Carga inicial limitada às últimas MESSAGES_PAGE_SIZE (B2). "Carregar
    // anteriores" faz prepend via prependOlderMessages. Mantém o cache como
    // array plano para os mutadores do socket.
    queryFn: async () => (await fetchMessagesPage(conversationId as string)).messages,
    enabled: !!conversationId,
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });
}

/**
 * Prepend de mensagens mais antigas no cache, com dedupe por id (mantém ordem asc).
 */
export function prependOlderMessages(
  qc: QueryClient,
  conversationId: string,
  older: InboxMessage[],
) {
  qc.setQueryData<InboxMessage[]>(inboxKeys.messages(conversationId), (current) => {
    const existing = current ?? [];
    const seen = new Set(existing.map((m) => m.id));
    const toPrepend = older.filter((m) => !seen.has(m.id));
    return [...toPrepend, ...existing];
  });
}

// ─────────────────── Mutadores de cache (socket/otimista) ───────────────────
// Portados 1:1 da antiga inbox.store para o cache do Query, preservando dedupe
// por id e reconciliação do envio otimista.

interface SocketMessagePayload {
  messageId?: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  type?: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  documentUrl?: string;
  documentName?: string;
  sentAt?: string;
  isFromAi?: boolean;
  waMessageId?: string;
  messageStatus?: MessageStatus;
}

function buildMessage(msg: SocketMessagePayload, id: string): InboxMessage {
  return {
    id,
    conversationId: msg.conversationId,
    waMessageId: msg.waMessageId ?? undefined,
    direction: msg.direction,
    type: msg.type ?? "text",
    text: msg.text,
    imageUrl: msg.imageUrl ?? undefined,
    audioUrl: msg.audioUrl ?? undefined,
    documentUrl: msg.documentUrl ?? undefined,
    documentName: msg.documentName ?? undefined,
    sentAt: msg.sentAt ?? new Date().toISOString(),
    isFromAi: msg.isFromAi ?? false,
    messageStatus: msg.direction === "outbound" ? (msg.messageStatus ?? "sent") : undefined,
  };
}

function patchConversation(
  qc: QueryClient,
  conversationId: string,
  patch: (c: InboxConversation) => InboxConversation,
) {
  qc.setQueryData<InboxConversation[]>(inboxKeys.conversations, (old) =>
    old ? old.map((c) => (c.id === conversationId ? patch(c) : c)) : old,
  );
}

function bumpConversationPreview(
  qc: QueryClient,
  conversationId: string,
  text: string | undefined,
  sentAt: string | undefined,
  incUnread: number,
) {
  patchConversation(qc, conversationId, (c) => ({
    ...c,
    lastMessage: text ?? "[mídia]",
    lastMessageAt: sentAt ?? c.lastMessageAt,
    unreadCount: c.unreadCount + incUnread,
  }));
}

export function applyNewMessage(qc: QueryClient, msg: SocketMessagePayload) {
  const convId = msg.conversationId;
  const incomingId = msg.messageId ?? String(Date.now());
  const current = qc.getQueryData<InboxMessage[]>(inboxKeys.messages(convId));

  if (current) {
    // Dedupe: evento duplicado (mesmo id real) → nada muda.
    if (current.some((m) => m.id === incomingId)) return;

    // Reconciliação otimista: o echo outbound substitui o balão otimista correspondente.
    if (msg.direction === "outbound") {
      const idx = current.findIndex(
        (m) => m.optimistic && m.text === msg.text && m.messageStatus !== "failed",
      );
      if (idx !== -1) {
        const next = current.slice();
        const prev = next[idx]!;
        next[idx] = {
          ...prev,
          id: incomingId,
          waMessageId: msg.waMessageId ?? undefined,
          sentAt: msg.sentAt ?? prev.sentAt,
          isFromAi: msg.isFromAi ?? false,
          messageStatus: msg.messageStatus ?? "sent",
          optimistic: false,
        };
        qc.setQueryData(inboxKeys.messages(convId), next);
        bumpConversationPreview(qc, convId, msg.text, msg.sentAt, 0);
        return;
      }
    }

    qc.setQueryData(inboxKeys.messages(convId), [...current, buildMessage(msg, incomingId)]);
  }

  // Preview/unread da conversa (tanto no append quanto quando a lista não está carregada).
  bumpConversationPreview(qc, convId, msg.text, msg.sentAt, msg.direction === "inbound" ? 1 : 0);
}

export function applyOptimisticMessage(qc: QueryClient, conversationId: string, text: string): string {
  const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  qc.setQueryData<InboxMessage[]>(inboxKeys.messages(conversationId), (old) => [
    ...(old ?? []),
    {
      id: tempId,
      conversationId,
      direction: "outbound",
      type: "text",
      text,
      sentAt: now,
      isFromAi: false,
      messageStatus: "sent",
      optimistic: true,
    },
  ]);
  bumpConversationPreview(qc, conversationId, text, now, 0);
  return tempId;
}

export function markOptimisticFailed(qc: QueryClient, conversationId: string, messageId: string) {
  qc.setQueryData<InboxMessage[]>(inboxKeys.messages(conversationId), (old) =>
    old
      ? old.map((m) => (m.id === messageId ? { ...m, messageStatus: "failed", optimistic: false } : m))
      : old,
  );
}

export function applyMessageStatus(
  qc: QueryClient,
  payload: { conversationId: string; waMessageId: string; status: MessageStatus },
) {
  qc.setQueryData<InboxMessage[]>(inboxKeys.messages(payload.conversationId), (old) =>
    old
      ? old.map((m) => (m.waMessageId === payload.waMessageId ? { ...m, messageStatus: payload.status } : m))
      : old,
  );
}

export function applyConversationStatus(
  qc: QueryClient,
  payload: { conversationId: string; status: string; isAssumed?: boolean },
) {
  patchConversation(qc, payload.conversationId, (c) => ({
    ...c,
    status: payload.status,
    isHandoff: payload.status === "HUMAN_HANDOFF",
    isAssumed: payload.isAssumed ?? (payload.status === "HUMAN_HANDOFF" ? c.isAssumed : false),
  }));
}

export function useAssumeConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      api.patch<{ ok: boolean }>(`/conversations/${conversationId}/assume`),
    onSuccess: (_data, conversationId) => {
      applyConversationStatus(qc, {
        conversationId,
        status: "HUMAN_HANDOFF",
        isAssumed: true,
      });
    },
  });
}

export function useReleaseConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      api.patch<{ ok: boolean }>(`/conversations/${conversationId}/release`),
    onSuccess: (_data, conversationId) => {
      applyConversationStatus(qc, {
        conversationId,
        status: "ACTIVE",
        isAssumed: false,
      });
    },
  });
}

/** Envio de mensagem do operador; o otimismo fica no caller (applyOptimisticMessage). */
export async function sendConversationMessage(conversationId: string, text: string) {
  return api.post(`/conversations/${conversationId}/messages`, { text });
}

export function applyHandoffCreated(qc: QueryClient, payload: { conversationId: string }) {
  patchConversation(qc, payload.conversationId, (c) => ({
    ...c,
    isHandoff: true,
    status: "HUMAN_HANDOFF",
  }));
}

export function markConversationRead(qc: QueryClient, conversationId: string) {
  patchConversation(qc, conversationId, (c) => ({ ...c, unreadCount: 0 }));
}
