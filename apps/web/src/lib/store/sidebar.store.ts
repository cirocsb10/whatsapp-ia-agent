import { create } from "zustand";

interface SidebarStore {
  collapsed: boolean;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  collapsed: false,
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
}));

export const SIDEBAR_WIDTH = { expanded: 220, collapsed: 56 } as const;
