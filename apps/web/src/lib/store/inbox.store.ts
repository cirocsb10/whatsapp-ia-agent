import { create } from "zustand";

interface Message { id: string; conversationId: string; waMessageId?: string; direction: "inbound" | "outbound"; type: string; text?: string; imageUrl?: string; audioUrl?: string; documentUrl?: string; documentName?: string; sentAt: string; isFromAi: boolean; messageStatus?: "sent" | "delivered" | "read" | "failed"; }
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
  addMessage: (msg) => set((s) => ({
    messages: { ...s.messages, [msg.conversationId]: [...(s.messages[msg.conversationId] ?? []), { id: msg.messageId ?? String(Date.now()), conversationId: msg.conversationId, waMessageId: msg.waMessageId ?? undefined, direction: msg.direction, type: msg.type ?? "text", text: msg.text, imageUrl: msg.imageUrl ?? undefined, audioUrl: msg.audioUrl ?? undefined, documentUrl: msg.documentUrl ?? undefined, documentName: msg.documentName ?? undefined, sentAt: msg.sentAt ?? new Date().toISOString(), isFromAi: msg.isFromAi ?? false, messageStatus: msg.direction === "outbound" ? (msg.messageStatus ?? "sent") : undefined }] },
    conversations: s.conversations.map((c) => c.id === msg.conversationId ? { ...c, lastMessage: msg.text ?? "[mídia]", lastMessageAt: msg.sentAt, unreadCount: c.unreadCount + 1 } : c),
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
