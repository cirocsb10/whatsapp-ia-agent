"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/shared/api/fetcher";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, MessageSquare, Bot, Package, Kanban,
  ShoppingCart, BarChart3, PhoneCall, Settings, Shield, Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNotificationsStore } from "@/lib/store/notifications.store";
import { useSidebarStore, SIDEBAR_WIDTH } from "@/lib/store/sidebar.store";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  admin?: boolean;
};

const NAV: { section: string; items: NavItem[] }[] = [
  { section: "Menu", items: [
    { href: "/overview",  label: "Overview",    icon: LayoutDashboard },
    { href: "/inbox",     label: "Conversas",   icon: MessageSquare, badge: "active_conversations" },
    { href: "/support",   label: "Suporte",     icon: PhoneCall,     badge: "pending_handoffs" },
    { href: "/analytics", label: "Analytics",   icon: BarChart3 },
  ]},
  { section: "Configurar", items: [
    { href: "/agent",    label: "Agente IA",    icon: Bot },
    { href: "/catalog",  label: "Catálogo",     icon: Package },
    { href: "/crm",      label: "CRM",          icon: Kanban },
    { href: "/orders",   label: "Pedidos",      icon: ShoppingCart, badge: "pending_orders" },
    { href: "/settings", label: "Configurações",icon: Settings },
  ]},
  { section: "Plataforma", items: [
    { href: "/tenants", label: "Super Admin", icon: Shield, admin: true },
    { href: "/email",   label: "Email",       icon: Mail,   admin: true },
  ]},
];

export function Sidebar() {
  const path = usePathname();
  const collapsed = useSidebarStore((s) => s.collapsed);
  const badges = useNotificationsStore((s) => s.badges);
  const width = collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded;
  const [apiVersion, setApiVersion] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ version?: string }>("/health")
      .then((res) => setApiVersion(res.version ?? null))
      .catch(() => {});
  }, []);

  return (
    <aside
      style={{ width }}
      className="relative flex flex-col h-screen shrink-0 bg-white border-r border-slate-200 transition-[width] duration-200 overflow-hidden"
    >
      {/* Brand */}
      <Link
        href="/overview"
        className={cn("sidebar-brand", collapsed && "sidebar-brand-collapsed")}
        title="WhatsAgent"
      >
        <div className="brand-logo">
          <MessageSquare strokeWidth={2} />
        </div>
        {!collapsed && (
          <span className="brand-name">
            Whats<span className="brand-name-accent">Agent</span>
          </span>
        )}
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            {!collapsed && <p className="section-title px-2 pb-1">{section}</p>}
            <div className="space-y-0.5">
              {items.map(({ href, label, icon: Icon, badge, admin }) => {
                const active = path === href || path.startsWith(href + "/");
                const count  = badge ? (badges[badge] ?? 0) : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    className={cn(
                      "nav-item",
                      active && "active",
                      admin && "nav-item-admin",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <div className="relative shrink-0">
                      <Icon className="w-[15px] h-[15px]" strokeWidth={1.8} />
                      {count > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 text-[8px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                          {count > 9 ? "9+" : count}
                        </span>
                      )}
                    </div>
                    {!collapsed && <span>{label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Status footer */}
      <div className={cn("border-t border-slate-200 py-3 shrink-0", collapsed ? "px-0 flex justify-center" : "px-3")}>
        {collapsed ? (
          <span className="relative flex h-1.5 w-1.5" title="WhatsApp conectado">
            <span className="absolute inset-0 rounded-full bg-green-400 opacity-50 pulse-dot" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inset-0 rounded-full bg-green-400 opacity-50 pulse-dot" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 font-medium leading-none truncate">WhatsApp conectado</p>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-none">Meta Cloud API</p>
              <p className="text-[10px] text-slate-400 mt-1.5 leading-none truncate">
                v{process.env.NEXT_PUBLIC_APP_VERSION}
                {process.env.NEXT_PUBLIC_BUILD_COMMIT && ` · ${process.env.NEXT_PUBLIC_BUILD_COMMIT}`}
                {apiVersion && ` · API v${apiVersion}`}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
