import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  accent?: string;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
  empty?: boolean;
}

function EmptySparkline({ color }: { color: string }) {
  return (
    <svg className="kpi-sparkline" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 24 Q20 20 40 22 T80 14 T120 18 V32 H0 Z"
        fill={color}
        fillOpacity="0.08"
      />
      <path
        d="M0 24 Q20 20 40 22 T80 14 T120 18"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.25"
      />
    </svg>
  );
}

export function KpiCard({
  title, value, change, changeLabel = "vs. ontem",
  icon: Icon, iconColor = "text-slate-500",
  accent = "#6366f1",
  trend, loading = false, empty = false,
}: KpiCardProps) {

  if (loading) return (
    <div className="kpi">
      <div className="shimmer h-2.5 w-16 mb-1" />
      <div className="shimmer h-7 w-20 mb-1" />
      <div className="shimmer h-4 w-12" />
    </div>
  );

  const TIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const dClass = trend === "up" ? "delta-up" : trend === "down" ? "delta-down" : "delta-none";

  return (
    <div
      className="kpi kpi-accent"
      style={{
        ["--kpi-accent" as string]: accent,
        ["--kpi-accent-glow" as string]: `${accent}22`,
      }}
    >
      {empty && <EmptySparkline color={accent} />}

      <div className="flex items-center justify-between relative z-10">
        <span
          className="text-[10px] font-600 uppercase tracking-widest"
          style={{ color: "#475569", letterSpacing: "0.08em" }}
        >
          {title}
        </span>
        <div
          className="kpi-icon-wrap"
          style={{ background: `${accent}14`, borderColor: `${accent}30` }}
        >
          <Icon className={cn("w-3.5 h-3.5", iconColor)} />
        </div>
      </div>

      <p className={cn("stat relative z-10", empty && "stat-empty")}>
        {empty ? "—" : value}
      </p>

      {!empty && change !== undefined ? (
        <span className={cn("delta relative z-10", dClass)}>
          <TIcon className="w-3 h-3" />
          {change > 0 ? "+" : ""}{change}%
          <span className="opacity-60 font-normal">&nbsp;{changeLabel}</span>
        </span>
      ) : (
        <span className="delta delta-none text-[10px] relative z-10">
          {empty ? "Aguardando dados" : "Sem dados"}
        </span>
      )}
    </div>
  );
}
