"use client";
import { create } from "zustand";

/**
 * Balão efêmero de streaming da IA, por conversa.
 *
 * Fluxo: ai_stream_started → ai_stream_token* → ai_stream_ended.
 * Quando chega new_message outbound da IA, clear() remove o balão (já está no Query).
 * status "replaced" (guard-rail) substitui o texto do balão até o new_message final.
 */
const STREAM_TTL_MS = 60_000;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(conversationId: string): void {
  const timer = timers.get(conversationId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(conversationId);
  }
}

export type StreamStatus = "streaming" | "ended" | "replaced";

export interface StreamBubble {
  streamId: string;
  text: string;
  status: StreamStatus;
}

interface StreamStore {
  byConversation: Record<string, StreamBubble | undefined>;
  start: (conversationId: string, streamId: string) => void;
  appendToken: (conversationId: string, streamId: string, token: string) => void;
  end: (
    conversationId: string,
    streamId: string,
    status: "ok" | "replaced" | "error",
    text?: string,
  ) => void;
  clear: (conversationId: string) => void;
}

function armTtl(conversationId: string, clearFn: (id: string) => void): void {
  clearTimer(conversationId);
  timers.set(
    conversationId,
    setTimeout(() => {
      timers.delete(conversationId);
      clearFn(conversationId);
    }, STREAM_TTL_MS),
  );
}

export const useStreamStore = create<StreamStore>((set, get) => ({
  byConversation: {},
  start: (conversationId, streamId) => {
    armTtl(conversationId, (id) => get().clear(id));
    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: { streamId, text: "", status: "streaming" },
      },
    }));
  },
  appendToken: (conversationId, streamId, token) => {
    armTtl(conversationId, (id) => get().clear(id));
    set((state) => {
      const current = state.byConversation[conversationId];
      if (!current || current.streamId !== streamId) {
        return {
          byConversation: {
            ...state.byConversation,
            [conversationId]: { streamId, text: token, status: "streaming" },
          },
        };
      }
      return {
        byConversation: {
          ...state.byConversation,
          [conversationId]: {
            ...current,
            text: current.text + token,
            status: "streaming",
          },
        },
      };
    });
  },
  end: (conversationId, streamId, status, text) => {
    armTtl(conversationId, (id) => get().clear(id));
    set((state) => {
      const current = state.byConversation[conversationId];
      if (current && current.streamId !== streamId && status !== "replaced") {
        return state;
      }
      const nextText =
        status === "replaced" && typeof text === "string"
          ? text
          : (current?.text ?? text ?? "");
      return {
        byConversation: {
          ...state.byConversation,
          [conversationId]: {
            streamId: current?.streamId ?? streamId,
            text: nextText,
            status: status === "replaced" ? "replaced" : "ended",
          },
        },
      };
    });
  },
  clear: (conversationId) => {
    clearTimer(conversationId);
    set((state) => {
      if (!state.byConversation[conversationId]) return state;
      const next = { ...state.byConversation };
      delete next[conversationId];
      return { byConversation: next };
    });
  },
}));
