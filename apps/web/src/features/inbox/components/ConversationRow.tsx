"use client";
import { memo } from "react";
import { Phone } from "lucide-react";
import type { InboxConversation } from "@/features/inbox/api/queries";

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

interface ConversationRowProps {
  conversation: InboxConversation;
  isActive: boolean;
  onSelect: (id: string) => void;
}

function ConversationRowComponent({ conversation: conv, isActive, onSelect }: ConversationRowProps) {
  const initials = getInitials(conv.contact.name, conv.contact.phone);
  const color = avatarColor(conv.id);

  return (
    <button
      type="button"
      onClick={() => onSelect(conv.id)}
      className={`inbox-conv-item${isActive ? " inbox-conv-item-active" : ""}${conv.unreadCount > 0 ? " inbox-conv-item-unread" : ""}`}
    >
      <div className="inbox-avatar" style={{ "--avatar-color": color } as React.CSSProperties}>
        {initials}
      </div>

      <div className="inbox-conv-body">
        <div className="inbox-conv-row">
          <span className="inbox-conv-name">{conv.contact.name ?? conv.contact.phone}</span>
          <span className={`inbox-conv-time${conv.unreadCount > 0 ? " inbox-conv-time-unread" : ""}`}>
            {relativeTime(conv.lastMessageAt)}
          </span>
        </div>

        <div className="inbox-conv-row">
          <p className="inbox-conv-preview">
            {conv.attendingUserId && conv.attendingLabel ? (
              <span className="inbox-handoff-hint">
                <Phone className="w-3 h-3 flex-shrink-0" />
                Em atendimento por {conv.attendingLabel}
              </span>
            ) : conv.isHandoff ? (
              <span className="inbox-handoff-hint">
                <Phone className="w-3 h-3 flex-shrink-0" />
                {conv.isAssumed ? "Atendente humano ativo" : "Aguardando atendente"}
              </span>
            ) : (
              <>
                {conv.attendingLabel === "IA" ? (
                  <span className="inbox-handoff-hint">
                    IA
                    {conv.lastMessage ? ` · ${conv.lastMessage}` : ""}
                  </span>
                ) : (
                  conv.lastMessage ?? "Sem mensagens"
                )}
              </>
            )}
          </p>
          {conv.unreadCount > 0 && (
            <span className="inbox-badge">{conv.unreadCount > 9 ? "9+" : conv.unreadCount}</span>
          )}
        </div>
      </div>
    </button>
  );
}

export const ConversationRow = memo(ConversationRowComponent);
export { getInitials, avatarColor };
