import { create } from "zustand";

interface Message { id: string; conversationId: string; direction: "inbound" | "outbound"; type: string; text?: string; imageUrl?: string; audioUrl?: string; documentUrl?: string; documentName?: string; sentAt: string; isFromAi: boolean; }
interface Conversation { id: string; contact: { name?: string; phone: string }; status: string; lastMessage?: string; lastMessageAt?: string; unreadCount: number; isHandoff: boolean; }

interface InboxStore {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  activeConversationId: string | null;
  setConversations: (c: Conversation[]) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  setActiveConversation: (id: string | null) => void;
  addMessage: (msg: any) => void;
  updateConversationStatus: (u: any) => void;
  addHandoffConversation: (e: any) => void;
  markAsRead: (id: string) => void;
}

export const useInboxStore = create<InboxStore>((set) => ({
  conversations: [],
  messages: {},
  activeConversationId: null,
  setConversations: (conversations) => set({ conversations }),
  setMessages: (conversationId, messages) => set((s) => ({
    messages: { ...s.messages, [conversationId]: messages },
  })),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  addMessage: (msg) => set((s) => ({
    messages: { ...s.messages, [msg.conversationId]: [...(s.messages[msg.conversationId] ?? []), { id: msg.messageId ?? String(Date.now()), conversationId: msg.conversationId, direction: msg.direction, type: msg.type ?? "text", text: msg.text, sentAt: msg.sentAt ?? new Date().toISOString(), isFromAi: msg.isFromAi ?? false }] },
    conversations: s.conversations.map((c) => c.id === msg.conversationId ? { ...c, lastMessage: msg.text ?? "[mídia]", lastMessageAt: msg.sentAt, unreadCount: c.unreadCount + 1 } : c),
  })),
  updateConversationStatus: ({ conversationId, status }) => set((s) => ({ conversations: s.conversations.map((c) => c.id === conversationId ? { ...c, status, isHandoff: status === "HUMAN_HANDOFF" } : c) })),
  addHandoffConversation: (event) => set((s) => ({ conversations: s.conversations.map((c) => c.id === event.conversationId ? { ...c, isHandoff: true, status: "HUMAN_HANDOFF" } : c) })),
  markAsRead: (id) => set((s) => ({ conversations: s.conversations.map((c) => c.id === id ? { ...c, unreadCount: 0 } : c) })),
}));
