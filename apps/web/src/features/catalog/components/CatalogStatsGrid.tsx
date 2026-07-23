import { Eye, Package, Tag, TrendingUp } from "lucide-react";
import type { ProductStats } from "@/types/product";

interface Props {
  stats: ProductStats;
  loading: boolean;
}

export function CatalogStatsGrid({ stats, loading }: Props) {
  const cards = [
    { label: "Total de produtos", value: loading ? "…" : stats.total, icon: Package, color: "#6366f1" },
    { label: "Produtos ativos", value: loading ? "…" : stats.active, icon: TrendingUp, color: "#22c55e" },
    {
      label: "Inativos / Esgotados",
      value: loading ? "…" : stats.inactive + stats.outOfStock,
      icon: Tag,
      color: "#f59e0b",
    },
    { label: "Visualizações IA", value: "—", icon: Eye, color: "#06b6d4" },
  ];

  return (
    <div
      className="catalog-stats-grid"
      style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}
    >
      {cards.map((s) => (
        <div
          key={s.label}
          style={{
            background: "#ffffff",
            border: "1px solid var(--c-border)",
            borderRadius: 10,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: `${s.color}18`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <s.icon className="w-4 h-4" style={{ color: s.color }} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{String(s.value)}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
