"use client";
import { Header } from "@/components/layout/Header";
import { useSocket } from "@/hooks/useSocket";
import { useInboxStore } from "@/lib/store/inbox.store";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageSquare } from "lucide-react";

export default function InboxPage() {
  useSocket();
  const conversations = useInboxStore((s) => s.conversations);
  const messages = useInboxStore((s) => s.messages);
  const activeId = useInboxStore((s) => s.activeConversationId);
  const setActive = useInboxStore((s) => s.setActiveConversation);
  const activeMessages = activeId ? (messages[activeId] ?? []) : [];
  return (
    <div className="animate-fade-in flex h-screen flex-col">
      <Header title="Conversas" subtitle="Inbox unificado em tempo real" />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 shrink-0 border-r border-[#1E293B] overflow-y-auto bg-[#0F172A]">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center"><MessageSquare className="w-10 h-10 text-slate-700 mb-3" /><p className="text-sm text-slate-600">Nenhuma conversa ativa</p></div>
          ) : conversations.map((conv) => (
            <button key={conv.id} onClick={() => setActive(conv.id)} className={`w-full text-left px-4 py-3 border-b border-[#1E293B] hover:bg-[#1E293B]/50 cursor-pointer ${activeId === conv.id ? "bg-[#1E293B]" : ""}`}>
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-white truncate">{conv.contact.name ?? conv.contact.phone}</span>{conv.unreadCount > 0 && <span className="text-[10px] bg-green-500 text-white rounded-full px-1.5 py-0.5">{conv.unreadCount}</span>}</div>
              <p className="text-xs text-slate-500 truncate mt-0.5">{conv.lastMessage}</p>
            </button>
          ))}
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeId ? (
            <div className="flex-1 overflow-y-auto p-4">{activeMessages.map((msg) => <MessageBubble key={msg.id} direction={msg.direction} type={msg.type} {...(msg.text !== undefined ? { text: msg.text } : {})} isFromAi={msg.isFromAi} sentAt={msg.sentAt} />)}</div>
          ) : (
            <div className="flex-1 flex items-center justify-center"><div className="text-center"><MessageSquare className="w-12 h-12 text-slate-700 mx-auto mb-3" /><p className="text-slate-600 text-sm">Selecione uma conversa</p></div></div>
          )}
        </div>
      </div>
    </div>
  );
}
