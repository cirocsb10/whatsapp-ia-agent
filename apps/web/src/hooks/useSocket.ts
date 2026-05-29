"use client";
import { useEffect, useCallback } from "react";
import { useInboxStore } from "@/lib/store/inbox.store";
import { useNotificationsStore } from "@/lib/store/notifications.store";

let socket: any = null;

function getSocket() {
  if (!socket && typeof window !== "undefined") {
    const { io } = require("socket.io-client");
    socket = io(process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3002", { transports: ["websocket"], autoConnect: true });
  }
  return socket;
}

export function useSocket() {
  const addMessage = useInboxStore((s) => s.addMessage);
  const updateStatus = useInboxStore((s) => s.updateConversationStatus);
  const addHandoff = useInboxStore((s) => s.addHandoffConversation);
  const incrementHandoffs = useNotificationsStore((s) => s.incrementHandoffs);
  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;
    const h = (event: any) => { switch (event.type) { case "new_message": addMessage(event.payload); break; case "conversation_status": updateStatus(event.payload); break; case "handoff_created": addHandoff(event.payload); incrementHandoffs(); break; } };
    sock.on("event", h);
    return () => { sock.off("event", h); };
  }, [addMessage, updateStatus, addHandoff, incrementHandoffs]);
  const emit = useCallback((n: string, d: unknown) => { getSocket()?.emit(n, d); }, []);
  return { emit };
}
