"use client";
import { useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useInboxStore } from "@/lib/store/inbox.store";
import { useNotificationsStore } from "@/lib/store/notifications.store";

const WS_URL = (process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3002") + "/events";

export type SocketStatus = "connected" | "disconnected" | "reconnecting";

export function useSocket() {
  const { getToken } = useAuth();
  const addMessage = useInboxStore((s) => s.addMessage);
  const updateStatus = useInboxStore((s) => s.updateConversationStatus);
  const updateMessageStatus = useInboxStore((s) => s.updateMessageStatus);
  const setSocketStatus = useInboxStore((s) => s.setSocketStatus);
  const addHandoff = useInboxStore((s) => s.addHandoffConversation);
  const incrementHandoffs = useNotificationsStore((s) => s.incrementHandoffs);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    let active = true;

    async function connect() {
      const token = await getToken();
      if (!token || !active) return;

      const { io } = await import("socket.io-client");

      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      const sock = io(WS_URL, {
        transports: ["websocket"],
        auth: { token },
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 8000,
        reconnectionAttempts: Infinity,
      });

      sock.on("connect", () => {
        console.debug("[socket] connected", sock.id);
        setSocketStatus("connected");
      });

      sock.on("disconnect", (reason: string) => {
        console.warn("[socket] disconnected:", reason);
        setSocketStatus("disconnected");
      });

      // Refresh Clerk token before each reconnect attempt so the server accepts it
      sock.io.on("reconnect_attempt", async () => {
        setSocketStatus("reconnecting");
        const fresh = await getToken({ skipCache: true });
        if (fresh) sock.auth = { token: fresh };
      });

      sock.io.on("reconnect", () => {
        console.debug("[socket] reconnected");
        setSocketStatus("connected");
      });

      sock.io.on("reconnect_error", () => {
        setSocketStatus("reconnecting");
      });

      sock.on("connect_error", (err: Error) => {
        console.warn("[socket] connect_error", err.message);
        setSocketStatus("disconnected");
      });

      sock.on("event", (event: any) => {
        switch (event.type) {
          case "new_message":                 addMessage(event.payload);              break;
          case "conversation_status":         updateStatus(event.payload);            break;
          case "conversation_status_changed": updateStatus(event.payload);            break;
          case "message_status_changed":      updateMessageStatus(event.payload);     break;
          case "handoff_created":             addHandoff(event.payload); incrementHandoffs(); break;
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
  }, [getToken, addMessage, updateStatus, updateMessageStatus, setSocketStatus, addHandoff, incrementHandoffs]);

  const emit = useCallback((name: string, data: unknown) => {
    socketRef.current?.emit(name, data);
  }, []);

  return { emit };
}
