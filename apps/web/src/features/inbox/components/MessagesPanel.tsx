"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageSquare, RefreshCw, ChevronUp } from "lucide-react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import {
  fetchMessagesPage,
  prependOlderMessages,
  MESSAGES_PAGE_SIZE,
  type InboxMessage,
} from "@/features/inbox/api/queries";
import type { StreamBubble } from "@/features/inbox/model/stream.store";

interface Props {
  activeId: string;
  activeMessages: InboxMessage[];
  messagesQuerySuccess: boolean;
  showStreamText: boolean;
  streamBubble: StreamBubble | undefined;
  showTyping: boolean;
}

export function MessagesPanel({
  activeId,
  activeMessages,
  messagesQuerySuccess,
  showStreamText,
  streamBubble,
  showTyping,
}: Props) {
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // scrollHeight capturado antes de um prepend, para restaurar a posição depois.
  const restoreScrollRef = useRef<number | null>(null);

  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const lastMessageId = activeMessages[activeMessages.length - 1]?.id;

  // Virtualização da lista de mensagens (S3): só renderiza balões visíveis + overscan,
  // mesmo com histórico longo. Chaveado por id para manter cache de medição estável
  // durante prepends de mensagens antigas.
  const rowVirtualizer = useVirtualizer({
    count: activeMessages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
    getItemKey: (index) => activeMessages[index]?.id ?? index,
  });

  // Auto-scroll ao fim só quando entra mensagem nova no rodapé (muda o último id)
  // ou troca de conversa. Prepend de antigas não altera o último id → não puxa.
  useEffect(() => {
    if (restoreScrollRef.current != null) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessageId, activeId, showTyping, streamBubble?.text, streamBubble?.streamId]);

  // Restaura a posição de leitura após prepend de mensagens antigas.
  useLayoutEffect(() => {
    if (restoreScrollRef.current == null || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollTop = el.scrollHeight - restoreScrollRef.current;
    restoreScrollRef.current = null;
  }, [activeMessages]);

  // Estima se há mensagens anteriores quando uma conversa é aberta (página cheia).
  useEffect(() => {
    setHasMoreOlder(activeMessages.length >= MESSAGES_PAGE_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, messagesQuerySuccess]);

  const handleLoadOlder = useCallback(async () => {
    if (loadingOlder) return;
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

  return (
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
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const msg = activeMessages[virtualRow.index];
              if (!msg) return null;
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: 5,
                  }}
                >
                  <MessageBubble
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
                </div>
              );
            })}
          </div>
          {showStreamText && streamBubble && (
            <MessageBubble
              key={`stream-${streamBubble.streamId}`}
              direction="outbound"
              type="text"
              text={streamBubble.text}
              isFromAi
              sentAt={new Date().toISOString()}
            />
          )}
          {showTyping && (
            <div className="inbox-typing" aria-live="polite" aria-label="IA digitando">
              <span className="inbox-typing-label">IA digitando</span>
              <span className="inbox-typing-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
