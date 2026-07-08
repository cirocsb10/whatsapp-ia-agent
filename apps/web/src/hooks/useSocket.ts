"use client";
import { useEffect, useCallback, useRef } from "react";
import { useAuthContext } from "@/contexts/auth-context";
import { useInboxStore } from "@/lib/store/inbox.store";
import { useNotificationsStore } from "@/lib/store/notifications.store";

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
  const addMessage = useInboxStore((s) => s.addMessage);
  const updateStatus = useInboxStore((s) => s.updateConversationStatus);
  const updateMessageStatus = useInboxStore((s) => s.updateMessageStatus);
  const setSocketStatus = useInboxStore((s) => s.setSocketStatus);
  const addHandoff = useInboxStore((s) => s.addHandoffConversation);
  const incrementHandoffs = useNotificationsStore((s) => s.incrementHandoffs);
  const socketRef = useRef<import("socket.io-client").Socket | null>(null);

  const cbRef = useRef({
    addMessage,
    updateStatus,
    updateMessageStatus,
    setSocketStatus,
    addHandoff,
    incrementHandoffs,
  });
  useEffect(() => {
    cbRef.current = {
      addMessage,
      updateStatus,
      updateMessageStatus,
      setSocketStatus,
      addHandoff,
      incrementHandoffs,
    };
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

      sock.on("disconnect", () => {
        cbRef.current.setSocketStatus("disconnected");
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
        const cb = cbRef.current;
        switch (event.type) {
          case "new_message":
            cb.addMessage(event.payload as Parameters<typeof addMessage>[0]);
            break;
          case "conversation_status":
          case "conversation_status_changed":
            cb.updateStatus(event.payload as Parameters<typeof updateStatus>[0]);
            break;
          case "message_status_changed":
            cb.updateMessageStatus(event.payload as Parameters<typeof updateMessageStatus>[0]);
            break;
          case "handoff_created":
            cb.addHandoff(event.payload as Parameters<typeof addHandoff>[0]);
            cb.incrementHandoffs();
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
