import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

export function MessageBubble({ direction, type, text, audioUrl, isFromAi, sentAt }: { direction: "inbound" | "outbound"; type: string; text?: string; audioUrl?: string; isFromAi?: boolean; sentAt: string }) {
  const isInbound = direction === "inbound";
  const time = new Date(sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={cn("flex gap-2 mb-3", isInbound ? "justify-start" : "justify-end")}>
      {isInbound && <div className="shrink-0 w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center mt-1"><User className="w-4 h-4 text-slate-300" /></div>}
      <div className="max-w-[75%]">
        <div className={cn("px-3.5 py-2.5 text-sm leading-relaxed", isInbound ? "bubble-inbound" : isFromAi ? "bubble-ai" : "bubble-outbound")}><p className="whitespace-pre-wrap break-words">{text || (type === "audio" ? "[Áudio]" : "[Mídia]")}</p></div>
        <div className={cn("flex items-center gap-1 mt-0.5 px-1", isInbound ? "justify-start" : "justify-end")}>
          {!isInbound && isFromAi && <Bot className="w-3 h-3 text-indigo-400" />}
          <span className="text-[10px] text-slate-600">{time}</span>
        </div>
      </div>
      {!isInbound && <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mt-1">{isFromAi ? <Bot className="w-4 h-4 text-indigo-400" /> : <User className="w-4 h-4 text-indigo-300" />}</div>}
    </div>
  );
}
