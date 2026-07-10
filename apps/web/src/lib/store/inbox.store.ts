import { create } from "zustand";

interface Message { id: string; conversationId: string; waMessageId?: string; direction: "inbound" | "outbound"; type: string; text?: string; imageUrl?: string; audioUrl?: string; documentUrl?: string; documentName?: string; sentAt: string; isFromAi: boolean; messageStatus?: "sent" | "delivered" | "read" | "failed"; optimistic?: boolean; }
interface Conversation { id: string; contact: { name?: string; phone: string }; status: string; lastMessage?: string; lastMessageAt?: string; unreadCount: number; isHandoff: boolean; isAssumed: boolean; }

interface InboxStore {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  activeConversationId: string | null;
  socketStatus: "connected" | "disconnected" | "reconnecting";
  setConversations: (c: Conversation[]) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  setActiveConversation: (id: string | null) => void;
  addMessage: (msg: any) => void;
  addOptimisticMessage: (conversationId: string, text: string) => string;
  markMessageFailed: (conversationId: string, messageId: string) => void;
  updateConversationStatus: (u: any) => void;
  updateMessageStatus: (payload: { conversationId: string; waMessageId: string; status: "sent" | "delivered" | "read" | "failed" }) => void;
  setSocketStatus: (s: "connected" | "disconnected" | "reconnecting") => void;
  addHandoffConversation: (e: any) => void;
  markAsRead: (id: string) => void;
}

export const useInboxStore = create<InboxStore>((set) => ({
  conversations: [],
  messages: {},
  activeConversationId: null,
  socketStatus: "disconnected",
  setSocketStatus: (socketStatus) => set({ socketStatus }),
  setConversations: (conversations) => set({ conversations }),
  setMessages: (conversationId, messages) => set((s) => ({
    messages: { ...s.messages, [conversationId]: messages },
  })),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  addMessage: (msg) => set((s) => {
    const convId = msg.conversationId as string;
    const list = s.messages[convId] ?? [];
    const incomingId = msg.messageId ?? String(Date.now());

    // Dedupe: se essa mensagem (por id real) já existe, ignora o evento duplicado.
    if (list.some((m) => m.id === incomingId)) return s;

    // Reconciliação do envio otimista: o echo outbound do socket substitui o balão
    // otimista correspondente (mesmo texto, ainda sem waMessageId) em vez de duplicá-lo.
    if (msg.direction === "outbound") {
      const idx = list.findIndex(
        (m) => m.optimistic && m.text === msg.text && m.messageStatus !== "failed",
      );
      if (idx !== -1) {
        const next = list.slice();
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
        return {
          messages: { ...s.messages, [convId]: next },
          conversations: s.conversations.map((c) =>
            c.id === convId ? { ...c, lastMessage: msg.text ?? "[mídia]", lastMessageAt: msg.sentAt } : c,
          ),
        };
      }
    }

    const message: Message = {
      id: incomingId,
      conversationId: convId,
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

    return {
      messages: { ...s.messages, [convId]: [...list, message] },
      conversations: s.conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              lastMessage: msg.text ?? "[mídia]",
              lastMessageAt: msg.sentAt,
              unreadCount: msg.direction === "inbound" ? c.unreadCount + 1 : c.unreadCount,
            }
          : c,
      ),
    };
  }),
  addOptimisticMessage: (conversationId, text) => {
    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [
          ...(s.messages[conversationId] ?? []),
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
        ],
      },
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, lastMessage: text, lastMessageAt: now } : c,
      ),
    }));
    return tempId;
  },
  markMessageFailed: (conversationId, messageId) => set((s) => ({
    messages: {
      ...s.messages,
      [conversationId]: (s.messages[conversationId] ?? []).map((m) =>
        m.id === messageId ? { ...m, messageStatus: "failed", optimistic: false } : m,
      ),
    },
  })),
  updateMessageStatus: ({ conversationId, waMessageId, status }) => set((s) => ({
    messages: {
      ...s.messages,
      [conversationId]: (s.messages[conversationId] ?? []).map((m) =>
        m.waMessageId === waMessageId ? { ...m, messageStatus: status } : m
      ),
    },
  })),
  updateConversationStatus: ({ conversationId, status, isAssumed }) => set((s) => ({
    conversations: s.conversations.map((c) =>
      c.id === conversationId
        ? { ...c, status, isHandoff: status === "HUMAN_HANDOFF", isAssumed: isAssumed ?? (status === "HUMAN_HANDOFF" ? c.isAssumed : false) }
        : c
    ),
  })),
  addHandoffConversation: (event) => set((s) => ({
    conversations: s.conversations.map((c) =>
      c.id === event.conversationId ? { ...c, isHandoff: true, status: "HUMAN_HANDOFF" } : c
    ),
  })),
  markAsRead: (id) => set((s) => ({ conversations: s.conversations.map((c) => c.id === id ? { ...c, unreadCount: 0 } : c) })),
}));
