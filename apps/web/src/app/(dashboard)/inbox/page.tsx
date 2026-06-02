"use client";
import { Header } from "@/components/layout/Header";
import { useSocket } from "@/hooks/useSocket";
import { useInboxStore } from "@/lib/store/inbox.store";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { useApi } from "@/lib/hooks/useApi";
import {
  MessageSquare, Search, Bot, Phone, User,
  ArrowUpRight, Inbox, SlidersHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";

function getInitials(name?: string, phone?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      const first = parts[0]?.[0] ?? "";
      const last = parts[parts.length - 1]?.[0] ?? "";
      return (first + last).toUpperCase();
    }
    return (parts[0] ?? "").slice(0, 2).toUpperCase();
  }
  return phone?.slice(-2) ?? "??";
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const ACCENT_PALETTE = [
  "#6366f1", "#22c55e", "#06b6d4", "#f59e0b",
  "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
];
function accentFor(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) & 0xffffffff;
  return ACCENT_PALETTE[Math.abs(n) % ACCENT_PALETTE.length];
}

type FilterTab = "all" | "ai" | "handoff";

export default function InboxPage() {
  useSocket();
  const { apiFetch } = useApi();
  const conversations = useInboxStore((s) => s.conversations);
  const messages = useInboxStore((s) => s.messages);
  const activeId = useInboxStore((s) => s.activeConversationId);
  const setConversations = useInboxStore((s) => s.setConversations);
  const setMessages = useInboxStore((s) => s.setMessages);
  const setActive = useInboxStore((s) => s.setActiveConversation);
  const markAsRead = useInboxStore((s) => s.markAsRead);
  const activeMessages = activeId ? (messages[activeId] ?? []) : [];
  const activeConv = conversations.find((c) => c.id === activeId);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await apiFetch("/conversations");
        if (res.ok) setConversations(await res.json());
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = conversations.filter((c) => {
    const matchSearch =
      !search ||
      (c.contact.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      c.contact.phone.includes(search);
    const matchFilter =
      filter === "all" ||
      (filter === "ai" && !c.isHandoff) ||
      (filter === "handoff" && c.isHandoff);
    return matchSearch && matchFilter;
  });

  async function handleSelectConv(id: string) {
    setActive(id);
    markAsRead(id);
    if (messages[id]?.length) return;
    const res = await apiFetch(`/conversations/${id}/messages`);
    if (res.ok) setMessages(id, await res.json());
  }

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: conversations.length },
    { key: "ai", label: "IA", count: conversations.filter((c) => !c.isHandoff).length },
    { key: "handoff", label: "Handoff", count: conversations.filter((c) => c.isHandoff).length },
  ];

  return (
    <div className="animate-fade-in flex h-screen flex-col">
      <Header title="Conversas" subtitle="Inbox unificado em tempo real" />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Conversation List ── */}
        <aside className="inbox-sidebar">
          {/* Search */}
          <div className="inbox-search-wrap">
            <Search className="inbox-search-icon" />
            <input
              className="inbox-search-input"
              placeholder="Buscar conversa…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="inbox-filter-btn" title="Filtros avançados">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Filter tabs */}
          <div className="inbox-tabs">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`inbox-tab ${filter === t.key ? "inbox-tab-active" : ""}`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`inbox-tab-count ${filter === t.key ? "inbox-tab-count-active" : ""}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center gap-3">
                <div className="inbox-empty-icon">
                  <Inbox className="w-5 h-5 text-slate-600" />
                </div>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  {loading ? "Carregando conversas..." : search ? "Nenhuma conversa encontrada" : "Nenhuma conversa ativa"}
                </p>
              </div>
            ) : (
              filtered.map((conv) => {
                const initials = getInitials(conv.contact.name, conv.contact.phone);
                const accent = accentFor(conv.id);
                const isActive = activeId === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => void handleSelectConv(conv.id)}
                    className={`inbox-conv-item ${isActive ? "inbox-conv-item-active" : ""}`}
                  >
                    {/* Avatar */}
                    <div
                      className="inbox-avatar"
                      style={{
                        background: `${accent}18`,
                        borderColor: `${accent}30`,
                        color: accent,
                      }}
                    >
                      {initials}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[13px] font-semibold text-[#f1f5f9] truncate">
                          {conv.contact.name ?? conv.contact.phone}
                        </span>
                        <span className="text-[10px] text-[#475569] flex-shrink-0 tabular-nums">
                          {relativeTime(conv.lastMessageAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <p className="text-[12px] text-[#64748b] truncate flex-1 leading-relaxed">
                          {conv.lastMessage ?? "Sem mensagens"}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="inbox-badge">{conv.unreadCount > 9 ? "9+" : conv.unreadCount}</span>
                        )}
                      </div>

                      {/* Status row */}
                      <div className="flex items-center gap-1.5 mt-1">
                        {conv.isHandoff ? (
                          <span className="inbox-status-tag inbox-status-handoff">
                            <Phone className="w-2.5 h-2.5" />
                            Handoff
                          </span>
                        ) : (
                          <span className="inbox-status-tag inbox-status-ai">
                            <Bot className="w-2.5 h-2.5" />
                            IA Ativa
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Chat Area ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#070d1a]">
          {activeId && activeConv ? (
            <>
              {/* Chat header */}
              <div className="inbox-chat-header">
                <div
                  className="inbox-chat-avatar"
                  style={{
                    background: `${accentFor(activeConv.id)}18`,
                    borderColor: `${accentFor(activeConv.id)}35`,
                    color: accentFor(activeConv.id),
                  }}
                >
                  {getInitials(activeConv.contact.name, activeConv.contact.phone)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-[#f1f5f9]">
                      {activeConv.contact.name ?? activeConv.contact.phone}
                    </span>
                    {activeConv.isHandoff ? (
                      <span className="inbox-status-tag inbox-status-handoff">
                        <Phone className="w-2.5 h-2.5" />
                        Aguardando atendente
                      </span>
                    ) : (
                      <span className="inbox-status-tag inbox-status-ai">
                        <Bot className="w-2.5 h-2.5" />
                        IA Respondendo
                      </span>
                    )}
                  </div>
                  {activeConv.contact.name && (
                    <p className="text-[11px] text-[#475569] mt-0.5 font-mono">
                      {activeConv.contact.phone}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button className="header-icon-btn" title="Ver perfil do contato">
                    <User className="w-3.5 h-3.5" />
                  </button>
                  <button className="header-icon-btn header-icon-btn-accent" title="Transferir para humano">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {activeMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                    <MessageSquare className="w-8 h-8 text-slate-700" />
                    <p className="text-[12px] text-slate-600">Sem mensagens ainda</p>
                  </div>
                ) : (
                  activeMessages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      direction={msg.direction}
                      type={msg.type}
                      {...(msg.text !== undefined ? { text: msg.text } : {})}
                      isFromAi={msg.isFromAi}
                      sentAt={msg.sentAt}
                    />
                  ))
                )}
              </div>

              {/* Input bar */}
              <div className="inbox-input-bar">
                <div className="inbox-input-inner">
                  {activeConv.isHandoff ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 w-full">
                      <Phone className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="text-[12px] text-[#64748b]">
                        Aguardando atendente humano — respostas da IA pausadas
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2.5 w-full">
                      <Bot className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      <span className="text-[12px] text-[#475569]">
                        Agente IA respondendo automaticamente
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Empty chat state */
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center max-w-xs">
                <div className="inbox-chat-empty-icon">
                  <MessageSquare className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#e2e8f0] mb-1">
                    Selecione uma conversa
                  </p>
                  <p className="text-[12px] text-[#475569] leading-relaxed">
                    Escolha uma conversa à esquerda para visualizar o histórico de mensagens
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
