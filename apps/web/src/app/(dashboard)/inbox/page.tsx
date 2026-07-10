"use client";
import { Header } from "@/components/layout/Header";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { useApi } from "@/lib/hooks/useApi";
import { useSocketStatus } from "@/shared/realtime/socket-status.store";
import {
  useConversations,
  useMessages,
  markConversationRead,
  applyOptimisticMessage,
  markOptimisticFailed,
  fetchMessagesPage,
  prependOlderMessages,
  MESSAGES_PAGE_SIZE,
} from "@/features/inbox/api/queries";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Search, Phone, Inbox, UserCheck, RotateCcw, PauseCircle, RefreshCw, SlidersHorizontal, ChevronUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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
  // Socket vive no RealtimeProvider (S7); server-state via TanStack Query (F3).
  const router = useRouter();
  const searchParams = useSearchParams();
  const convFromUrl = searchParams.get("conv");
  const { apiFetch } = useApi();
  const queryClient = useQueryClient();

  const [activeId, setActiveId] = useState<string | null>(null);

  const conversationsQuery = useConversations();
  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data]);
  const loading = conversationsQuery.isPending;

  const messagesQuery = useMessages(activeId);
  const activeMessages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

  const socketStatus = useSocketStatus((s) => s.status);

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId],
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // scrollHeight capturado antes de um prepend, para restaurar a posição depois.
  const restoreScrollRef = useRef<number | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const handledConvRef = useRef<string | null>(null);

  const lastMessageId = activeMessages[activeMessages.length - 1]?.id;

  const loadConversations = useCallback(() => {
    void conversationsQuery.refetch();
  }, [conversationsQuery]);

  useEffect(() => {
    if (!convFromUrl || loading) return;
    if (handledConvRef.current === convFromUrl) return;

    const match = conversations.find((c) => c.id === convFromUrl);
    if (!match) return;

    handledConvRef.current = convFromUrl;

    // useMessages busca as mensagens automaticamente ao mudar activeId.
    setActiveId(convFromUrl);
    markConversationRead(queryClient, convFromUrl);
    setDraft("");
    router.replace("/inbox", { scroll: false });
  }, [convFromUrl, loading, conversations, router, queryClient]);

  // Auto-scroll ao fim só quando entra mensagem nova no rodapé (muda o último id)
  // ou troca de conversa. Prepend de antigas não altera o último id → não puxa.
  useEffect(() => {
    if (restoreScrollRef.current != null) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessageId, activeId]);

  // Restaura a posição de leitura após prepend de mensagens antigas.
  useLayoutEffect(() => {
    if (restoreScrollRef.current == null || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollTop = el.scrollHeight - restoreScrollRef.current;
    restoreScrollRef.current = null;
  }, [activeMessages]);

  // Estima se há mensagens anteriores quando uma conversa é aberta (página cheia).
  useEffect(() => {
    if (!activeId) return;
    setHasMoreOlder(activeMessages.length >= MESSAGES_PAGE_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, messagesQuery.isSuccess]);

  const handleLoadOlder = useCallback(async () => {
    if (!activeId || loadingOlder) return;
    const oldest = activeMessages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const page = await fetchMessagesPage(activeId, {
        limit: MESSAGES_PAGE_SIZE,
        before: oldest.sentAt,
      });
      // Captura a altura antes do prepend para restaurar a posição (useLayoutEffect).
      restoreScrollRef.current = scrollRef.current?.scrollHeight ?? 0;
      prependOlderMessages(queryClient, activeId, page.messages);
      setHasMoreOlder(page.hasMore);
    } finally {
      setLoadingOlder(false);
    }
  }, [activeId, activeMessages, loadingOlder, queryClient]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const matchSearch =
        !search ||
        (c.contact.name ?? "").toLowerCase().includes(q) ||
        c.contact.phone.includes(search);
      const matchFilter =
        filter === "all" ||
        (filter === "ai" && !c.isHandoff) ||
        (filter === "handoff" && c.isHandoff);
      return matchSearch && matchFilter;
    });
  }, [conversations, search, filter]);

  const handleSelectConv = useCallback(
    (id: string) => {
      // useMessages(activeId) dispara o fetch (com cache) ao mudar o id.
      setActiveId(id);
      markConversationRead(queryClient, id);
      setDraft("");
    },
    [queryClient],
  );

  const handleAssume = useCallback(async () => {
    if (!activeId) return;
    await apiFetch(`/conversations/${activeId}/assume`, { method: "PATCH" });
  }, [activeId, apiFetch]);

  const handleRelease = useCallback(async () => {
    if (!activeId) return;
    await apiFetch(`/conversations/${activeId}/release`, { method: "PATCH" });
  }, [activeId, apiFetch]);

  const handleSend = useCallback(async () => {
    if (!activeId || !draft.trim() || sending) return;
    const text = draft.trim();
    // Optimistic: o balão aparece na hora; o echo do socket reconcilia depois.
    const tempId = applyOptimisticMessage(queryClient, activeId, text);
    setDraft("");
    setSending(true);
    try {
      const res = await apiFetch(`/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        markOptimisticFailed(queryClient, activeId, tempId);
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        console.error("[handleSend] erro:", res.status, body);
      }
    } catch (err) {
      markOptimisticFailed(queryClient, activeId, tempId);
      console.error("[handleSend] falha de rede:", err);
    } finally {
      setSending(false);
    }
  }, [activeId, draft, sending, apiFetch, queryClient]);

  const tabs: { key: FilterTab; label: string; count: number }[] = useMemo(
    () => [
      { key: "all", label: "Todas", count: conversations.length },
      { key: "ai", label: "IA Ativa", count: conversations.filter((c) => !c.isHandoff).length },
      { key: "handoff", label: "Handoff", count: conversations.filter((c) => c.isHandoff).length },
    ],
    [conversations],
  );

  return (
    <div className="flex h-full flex-col">
      <Header title="Conversas" subtitle="Inbox unificado em tempo real" />
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel ── */}
        <aside className="inbox-sidebar">
          <div className="inbox-topbar">
            <div className="inbox-topbar-brand">
              <div className="inbox-topbar-avatar">
                <svg className="inbox-topbar-avatar-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                  />
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
                              {conv.isAssumed ? "Atendente humano ativo" : "Aguardando atendente"}
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
              <div className="inbox-chat-bg" ref={scrollRef}>
                {activeMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                    <div className="inbox-chat-empty-icon">
                      <MessageSquare className="w-10 h-10" style={{ color: "var(--wa-muted)" }} />
                    </div>
                    <p className="text-[13px]" style={{ color: "var(--wa-muted)" }}>Sem mensagens ainda</p>
                  </div>
                ) : (
                  <div className="inbox-messages">
                    {hasMoreOlder && (
                      <div className="flex justify-center py-2">
                        <button
                          type="button"
                          onClick={() => void handleLoadOlder()}
                          disabled={loadingOlder}
                          className="inbox-load-older-btn"
                        >
                          {loadingOlder ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ChevronUp className="w-3.5 h-3.5" />
                          )}
                          {loadingOlder ? "Carregando…" : "Carregar mensagens anteriores"}
                        </button>
                      </div>
                    )}
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
