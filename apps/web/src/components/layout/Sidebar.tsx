"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, MessageSquare, Bot, Package, ShoppingCart, BarChart3, PhoneCall, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useNotificationsStore } from "@/lib/store/notifications.store";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/inbox", label: "Conversas", icon: MessageSquare, badgeKey: "active_conversations" },
  { href: "/support", label: "Suporte", icon: PhoneCall, badgeKey: "pending_handoffs" },
  { href: "/agent", label: "Agente IA", icon: Bot },
  { href: "/catalog", label: "Catálogo", icon: Package },
  { href: "/orders", label: "Pedidos", icon: ShoppingCart, badgeKey: "pending_orders" },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const badges = useNotificationsStore((s) => s.badges);
  return (
    <aside className={cn("relative flex flex-col h-screen bg-[#0F172A] border-r border-[#1E293B] transition-all duration-300 shrink-0", collapsed ? "w-16" : "w-60")}>
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[#1E293B]">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/20 shrink-0"><MessageSquare className="w-5 h-5 text-green-400" /></div>
        {!collapsed && <span className="font-bold text-white text-lg">Whats<span className="text-green-400">Agent</span></span>}
      </div>
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, badgeKey }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          const count = badgeKey ? (badges[badgeKey] ?? 0) : 0;
          return (
            <Link key={href} href={href} className={cn("nav-item", isActive && "active", collapsed && "justify-center px-0")} title={collapsed ? label : undefined}>
              <div className="relative shrink-0">
                <Icon className="w-5 h-5" />
                {count > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">{count > 9 ? "9+" : count}</span>}
              </div>
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>
      <button onClick={() => setCollapsed(!collapsed)} className="absolute -right-3 top-20 w-6 h-6 bg-[#1E293B] border border-[#334155] rounded-full text-slate-400 hover:text-white cursor-pointer flex items-center justify-center z-10">
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
      {!collapsed && (
        <div className="px-4 py-3 border-t border-[#1E293B] flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2"><span className="absolute animate-ping inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" /></span>
          <span className="text-xs text-slate-400">WhatsApp conectado</span>
        </div>
      )}
    </aside>
  );
}
