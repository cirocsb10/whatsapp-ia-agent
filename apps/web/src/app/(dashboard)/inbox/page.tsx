"use client";
import { Header } from "@/components/layout/Header";
import { useSocket } from "@/hooks/useSocket";
import { useInboxStore } from "@/lib/store/inbox.store";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { useApi } from "@/lib/hooks/useApi";
import { MessageSquare, Search, Phone, Inbox, UserCheck, RotateCcw, PauseCircle, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

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
  return (
    <Suspense fallback={
      <div className="flex h-full flex-col">
        <Header title="Conversas" subtitle="Inbox unificado em tempo real" />
        <div className="flex flex-1 items-center justify-center text-[13px] text-[#64748b]">
          Carregando inbox…
        </div>
      </div>
    }>
      <InboxContent />
    </Suspense>
  );
}

function InboxContent() {
  useSocket();
  const router = useRouter();
  const searchParams = useSearchParams();
  const convFromUrl = searchParams.get("conv");
  const { apiFetch } = useApi();
  const conversations = useInboxStore((s) => s.conversations);
  const messages = useInboxStore((s) => s.messages);
  const activeId = useInboxStore((s) => s.activeConversationId);
  const setConversations = useInboxStore((s) => s.setConversations);
  const setMessages = useInboxStore((s) => s.setMessages);
  const setActive = useInboxStore((s) => s.setActiveConversation);
  const markAsRead = useInboxStore((s) => s.markAsRead);
  const socketStatus = useInboxStore((s) => s.socketStatus);
  const activeMessages = activeId ? (messages[activeId] ?? []) : [];
  const activeConv = conversations.find((c) => c.id === activeId);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const handledConvRef = useRef<string | null>(null);

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
    if (!convFromUrl || loading) return;
    if (handledConvRef.current === convFromUrl) return;

    const match = conversations.find((c) => c.id === convFromUrl);
    if (!match) return;

    handledConvRef.current = convFromUrl;

    void (async () => {
      setActive(convFromUrl);
      markAsRead(convFromUrl);
      setDraft("");
      if (!messages[convFromUrl]?.length) {
        const res = await apiFetch(`/conversations/${convFromUrl}/messages`);
        if (res.ok) setMessages(convFromUrl, await res.json());
      }
      router.replace("/inbox", { scroll: false });
    })();
  }, [convFromUrl, loading, conversations, messages, apiFetch, markAsRead, router, setActive, setMessages]);

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
    if (!activeId || !draft.trim() || sending) return;
    const text = draft.trim();
    setSending(true);
    try {
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
    } finally {
      setSending(false);
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
                  <span
                    className={`inbox-status-dot ${
                      socketStatus === "connected" ? "inbox-status-dot--green" :
                      socketStatus === "reconnecting" ? "inbox-status-dot--amber" :
                      "inbox-status-dot--red"
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className="inbox-topbar-status"
                    style={{
                      color: socketStatus === "connected" ? "#4ade80" :
                             socketStatus === "reconnecting" ? "#fbbf24" :
                             "#ef4444",
                    }}
                  >
                    {socketStatus === "connected" ? "Conectado" :
                     socketStatus === "reconnecting" ? "Reconectando…" :
                     "Desconectado"}
                  </span>
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

          <div className="inbox-conv-list">
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
                    className={`inbox-conv-item${isActive ? " inbox-conv-item-active" : ""}${conv.unreadCount > 0 ? " inbox-conv-item-unread" : ""}`}
                  >
                    <div
                      className="inbox-avatar"
                      style={{ "--avatar-color": color } as React.CSSProperties}
                    >
                      {initials}
                    </div>

                    <div className="inbox-conv-body">
                      <div className="inbox-conv-row">
                        <span className="inbox-conv-name">
                          {conv.contact.name ?? conv.contact.phone}
                        </span>
                        <span className={`inbox-conv-time${conv.unreadCount > 0 ? " inbox-conv-time-unread" : ""}`}>
                          {relativeTime(conv.lastMessageAt)}
                        </span>
                      </div>

                      <div className="inbox-conv-row">
                        <p className="inbox-conv-preview">
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
                <ChatInputBar
                  mode="active"
                  draft={draft}
                  onDraftChange={setDraft}
                  onSend={() => void handleSend()}
                  sending={sending}
                />
              ) : (
                <ChatInputBar mode="status" isHandoff={activeConv.isHandoff} />
              )}
            </>
          ) : (
            <div className="inbox-chat-bg flex-1 flex items-center justify-center">
              <div className="inbox-empty-state">
                <div className="inbox-empty-state-logo">
                  <MessageSquare strokeWidth={1.5} aria-hidden="true" />
                </div>
                <div>
                  <p className="inbox-empty-state-title">WhatsAgent</p>
                  <p className="inbox-empty-state-desc">
                    Selecione uma conversa na lista ao lado para visualizar mensagens e interagir com seus clientes.
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
