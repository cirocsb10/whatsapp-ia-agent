"use client";
import { cn } from "@/lib/utils";
import { Bot, FileText, Download } from "lucide-react";
import { useState } from "react";

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

export function MessageBubble({
  direction, type, text, imageUrl, audioUrl, documentUrl, documentName, isFromAi, sentAt,
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
}) {
  const isInbound = direction === "inbound";
  const time = new Date(sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const [lightbox, setLightbox] = useState<string | null>(null);

  const bubbleClass = isInbound ? "bubble-inbound" : isFromAi ? "bubble-ai" : "bubble-outbound";

  const Meta = () => (
    <div className="bubble-meta">
      {!isInbound && isFromAi && (
        <Bot width={11} height={11} style={{ color: "rgba(134,150,160,0.6)", flexShrink: 0 }} />
      )}
      <span className="bubble-time">{time}</span>
      {!isInbound && (
        <svg viewBox="0 0 18 11" width="16" height="11" fill="none">
          <path d="M1 5.5L5 9.5L12.5 1" stroke="#53bdeb" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 9.5L13 1" stroke="#53bdeb" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );

  /* ── Image ── */
  if (type === "image" && imageUrl) {
    return (
      <>
        {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
        <div className={cn("flex mb-[2px]", isInbound ? "justify-start" : "justify-end")}>
          <div className={cn("max-w-[60%] min-w-[120px]", isInbound ? "ml-[8px]" : "mr-[8px]")}>
            <div className={cn(bubbleClass, "!p-[3px]")}>
              <img
                src={imageUrl}
                alt="imagem"
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
      <div className={cn("flex mb-[2px]", isInbound ? "justify-start" : "justify-end")}>
        <div className={cn("max-w-[65%] min-w-[220px]", isInbound ? "ml-[8px]" : "mr-[8px]")}>
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
      <div className={cn("flex mb-[2px]", isInbound ? "justify-start" : "justify-end")}>
        <div className={cn("max-w-[65%] min-w-[200px]", isInbound ? "ml-[8px]" : "mr-[8px]")}>
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
  return (
    <div className={cn("flex mb-[2px]", isInbound ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[65%] min-w-[80px]", isInbound ? "ml-[8px]" : "mr-[8px]")}>
        <div className={bubbleClass}>
          {text ? (
            <p className="bubble-text">{text}</p>
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
