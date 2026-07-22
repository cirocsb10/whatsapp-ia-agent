"use client";
import { create } from "zustand";

export type ToastType = "error" | "success" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  push: (type: ToastType, message: string) => void;
  dismiss: (id: string) => void;
}

const TOAST_TTL_MS = 5_000;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (type, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => get().dismiss(id), TOAST_TTL_MS);
  },
  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

export function pushToast(type: ToastType, message: string) {
  useToastStore.getState().push(type, message);
}
