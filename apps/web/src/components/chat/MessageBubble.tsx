import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";

export function MessageBubble({ direction, type, text, isFromAi, sentAt }: {
  direction: "inbound" | "outbound";
  type: string;
  text?: string;
  audioUrl?: string;
  isFromAi?: boolean;
  sentAt: string;
}) {
  const isInbound = direction === "inbound";
  const time = new Date(sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={cn("flex mb-1", isInbound ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[65%] min-w-[80px]", isInbound ? "ml-2" : "mr-2")}>
        <div className={cn(
          "px-3 py-2 text-[14px] leading-[1.4]",
          isInbound ? "bubble-inbound" : isFromAi ? "bubble-ai" : "bubble-outbound"
        )}>
          <p className="whitespace-pre-wrap break-words">{text || (type === "audio" ? "🎤 Áudio" : "📎 Mídia")}</p>
          {/* Timestamp row inside bubble */}
          <div className={cn("flex items-center gap-1 mt-1 float-right ml-3 -mb-0.5 clear-right")}>
            {!isInbound && isFromAi && (
              <Bot className="w-3 h-3" style={{ color: "rgba(134,150,160,0.7)" }} />
            )}
            <span className="text-[11px] leading-none whitespace-nowrap" style={{ color: "rgba(134,150,160,0.8)" }}>
              {time}
            </span>
            {!isInbound && (
              /* WhatsApp double-check delivered indicator */
              <svg viewBox="0 0 16 11" width="14" height="14" style={{ color: "rgba(134,150,160,0.7)" }}>
                <path fill="currentColor" d="M11.071.653a.45.45 0 0 0-.63 0L4.5 6.595 1.559 3.653a.45.45 0 1 0-.636.636l3.25 3.25a.45.45 0 0 0 .636 0L11.07 1.29a.45.45 0 0 0 0-.636zm2 0a.45.45 0 0 0-.63 0L6.5 6.595l-.345-.345a.45.45 0 0 0-.636.636l.663.663a.45.45 0 0 0 .636 0L13.07 1.29a.45.45 0 0 0 0-.636z" />
              </svg>
            )}
          </div>
          <div className="clear-both" />
        </div>
      </div>
    </div>
  );
}
