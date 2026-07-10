"use client";
import { create } from "zustand";

/**
 * Estado do indicador "IA digitando", por conversa.
 *
 * O backend emite `ai_typing_started` quando a mensagem do cliente chega e a IA
 * vai responder, e `ai_typing_stopped` quando a resposta sai (ou em handoff). Se
 * um `stopped` se perder (ex.: erro/timeout no orchestrator), um auto-expire de
 * segurança limpa o indicador para ele não ficar preso na tela.
 */
const TYPING_TTL_MS = 30_000;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(conversationId: string): void {
  const timer = timers.get(conversationId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(conversationId);
  }
}

interface TypingStore {
  typing: Record<string, boolean>;
  start: (conversationId: string) => void;
  stop: (conversationId: string) => void;
}

export const useTypingStore = create<TypingStore>((set) => ({
  typing: {},
  start: (conversationId) => {
    clearTimer(conversationId);
    timers.set(
      conversationId,
      setTimeout(() => {
        timers.delete(conversationId);
        set((state) => ({ typing: { ...state.typing, [conversationId]: false } }));
      }, TYPING_TTL_MS),
    );
    set((state) =>
      state.typing[conversationId]
        ? state
        : { typing: { ...state.typing, [conversationId]: true } },
    );
  },
  stop: (conversationId) => {
    clearTimer(conversationId);
    set((state) =>
      state.typing[conversationId]
        ? { typing: { ...state.typing, [conversationId]: false } }
        : state,
    );
  },
}));
