"use client";
import { Bell, Search, LogOut, User, Menu, ChevronDown } from "lucide-react";
import { useNotificationsStore } from "@/lib/store/notifications.store";
import { useSidebarStore } from "@/lib/store/sidebar.store";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRef, useState, useEffect } from "react";

const ICON = { size: 14, strokeWidth: 1.8 as const };

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const name = user?.fullName ?? user?.firstName ?? "Usuário";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Conta do usuário"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="header-user-btn"
      >
        <span className="header-user-avatar">{initials || <User size={12} />}</span>
        <span className="header-user-name hidden sm:block">{name}</span>
        <ChevronDown size={11} strokeWidth={2} className="header-user-chevron" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 140ms" }} />
      </button>

      {open && (
        <div className="header-user-dropdown">
          <div className="header-user-dropdown-info">
            <span className="header-user-dropdown-name">{name}</span>
            {email && <span className="header-user-dropdown-email">{email}</span>}
          </div>
          <div className="header-user-dropdown-divider" />
          <button
            type="button"
            className="header-user-dropdown-item header-user-dropdown-item-danger"
            onClick={() => signOut({ redirectUrl: "/" })}
          >
            <LogOut size={13} strokeWidth={1.8} />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

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
        <UserMenu />
      </div>
    </header>
  );
}
