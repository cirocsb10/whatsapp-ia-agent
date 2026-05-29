import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps { title: string; value: string | number; change?: number; changeLabel?: string; icon: LucideIcon; iconColor?: string; trend?: "up" | "down" | "neutral"; loading?: boolean; }

export function KpiCard({ title, value, change, changeLabel = "vs. período anterior", icon: Icon, iconColor = "text-green-400", trend, loading = false }: KpiCardProps) {
  if (loading) return <div className="glass-card p-5 animate-pulse"><div className="h-4 w-24 bg-slate-800 rounded mb-3" /><div className="h-8 w-32 bg-slate-800 rounded mb-2" /><div className="h-3 w-20 bg-slate-800 rounded" /></div>;
  const trendColor = trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-slate-500";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  return (
    <div className="glass-card p-5 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{title}</p><p className="text-3xl font-bold text-white tracking-tight">{value}</p></div>
        <div className="w-10 h-10 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center"><Icon className={cn("w-5 h-5", iconColor)} /></div>
      </div>
      {change !== undefined && (
        <div className="flex items-center gap-1.5 mt-3">
          <TrendIcon className={cn("w-3.5 h-3.5", trendColor)} />
          <span className={cn("text-xs font-medium", trendColor)}>{change > 0 ? "+" : ""}{change}%</span>
          <span className="text-xs text-slate-600">{changeLabel}</span>
        </div>
      )}
    </div>
  );
}
