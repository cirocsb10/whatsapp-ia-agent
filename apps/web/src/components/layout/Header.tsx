"use client";
import { Bell, Search, User, Menu } from "lucide-react";
import { useNotificationsStore } from "@/lib/store/notifications.store";
import { useSidebarStore } from "@/lib/store/sidebar.store";

const ICON = { size: 14, strokeWidth: 1.8 as const };

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const unread = useNotificationsStore((s) => s.unreadCount);
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const collapsed = useSidebarStore((s) => s.collapsed);

  return (
    <header className="dashboard-topbar">
      <div className="dashboard-topbar-start">
        <button
          type="button"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          onClick={toggleSidebar}
          className="header-icon-btn"
        >
          <Menu {...ICON} />
        </button>
        <div className="dashboard-topbar-title">
          <h1 className="dashboard-topbar-heading">{title}</h1>
          {subtitle && (
            <p className="dashboard-topbar-subtitle hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="header-actions">
        <button type="button" className="header-search-btn">
          <Search {...ICON} />
          <span>Buscar</span>
          <kbd className="header-search-kbd">⌘K</kbd>
        </button>
        <button type="button" aria-label="Notificações" className="header-icon-btn relative">
          <Bell {...ICON} />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-[#0c1526]" />
          )}
        </button>
        <button type="button" aria-label="Conta do usuário" className="header-icon-btn header-icon-btn-accent">
          <User {...ICON} />
        </button>
      </div>
    </header>
  );
}
