"use client";

import { Bot, Keyboard, Paperclip, Phone, SendHorizonal, Smile } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmojiPickerPanel } from "./EmojiPickerPanel";

type ActiveProps = {
  mode: "active";
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
};

type StatusProps = {
  mode: "status";
  isHandoff: boolean;
};

type Props = ActiveProps | StatusProps;

function useAutoResizeTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  return ref;
}

export function ChatInputBar(props: Props) {
  const [emojiOpen, setEmojiOpen] = useState(false);

  const draft = props.mode === "active" ? props.draft : "";
  const textareaRef = useAutoResizeTextarea(draft);

  const insertEmoji = useCallback(
    (emoji: string) => {
      if (props.mode !== "active") return;
      const el = textareaRef.current;
      const current = props.draft;
      if (!el) {
        props.onDraftChange(current + emoji);
        return;
      }
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      const next = current.slice(0, start) + emoji + current.slice(end);
      props.onDraftChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [props, textareaRef],
  );

  const toggleEmoji = () => {
    setEmojiOpen((v) => !v);
    if (emojiOpen) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const handleSend = () => {
    if (props.mode !== "active" || !props.draft.trim() || props.sending) return;
    setEmojiOpen(false);
    props.onSend();
  };

  const canSend = props.mode === "active" && !!props.draft.trim() && !props.sending;

  return (
    <div className="inbox-composer">
      {props.mode === "active" && (
        <EmojiPickerPanel
          open={emojiOpen}
          onSelect={insertEmoji}
          onClose={() => setEmojiOpen(false)}
        />
      )}

      <div className={`inbox-input-bar ${emojiOpen ? "inbox-input-bar--emoji-open" : ""}`}>
        <button
          type="button"
          data-emoji-trigger
          className={`inbox-input-icon-btn ${emojiOpen ? "inbox-input-icon-btn--active" : ""}`}
          title={emojiOpen ? "Teclado" : "Emoji"}
          aria-label={emojiOpen ? "Fechar emojis e abrir teclado" : "Abrir emojis"}
          aria-expanded={props.mode === "active" ? emojiOpen : undefined}
          disabled={props.mode === "status"}
          onClick={() => {
            if (props.mode === "active") toggleEmoji();
          }}
        >
          {emojiOpen && props.mode === "active" ? (
            <Keyboard className="w-[22px] h-[22px]" strokeWidth={1.75} />
          ) : (
            <Smile className="w-[22px] h-[22px]" strokeWidth={1.75} />
          )}
        </button>

        {props.mode === "active" ? (
          <>
            <div className="inbox-input-inner">
              <textarea
                ref={textareaRef}
                className="inbox-input-textarea"
                rows={1}
                placeholder="Digite uma mensagem"
                value={props.draft}
                onChange={(e) => props.onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                onFocus={() => setEmojiOpen(false)}
                aria-label="Mensagem"
              />
            </div>

            {!canSend && (
              <button
                type="button"
                className="inbox-input-icon-btn inbox-input-icon-btn--attach"
                title="Anexar"
                aria-label="Anexar arquivo"
              >
                <Paperclip className="w-[20px] h-[20px]" strokeWidth={1.75} />
              </button>
            )}

            <button
              type="button"
              className={`inbox-input-send ${canSend ? "inbox-input-send--active" : "inbox-input-send--mic"}`}
              title={canSend ? "Enviar mensagem" : "Mensagem de voz"}
              aria-label={canSend ? "Enviar mensagem" : "Mensagem de voz"}
              disabled={props.sending}
              onClick={() => {
                if (canSend) handleSend();
              }}
            >
              {canSend ? (
                <SendHorizonal width={20} height={20} color="white" strokeWidth={2} />
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                  <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V6zm6.5 6c0 3-2.54 5.1-5.5 5.1S6.5 15 6.5 12H5c0 3.41 2.72 6.23 6 6.72V22h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.5z" />
                </svg>
              )}
            </button>
          </>
        ) : (
          <>
            <div className="inbox-input-inner inbox-input-status">
              {props.isHandoff ? (
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

            <button type="button" className="inbox-input-icon-btn inbox-input-icon-btn--attach" title="Anexar" aria-label="Anexar arquivo" disabled>
              <Paperclip className="w-[20px] h-[20px]" strokeWidth={1.75} />
            </button>

            <button type="button" className="inbox-input-send inbox-input-send--mic" title="Mensagem de voz" aria-label="Mensagem de voz" disabled>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V6zm6.5 6c0 3-2.54 5.1-5.5 5.1S6.5 15 6.5 12H5c0 3.41 2.72 6.23 6 6.72V22h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.5z" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
