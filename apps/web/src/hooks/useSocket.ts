"use client";
import { useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useInboxStore } from "@/lib/store/inbox.store";
import { useNotificationsStore } from "@/lib/store/notifications.store";

const WS_URL = (process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3002") + "/events";

export type SocketStatus = "connected" | "disconnected" | "reconnecting";

export function useSocket() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const addMessage = useInboxStore((s) => s.addMessage);
  const updateStatus = useInboxStore((s) => s.updateConversationStatus);
  const updateMessageStatus = useInboxStore((s) => s.updateMessageStatus);
  const setSocketStatus = useInboxStore((s) => s.setSocketStatus);
  const addHandoff = useInboxStore((s) => s.addHandoffConversation);
  const incrementHandoffs = useNotificationsStore((s) => s.incrementHandoffs);
  const socketRef = useRef<any>(null);

  // Keep callbacks in refs so the effect never re-runs due to them changing
  const cbRef = useRef({ addMessage, updateStatus, updateMessageStatus, setSocketStatus, addHandoff, incrementHandoffs, getToken });
  useEffect(() => {
    cbRef.current = { addMessage, updateStatus, updateMessageStatus, setSocketStatus, addHandoff, incrementHandoffs, getToken };
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let active = true;

    async function connect() {
      const token = await cbRef.current.getToken();
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
        cbRef.current.setSocketStatus("connected");
      });

      sock.on("disconnect", (reason: string) => {
        console.warn("[socket] disconnected:", reason);
        cbRef.current.setSocketStatus("disconnected");
      });

      sock.io.on("reconnect_attempt", async () => {
        cbRef.current.setSocketStatus("reconnecting");
        const fresh = await cbRef.current.getToken({ skipCache: true });
        if (fresh) sock.auth = { token: fresh };
      });

      sock.io.on("reconnect", () => {
        console.debug("[socket] reconnected");
        cbRef.current.setSocketStatus("connected");
      });

      sock.io.on("reconnect_error", () => {
        cbRef.current.setSocketStatus("reconnecting");
      });

      sock.on("connect_error", (err: Error) => {
        console.warn("[socket] connect_error", err.message);
        cbRef.current.setSocketStatus("reconnecting");
      });

      sock.on("event", (event: any) => {
        const cb = cbRef.current;
        switch (event.type) {
          case "new_message":                 cb.addMessage(event.payload);              break;
          case "conversation_status":         cb.updateStatus(event.payload);            break;
          case "conversation_status_changed": cb.updateStatus(event.payload);            break;
          case "message_status_changed":      cb.updateMessageStatus(event.payload);     break;
          case "handoff_created":             cb.addHandoff(event.payload); cb.incrementHandoffs(); break;
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
  }, [isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = useCallback((name: string, data: unknown) => {
    socketRef.current?.emit(name, data);
  }, []);

  return { emit };
}
