"use client";
import { Header } from "@/components/layout/Header";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { useSocketStatus } from "@/shared/realtime/socket-status.store";
import {
  useConversations,
  useMessages,
  useAssumeConversation,
  useReleaseConversation,
  markConversationRead,
  applyOptimisticMessage,
  markOptimisticFailed,
  sendConversationMessage,
} from "@/features/inbox/api/queries";
import { useTypingStore } from "@/features/inbox/model/typing.store";
import { useStreamStore } from "@/features/inbox/model/stream.store";
import { ConversationsSidebar, type FilterTab } from "@/features/inbox/components/ConversationsSidebar";
import { ChatHeader } from "@/features/inbox/components/ChatHeader";
import { MessagesPanel } from "@/features/inbox/components/MessagesPanel";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const queryClient = useQueryClient();
  const assumeConversation = useAssumeConversation();
  const releaseConversation = useReleaseConversation();

  const [activeId, setActiveId] = useState<string | null>(null);

  const conversationsQuery = useConversations();
  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data]);
  const loading = conversationsQuery.isPending;

  const messagesQuery = useMessages(activeId);
  const activeMessages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

  const socketStatus = useSocketStatus((s) => s.status);
  const isAiTyping = useTypingStore((s) => (activeId ? (s.typing[activeId] ?? false) : false));
  const streamBubble = useStreamStore((s) => (activeId ? s.byConversation[activeId] : undefined));
  const showStreamText = Boolean(streamBubble && streamBubble.text.length > 0);
  const showTyping =
    (isAiTyping && !streamBubble) ||
    Boolean(streamBubble && streamBubble.status === "streaming" && streamBubble.text.length === 0);

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId],
  );

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const handledConvRef = useRef<string | null>(null);

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

  const handleAssume = useCallback(() => {
    if (!activeId) return;
    assumeConversation.mutate(activeId);
  }, [activeId, assumeConversation]);

  const handleRelease = useCallback(() => {
    if (!activeId) return;
    releaseConversation.mutate(activeId);
  }, [activeId, releaseConversation]);

  const handleSend = useCallback(async () => {
    if (!activeId || !draft.trim() || sending) return;
    const text = draft.trim();
    // Optimistic: o balão aparece na hora; o echo do socket reconcilia depois.
    const tempId = applyOptimisticMessage(queryClient, activeId, text);
    setDraft("");
    setSending(true);
    try {
      await sendConversationMessage(activeId, text);
    } catch (err) {
      markOptimisticFailed(queryClient, activeId, tempId);
      console.error("[handleSend] falha de rede:", err);
    } finally {
      setSending(false);
    }
  }, [activeId, draft, sending, queryClient]);

  return (
    <div className="flex h-full flex-col">
      <Header title="Conversas" subtitle="Inbox unificado em tempo real" />
      <div className="flex flex-1 overflow-hidden">
        <ConversationsSidebar
          conversations={conversations}
          filtered={filtered}
          activeId={activeId}
          loading={loading}
          socketStatus={socketStatus}
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
          onSelect={handleSelectConv}
          onRefresh={loadConversations}
        />

        {/* ── Right Panel ── */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--wa-chat)" }}>
          {activeId && activeConv ? (
            <>
              <ChatHeader conversation={activeConv} onAssume={handleAssume} onRelease={handleRelease} />

              <MessagesPanel
                activeId={activeId}
                activeMessages={activeMessages}
                messagesQuerySuccess={messagesQuery.isSuccess}
                showStreamText={showStreamText}
                streamBubble={streamBubble}
                showTyping={showTyping}
              />

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
