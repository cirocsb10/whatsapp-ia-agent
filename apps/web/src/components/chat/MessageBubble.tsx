"use client";
import { getEmojiOnlyVariant } from "@/lib/emoji";
import { cn } from "@/lib/utils";
import { Bot, FileText, Download } from "lucide-react";
import { memo, useState } from "react";

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-5 text-white/70 hover:text-white text-3xl leading-none"
        onClick={onClose}
      >
        ×
      </button>
      <img
        src={src}
        alt="imagem"
        className="max-w-[90vw] max-h-[88vh] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function AudioPlayer({ src }: { src: string }) {
  return (
    <audio
      controls
      src={src}
      className="wa-audio-player"
      preload="metadata"
    />
  );
}

function MessageBubbleComponent({
  direction, type, text, imageUrl, audioUrl, documentUrl, documentName, isFromAi, sentAt, messageStatus,
}: {
  direction: "inbound" | "outbound";
  type: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  documentUrl?: string;
  documentName?: string;
  isFromAi?: boolean;
  sentAt: string;
  messageStatus?: "sent" | "delivered" | "read" | "failed";
}) {
  const isInbound = direction === "inbound";
  const time = new Date(sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const [lightbox, setLightbox] = useState<string | null>(null);

  const bubbleClass = isInbound ? "bubble-inbound" : isFromAi ? "bubble-ai" : "bubble-outbound";

  const StatusIcon = () => {
    if (isInbound) return null;
    const status = messageStatus ?? "sent";
    if (status === "failed") {
      return (
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#e53935" strokeWidth="1.5" />
          <path d="M8 4v5M8 10.5v1" stroke="#e53935" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    }
    if (status === "sent") {
      return (
        <svg viewBox="0 0 12 11" width="14" height="11" fill="none">
          <path d="M1 5.5L5 9.5L11 1" stroke="rgba(134,150,160,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    const tickColor = status === "read" ? "#53bdeb" : "rgba(134,150,160,0.7)";
    return (
      <svg viewBox="0 0 21 11" width="19" height="11" fill="none">
        <path d="M1 5.5L4.5 9.5L10.5 1" stroke={tickColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.5 5.5L11 9.5L17 1" stroke={tickColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const Meta = () => (
    <div className="bubble-meta">
      {!isInbound && isFromAi && (
        <Bot width={11} height={11} style={{ color: "rgba(134,150,160,0.6)", flexShrink: 0 }} />
      )}
      <span className="bubble-time">{time}</span>
      <StatusIcon />
    </div>
  );

  /* ── Image ── */
  if (type === "image" && imageUrl) {
    return (
      <>
        {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
        <div className={cn("bubble-row", isInbound ? "bubble-row--inbound" : "bubble-row--outbound")}>
          <div className={cn("max-w-[72%] min-w-[120px]", isInbound ? "ml-1" : "mr-1")}>
            <div className={cn(bubbleClass, "!p-[3px]")}>
              <img
                src={imageUrl}
                alt="imagem"
                loading="lazy"
                decoding="async"
                className="w-full rounded-[5px] cursor-pointer object-cover max-h-[280px]"
                onClick={() => setLightbox(imageUrl)}
              />
              {text && (
                <p className="bubble-text px-[6px] pt-[4px]">{text}</p>
              )}
              <Meta />
              <div className="clear-both" />
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Audio ── */
  if (type === "audio" && audioUrl) {
    return (
      <div className={cn("bubble-row", isInbound ? "bubble-row--inbound" : "bubble-row--outbound")}>
        <div className={cn("max-w-[72%] min-w-[220px]", isInbound ? "ml-1" : "mr-1")}>
          <div className={bubbleClass}>
            <AudioPlayer src={audioUrl} />
            <Meta />
            <div className="clear-both" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Document ── */
  if (type === "document" && documentUrl) {
    const name = documentName ?? "Documento";
    const ext = name.split(".").pop()?.toUpperCase() ?? "FILE";
    return (
      <div className={cn("bubble-row", isInbound ? "bubble-row--inbound" : "bubble-row--outbound")}>
        <div className={cn("max-w-[72%] min-w-[200px]", isInbound ? "ml-1" : "mr-1")}>
          <div className={bubbleClass}>
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 no-underline mb-[6px]"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(134,150,160,0.15)" }}>
                <FileText width={20} height={20} style={{ color: "var(--wa-icon)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="bubble-text truncate font-medium">{name}</p>
                <p className="text-[11px]" style={{ color: "rgba(134,150,160,0.7)", margin: 0 }}>{ext}</p>
              </div>
              <Download width={16} height={16} style={{ color: "var(--wa-icon)", flexShrink: 0 }} />
            </a>
            <Meta />
            <div className="clear-both" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Text (default) ── */
  const emojiVariant = text ? getEmojiOnlyVariant(text) : null;

  return (
    <div className={cn("bubble-row", isInbound ? "bubble-row--inbound" : "bubble-row--outbound")}>
      <div className={cn("max-w-[72%] min-w-[80px]", isInbound ? "ml-1" : "mr-1")}>
        <div className={cn(bubbleClass, emojiVariant && `bubble--emoji-only bubble--emoji-${emojiVariant}`)}>
          {text ? (
            <p className={cn("bubble-text", emojiVariant && "bubble-text--emoji-only")}>{text}</p>
          ) : (
            <p className="bubble-text" style={{ opacity: 0.6 }}>
              {type === "audio" ? "🎤 Mensagem de voz" : type === "image" ? "🖼 Imagem" : "📎 Mídia"}
            </p>
          )}
          <Meta />
          <div className="clear-both" />
        </div>
      </div>
    </div>
  );
}

/**
 * Memoizado (plano §3.2): cada mensagem nova via socket re-renderiza só o balão novo,
 * não a lista inteira. Props são primitivas/estáveis por mensagem.
 */
export const MessageBubble = memo(MessageBubbleComponent);
