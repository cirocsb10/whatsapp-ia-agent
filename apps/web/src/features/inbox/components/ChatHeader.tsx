"use client";
import { Search, UserCheck, RotateCcw, PauseCircle } from "lucide-react";
import { getInitials, avatarColor } from "@/features/inbox/components/ConversationRow";
import type { InboxConversation } from "@/features/inbox/api/queries";

interface Props {
  conversation: InboxConversation;
  onAssume: () => void;
  onRelease: () => void;
}

export function ChatHeader({ conversation, onAssume, onRelease }: Props) {
  return (
    <div className="inbox-chat-header">
      <div
        className="inbox-chat-avatar"
        style={{
          background: `${avatarColor(conversation.id)}22`,
          color: avatarColor(conversation.id),
        }}
      >
        {getInitials(conversation.contact.name, conversation.contact.phone)}
      </div>

      <div className="inbox-panel-header-text flex-1 min-w-0">
        <p className="inbox-panel-header-title truncate">
          {conversation.contact.name ?? conversation.contact.phone}
        </p>
        <p className="inbox-status-line">
          {conversation.attendingUserId && conversation.attendingLabel ? (
            <>
              <span className="inbox-status-dot inbox-status-dot--indigo" aria-hidden="true" />
              Em atendimento por {conversation.attendingLabel}
            </>
          ) : conversation.attendingLabel === "IA" ? (
            <>
              <span className="inbox-status-dot inbox-status-dot--green" aria-hidden="true" />
              IA
            </>
          ) : conversation.isAssumed ? (
            <>
              <span className="inbox-status-dot inbox-status-dot--indigo" aria-hidden="true" />
              Atendente humano ativo
            </>
          ) : conversation.isHandoff ? (
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

      {conversation.isAssumed ? (
        <button
          type="button"
          className="inbox-action-btn inbox-action-btn--indigo"
          onClick={onRelease}
          title="Devolver ao bot"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Devolver ao bot
        </button>
      ) : conversation.isHandoff ? (
        <button
          type="button"
          className="inbox-action-btn inbox-action-btn--green"
          onClick={onAssume}
          title="Assumir conversa"
        >
          <UserCheck className="w-3.5 h-3.5" />
          Assumir conversa
        </button>
      ) : (
        <button
          type="button"
          className="inbox-action-btn inbox-action-btn--amber"
          onClick={onAssume}
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
  );
}
