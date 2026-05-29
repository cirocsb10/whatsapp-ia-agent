import { create } from "zustand";

interface NotificationsStore {
  unreadCount: number;
  badges: Record<string, number>;
  incrementHandoffs: () => void;
  setBadge: (key: string, count: number) => void;
  clearAll: () => void;
}

export const useNotificationsStore = create<NotificationsStore>((set) => ({
  unreadCount: 0,
  badges: {},
  incrementHandoffs: () => set((s) => ({ unreadCount: s.unreadCount + 1, badges: { ...s.badges, pending_handoffs: (s.badges["pending_handoffs"] ?? 0) + 1 } })),
  setBadge: (key, count) => set((s) => ({ badges: { ...s.badges, [key]: count }, unreadCount: Object.values({ ...s.badges, [key]: count }).reduce((a, b) => a + b, 0) })),
  clearAll: () => set({ unreadCount: 0, badges: {} }),
}));
