"use client";
import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { useNotificationsStore } from "@/lib/store/notifications.store";
import { useSocketStatus } from "@/shared/realtime/socket-status.store";
import {
  applyNewMessage,
  applyConversationStatus,
  applyMessageStatus,
  applyHandoffCreated,
} from "@/features/inbox/api/queries";
import { useTypingStore } from "@/features/inbox/model/typing.store";
import { useStreamStore } from "@/features/inbox/model/stream.store";

const WS_URL = (process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3002") + "/events";

export type SocketStatus = "connected" | "disconnected" | "reconnecting";

async function fetchSocketTicket(): Promise<string | null> {
  const res = await fetch("/api/proxy/auth/socket-ticket", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { ticket?: string };
  return data.ticket ?? null;
}

export function useSocket() {
  const { isLoaded, isSignedIn } = useAuthContext();
  const queryClient = useQueryClient();
  const setSocketStatus = useSocketStatus((s) => s.setStatus);
  const incrementHandoffs = useNotificationsStore((s) => s.incrementHandoffs);
  const socketRef = useRef<import("socket.io-client").Socket | null>(null);

  // queryClient/setSocketStatus/incrementHandoffs são estáveis; ref evita recriar o
  // socket a cada render sem perder acesso às últimas referências.
  const cbRef = useRef({ queryClient, setSocketStatus, incrementHandoffs });
  useEffect(() => {
    cbRef.current = { queryClient, setSocketStatus, incrementHandoffs };
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let active = true;

    async function connect() {
      const ticket = await fetchSocketTicket();
      if (!ticket || !active) return;

      const { io } = await import("socket.io-client");

      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      const sock = io(WS_URL, {
        transports: ["websocket"],
        auth: { ticket },
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 8000,
        reconnectionAttempts: Infinity,
      });

      sock.on("connect", () => {
        cbRef.current.setSocketStatus("connected");
      });

      sock.on("disconnect", (reason) => {
        cbRef.current.setSocketStatus("disconnected");
        // "io server disconnect" (e.g. rejected/expired ticket) disables
        // socket.io's built-in auto-reconnect — kick it manually with a fresh ticket.
        if (reason === "io server disconnect" && active) {
          void (async () => {
            const freshTicket = await fetchSocketTicket();
            if (freshTicket && active) {
              sock.auth = { ticket: freshTicket };
              sock.connect();
            }
          })();
        }
      });

      sock.io.on("reconnect_attempt", async () => {
        cbRef.current.setSocketStatus("reconnecting");
        const freshTicket = await fetchSocketTicket();
        if (freshTicket) sock.auth = { ticket: freshTicket };
      });

      sock.io.on("reconnect", () => {
        cbRef.current.setSocketStatus("connected");
      });

      sock.io.on("reconnect_error", () => {
        cbRef.current.setSocketStatus("reconnecting");
      });

      sock.on("connect_error", () => {
        cbRef.current.setSocketStatus("reconnecting");
      });

      sock.on("event", (event: { type: string; payload: unknown }) => {
        const qc = cbRef.current.queryClient;
        const typing = useTypingStore.getState();
        const stream = useStreamStore.getState();
        switch (event.type) {
          case "new_message": {
            const payload = event.payload as Parameters<typeof applyNewMessage>[1] & {
              conversationId: string;
              direction?: string;
              isFromAi?: boolean;
            };
            applyNewMessage(qc, payload);
            // Mensagem final da IA chegou — remove balão efêmero de stream.
            if (payload.direction === "outbound" && payload.isFromAi !== false) {
              stream.clear(payload.conversationId);
              typing.stop(payload.conversationId);
            }
            break;
          }
          case "ai_typing_started":
            typing.start((event.payload as { conversationId: string }).conversationId);
            break;
          case "ai_typing_stopped":
            typing.stop((event.payload as { conversationId: string }).conversationId);
            break;
          case "ai_stream_started": {
            const p = event.payload as { conversationId: string; streamId: string };
            typing.stop(p.conversationId);
            stream.start(p.conversationId, p.streamId);
            break;
          }
          case "ai_stream_token": {
            const p = event.payload as {
              conversationId: string;
              streamId: string;
              token: string;
            };
            stream.appendToken(p.conversationId, p.streamId, p.token);
            break;
          }
          case "ai_stream_ended": {
            const p = event.payload as {
              conversationId: string;
              streamId: string;
              status?: "ok" | "replaced" | "error";
              text?: string;
            };
            stream.end(p.conversationId, p.streamId, p.status ?? "ok", p.text);
            break;
          }
          case "conversation_status":
          case "conversation_status_changed":
            applyConversationStatus(qc, event.payload as Parameters<typeof applyConversationStatus>[1]);
            break;
          case "message_status_changed":
            applyMessageStatus(qc, event.payload as Parameters<typeof applyMessageStatus>[1]);
            break;
          case "handoff_created":
            applyHandoffCreated(qc, event.payload as Parameters<typeof applyHandoffCreated>[1]);
            cbRef.current.incrementHandoffs();
            break;
          default:
            break;
        }
      });

      socketRef.current = sock;
    }

    void connect();

    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isLoaded, isSignedIn]);

  const emit = useCallback((name: string, data: unknown) => {
    socketRef.current?.emit(name, data);
  }, []);

  return { emit };
}
