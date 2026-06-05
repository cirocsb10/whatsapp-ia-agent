"use client";
import { Header } from "@/components/layout/Header";
import { useSocket } from "@/hooks/useSocket";
import { useInboxStore } from "@/lib/store/inbox.store";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { useApi } from "@/lib/hooks/useApi";
import { MessageSquare, Search, Bot, Phone, Inbox, SendHorizonal, UserCheck, RotateCcw, PauseCircle, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  if (h < 24) return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const d = Math.floor(h / 24);
  if (d === 1) return "Ontem";
  if (d < 7) return new Date(iso).toLocaleDateString("pt-BR", { weekday: "short" });
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const AVATAR_COLORS = [
  "#06bfff", "#bf59cf", "#fc5c5c", "#ffa940",
  "#36c5f0", "#2eb886", "#ecb22e", "#e01e5a",
];
function avatarColor(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(n) % AVATAR_COLORS.length];
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
  const bottomRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");

  async function loadConversations() {
    setLoading(true);
    try {
      const res = await apiFetch("/conversations");
      if (res.ok) setConversations(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConversations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length]);

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
    setDraft("");
    if (messages[id]?.length) return;
    const res = await apiFetch(`/conversations/${id}/messages`);
    if (res.ok) setMessages(id, await res.json());
  }

  async function handleAssume() {
    if (!activeId) return;
    await apiFetch(`/conversations/${activeId}/assume`, { method: "PATCH" });
  }

  async function handleRelease() {
    if (!activeId) return;
    await apiFetch(`/conversations/${activeId}/release`, { method: "PATCH" });
  }

  async function handleSend() {
    if (!activeId || !draft.trim()) return;
    const text = draft.trim();
    const res = await apiFetch(`/conversations/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      setDraft("");
    } else {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      console.error("[handleSend] erro:", res.status, body);
      alert(`Erro ao enviar: ${res.status} — ${(body["message"] as string) ?? "erro desconhecido"}`);
    }
  }

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: conversations.length },
    { key: "ai", label: "IA Ativa", count: conversations.filter((c) => !c.isHandoff).length },
    { key: "handoff", label: "Handoff", count: conversations.filter((c) => c.isHandoff).length },
  ];

  return (
    <div className="flex h-full flex-col">
      <Header title="Conversas" subtitle="Inbox unificado em tempo real" />
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel ── */}
        <aside className="inbox-sidebar">
          <div className="inbox-topbar">
            <div className="inbox-topbar-brand">
              <div className="inbox-topbar-avatar">
                <svg viewBox="0 0 39 39" width="20" height="20" fill="#22c55e" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d="M19.5 0C8.73 0 0 8.73 0 19.5 0 23.08 1.02 26.42 2.79 29.23L0 39l10.05-2.63A19.43 19.43 0 0 0 19.5 39C30.27 39 39 30.27 39 19.5S30.27 0 19.5 0z"/>
                  <path fillRule="evenodd" clipRule="evenodd" d="M29.36 23.74c-.38-.19-2.24-1.1-2.59-1.23-.35-.13-.6-.19-.86.19-.25.38-1 1.23-1.22 1.49-.23.25-.45.28-.83.09-.38-.19-1.6-.59-3.04-1.88a11.4 11.4 0 0 1-2.1-2.63c-.22-.38 0-.58.17-.77.15-.17.34-.44.5-.66.17-.22.23-.38.35-.63.12-.25.06-.47-.03-.66-.1-.19-.86-2.07-1.18-2.83-.31-.74-.63-.64-.86-.65h-.74c-.25 0-.66.1-.1.38-.35.98-1.32 2.85 1.25 4.5a11.8 11.8 0 0 0 4.56 4.07c.57.25 1.01.4 1.36.5.57.19 1.09.16 1.5.1.46-.07 1.4-.57 1.6-1.13.2-.56.2-1.04.14-1.13-.07-.1-.25-.16-.53-.28z" fill="white"/>
                </svg>
              </div>
              <div className="inbox-panel-header-text">
                <p className="inbox-panel-header-title">Inbox ao vivo</p>
                <p className="inbox-status-line">
                  <span className="inbox-status-dot inbox-status-dot--green" aria-hidden="true" />
                  <span className="inbox-topbar-status">Conectado</span>
                  <span className="inbox-topbar-meta-sep" aria-hidden="true">·</span>
                  <span>{conversations.length} conversa{conversations.length !== 1 ? "s" : ""}</span>
                </p>
              </div>
            </div>
            <div className="inbox-topbar-actions">
              <button type="button" className="inbox-topbar-btn" title="Atualizar lista" aria-label="Atualizar lista" onClick={() => void loadConversations()}>
                <RefreshCw className="w-[17px] h-[17px]" />
              </button>
            </div>
          </div>

          <div className="inbox-search-wrap">
            <Search className="inbox-search-icon" />
            <input
              className="inbox-search-input"
              placeholder="Pesquisar conversas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Pesquisar conversas"
            />
            <button type="button" className="inbox-filter-btn" title="Filtros avançados" aria-label="Filtros avançados">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          <div className="inbox-tabs" role="tablist" aria-label="Filtrar conversas">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={filter === t.key}
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

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center gap-3">
                <div className="inbox-empty-icon">
                  <Inbox className="w-6 h-6" style={{ color: "var(--wa-muted)" }} />
                </div>
                <p className="text-[13px] leading-relaxed max-w-[220px]" style={{ color: "var(--wa-muted)" }}>
                  {loading ? "Carregando conversas..." : search ? "Nenhuma conversa encontrada para esta busca" : "Nenhuma conversa ativa no momento"}
                </p>
              </div>
            ) : (
              filtered.map((conv) => {
                const initials = getInitials(conv.contact.name, conv.contact.phone);
                const color = avatarColor(conv.id);
                const isActive = activeId === conv.id;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => void handleSelectConv(conv.id)}
                    className={`inbox-conv-item ${isActive ? "inbox-conv-item-active" : ""}`}
                  >
                    {/* Circular Avatar */}
                    <div
                      className="inbox-avatar flex-shrink-0"
                      style={{ background: `${color}22`, color }}
                    >
                      {initials}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 py-1">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[14px] font-medium truncate" style={{ color: "var(--wa-text)" }}>
                          {conv.contact.name ?? conv.contact.phone}
                        </span>
                        <span
                          className="text-[11px] flex-shrink-0 tabular-nums"
                          style={{ color: conv.unreadCount > 0 ? "#4ade80" : "var(--wa-muted)" }}
                        >
                          {relativeTime(conv.lastMessageAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] truncate flex-1 leading-normal" style={{ color: "var(--wa-muted)" }}>
                          {conv.isHandoff ? (
                            <span className="inbox-handoff-hint">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              Aguardando atendente
                            </span>
                          ) : (
                            conv.lastMessage ?? "Sem mensagens"
                          )}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="inbox-badge">
                            {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
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

        {/* ── Right Panel ── */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--wa-chat)" }}>
          {activeId && activeConv ? (
            <>
              <div className="inbox-chat-header">
                <div
                  className="inbox-chat-avatar"
                  style={{
                    background: `${avatarColor(activeConv.id)}22`,
                    color: avatarColor(activeConv.id),
                  }}
                >
                  {getInitials(activeConv.contact.name, activeConv.contact.phone)}
                </div>

                <div className="inbox-panel-header-text flex-1 min-w-0">
                  <p className="inbox-panel-header-title truncate">
                    {activeConv.contact.name ?? activeConv.contact.phone}
                  </p>
                  <p className="inbox-status-line">
                    {activeConv.isAssumed ? (
                      <>
                        <span className="inbox-status-dot inbox-status-dot--indigo" aria-hidden="true" />
                        Atendente humano ativo
                      </>
                    ) : activeConv.isHandoff ? (
                      <>
                        <span className="inbox-status-dot inbox-status-dot--amber" aria-hidden="true" />
                        Aguardando atendente humano
                      </>
                    ) : (
                      <>
                        <span className="inbox-status-dot inbox-status-dot--green" aria-hidden="true" />
                        IA respondendo automaticamente
                      </>
                    )}
                  </p>
                </div>

                {activeConv.isAssumed ? (
                  <button
                    type="button"
                    className="inbox-action-btn inbox-action-btn--indigo"
                    onClick={() => void handleRelease()}
                    title="Devolver ao bot"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Devolver ao bot
                  </button>
                ) : activeConv.isHandoff ? (
                  <button
                    type="button"
                    className="inbox-action-btn inbox-action-btn--green"
                    onClick={() => void handleAssume()}
                    title="Assumir conversa"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Assumir conversa
                  </button>
                ) : (
                  <button
                    type="button"
                    className="inbox-action-btn inbox-action-btn--amber"
                    onClick={() => void handleAssume()}
                    title="Pausar bot e assumir conversa"
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
                    Pausar bot
                  </button>
                )}

                <div className="inbox-chat-header-divider" />

                <div className="inbox-chat-header-actions">
                  <button type="button" className="inbox-topbar-btn" title="Pesquisar na conversa" aria-label="Pesquisar na conversa">
                    <Search className="w-[20px] h-[20px]" />
                  </button>
                  <button type="button" className="inbox-topbar-btn" title="Mais opções" aria-label="Mais opções">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Messages area with WhatsApp wallpaper */}
              <div className="inbox-chat-bg">
                {activeMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                    <div className="inbox-chat-empty-icon">
                      <MessageSquare className="w-10 h-10" style={{ color: "var(--wa-muted)" }} />
                    </div>
                    <p className="text-[13px]" style={{ color: "var(--wa-muted)" }}>Sem mensagens ainda</p>
                  </div>
                ) : (
                  <div className="inbox-messages">
                    {activeMessages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        direction={msg.direction}
                        type={msg.type}
                        {...(msg.text !== undefined ? { text: msg.text } : {})}
                        {...(msg.imageUrl !== undefined ? { imageUrl: msg.imageUrl } : {})}
                        {...(msg.audioUrl !== undefined ? { audioUrl: msg.audioUrl } : {})}
                        {...(msg.documentUrl !== undefined ? { documentUrl: msg.documentUrl } : {})}
                        {...(msg.documentName !== undefined ? { documentName: msg.documentName } : {})}
                        isFromAi={msg.isFromAi}
                        sentAt={msg.sentAt}
                        {...(msg.messageStatus !== undefined ? { messageStatus: msg.messageStatus } : {})}
                      />
                    ))}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {activeConv.isAssumed ? (
                <div className="inbox-input-bar">
                  <button type="button" className="inbox-input-icon-btn" title="Emoji" aria-label="Emoji">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                    </svg>
                  </button>
                  <div className="inbox-input-inner">
                    <textarea
                      className="inbox-input-textarea"
                      rows={1}
                      placeholder="Digite uma mensagem"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                      aria-label="Mensagem"
                    />
                  </div>
                  <button
                    type="button"
                    className={`inbox-input-mic ${draft.trim() ? "inbox-input-mic--active" : ""}`}
                    title="Enviar mensagem"
                    aria-label="Enviar mensagem"
                    onClick={() => void handleSend()}
                  >
                    <SendHorizonal width={20} height={20} color="white" />
                  </button>
                </div>
              ) : (
                <div className="inbox-input-bar">
                  <button type="button" className="inbox-input-icon-btn" title="Emoji" aria-label="Emoji">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                    </svg>
                  </button>

                  <div className="inbox-input-inner inbox-input-status">
                    {activeConv.isHandoff ? (
                      <>
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#fbbf24" }} />
                        <span>Aguardando atendente humano — clique em &ldquo;Assumir conversa&rdquo;</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#4ade80" }} />
                        <span>Agente IA respondendo automaticamente</span>
                      </>
                    )}
                  </div>

                  <button type="button" className="inbox-input-icon-btn" title="Anexar" aria-label="Anexar arquivo">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                      <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
                    </svg>
                  </button>

                  <button type="button" className="inbox-input-mic" title="Mensagem de voz" aria-label="Mensagem de voz">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style={{ color: "var(--wa-icon)" }}>
                      <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V6zm6.5 6c0 3-2.54 5.1-5.5 5.1S6.5 15 6.5 12H5c0 3.41 2.72 6.23 6 6.72V22h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.5z"/>
                    </svg>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="inbox-chat-bg flex-1 flex items-center justify-center">
              <div className="inbox-empty-state">
                <div className="inbox-empty-state-logo">
                  <svg viewBox="0 0 39 39" width="48" height="48" fill="none">
                    <path fillRule="evenodd" clipRule="evenodd"
                      d="M19.5 0C8.73 0 0 8.73 0 19.5 0 23.08 1.02 26.42 2.79 29.23L0 39l10.05-2.63A19.43 19.43 0 0 0 19.5 39C30.27 39 39 30.27 39 19.5S30.27 0 19.5 0z"
                      fill="#22c55e" />
                    <path fillRule="evenodd" clipRule="evenodd"
                      d="M29.36 23.74c-.38-.19-2.24-1.1-2.59-1.23-.35-.13-.6-.19-.86.19-.25.38-1 1.23-1.22 1.49-.23.25-.45.28-.83.09-.38-.19-1.6-.59-3.04-1.88a11.4 11.4 0 0 1-2.1-2.63c-.22-.38 0-.58.17-.77.15-.17.34-.44.5-.66.17-.22.23-.38.35-.63.12-.25.06-.47-.03-.66-.1-.19-.86-2.07-1.18-2.83-.31-.74-.63-.64-.86-.65h-.74c-.25 0-.66.1-.1.38-.35.98-1.32 2.85 1.25 4.5a11.8 11.8 0 0 0 4.56 4.07c.57.25 1.01.4 1.36.5.57.19 1.09.16 1.5.1.46-.07 1.4-.57 1.6-1.13.2-.56.2-1.04.14-1.13-.07-.1-.25-.16-.53-.28z"
                      fill="white" />
                  </svg>
                </div>
                <div>
                  <p className="inbox-empty-state-title">WhatsAgent</p>
                  <p className="inbox-empty-state-desc">
                    Selecione uma conversa na lista ao lado para visualizar mensagens e interagir com seus clientes.
                  </p>
                </div>
                <div className="inbox-empty-state-badge">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                  </svg>
                  Mensagens protegidas end-to-end via Meta Cloud API
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
