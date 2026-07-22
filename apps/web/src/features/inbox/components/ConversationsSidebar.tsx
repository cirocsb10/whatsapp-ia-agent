"use client";
import { Search, Inbox, RefreshCw, SlidersHorizontal } from "lucide-react";
import { ConversationRow } from "@/features/inbox/components/ConversationRow";
import type { InboxConversation } from "@/features/inbox/api/queries";
import type { SocketStatus } from "@/shared/realtime/socket-status.store";

export type FilterTab = "all" | "ai" | "handoff";

interface Props {
  conversations: InboxConversation[];
  filtered: InboxConversation[];
  activeId: string | null;
  loading: boolean;
  socketStatus: SocketStatus;
  search: string;
  onSearchChange: (v: string) => void;
  filter: FilterTab;
  onFilterChange: (f: FilterTab) => void;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

export function ConversationsSidebar({
  conversations,
  filtered,
  activeId,
  loading,
  socketStatus,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onSelect,
  onRefresh,
}: Props) {
  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: conversations.length },
    { key: "ai", label: "IA Ativa", count: conversations.filter((c) => !c.isHandoff).length },
    { key: "handoff", label: "Handoff", count: conversations.filter((c) => c.isHandoff).length },
  ];

  return (
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
          <button type="button" className="inbox-topbar-btn" title="Atualizar lista" aria-label="Atualizar lista" onClick={onRefresh}>
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
          onChange={(e) => onSearchChange(e.target.value)}
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
            onClick={() => onFilterChange(t.key)}
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
          filtered.map((conv) => (
            <ConversationRow
              key={conv.id}
              conversation={conv}
              isActive={activeId === conv.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  );
}
