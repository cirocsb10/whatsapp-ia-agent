"use client";
import { useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useInboxStore } from "@/lib/store/inbox.store";
import { useNotificationsStore } from "@/lib/store/notifications.store";

const WS_URL = (process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3002") + "/events";

export function useSocket() {
  const { getToken } = useAuth();
  const addMessage = useInboxStore((s) => s.addMessage);
  const updateStatus = useInboxStore((s) => s.updateConversationStatus);
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
        reconnectionDelay: 2000,
      });

      sock.on("connect", () => {
        console.debug("[socket] connected", sock.id);
      });

      sock.on("connect_error", (err: Error) => {
        console.warn("[socket] connect_error", err.message);
      });

      sock.on("event", (event: any) => {
        switch (event.type) {
          case "new_message":              addMessage(event.payload);    break;
          case "conversation_status":      updateStatus(event.payload);  break;
          case "conversation_status_changed": updateStatus(event.payload); break;
          case "handoff_created":          addHandoff(event.payload); incrementHandoffs(); break;
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
  }, [getToken, addMessage, updateStatus, addHandoff, incrementHandoffs]);

  const emit = useCallback((name: string, data: unknown) => {
    socketRef.current?.emit(name, data);
  }, []);

  return { emit };
}
