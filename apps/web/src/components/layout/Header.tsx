"use client";
import { Bell, Search } from "lucide-react";
import { useNotificationsStore } from "@/lib/store/notifications.store";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const unread = useNotificationsStore((s) => s.unreadCount);
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-[#020617]/80 backdrop-blur-xl border-b border-[#1E293B]">
      <div>
        <h1 className="text-lg font-semibold text-white leading-none">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0F172A] border border-[#1E293B] text-slate-500 hover:text-slate-300 hover:border-slate-700 transition-colors text-sm cursor-pointer" aria-label="Buscar">
          <Search className="w-4 h-4" /><span className="hidden md:inline">Buscar...</span>
        </button>
        <button className="relative w-9 h-9 rounded-lg bg-[#0F172A] border border-[#1E293B] text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center" aria-label="Notificações">
          <Bell className="w-4 h-4" />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
        </button>
      </div>
    </header>
  );
}
