"use client";
import { Header } from "@/components/layout/Header";
import {
  Package, Plus, Search, SlidersHorizontal,
  Tag, LayoutGrid, List, ShoppingBag,
  TrendingUp, Eye, Star,
} from "lucide-react";
import { useState } from "react";

type ViewMode = "grid" | "list";
type FilterTab = "all" | "active" | "inactive";

const STATS = [
  { label: "Total de produtos", value: "0", icon: Package,    color: "#6366f1", bg: "rgba(99,102,241,0.1)",  border: "rgba(99,102,241,0.2)"  },
  { label: "Produtos ativos",   value: "0", icon: TrendingUp, color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.2)"   },
  { label: "Categorias",        value: "0", icon: Tag,        color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.2)"  },
  { label: "Visualizações IA",  value: "0", icon: Eye,        color: "#06b6d4", bg: "rgba(6,182,212,0.1)",   border: "rgba(6,182,212,0.2)"   },
];

export default function CatalogPage() {
  const [view, setView] = useState<ViewMode>("grid");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all",      label: "Todos" },
    { key: "active",   label: "Ativos" },
    { key: "inactive", label: "Inativos" },
  ];

  return (
    <div className="fade-up flex flex-col h-screen overflow-y-auto">
      <Header title="Catálogo" subtitle="Gerencie os produtos do seu agente IA" />

      <div className="dashboard-page">

        {/* Stats */}
        <div className="support-stats-grid">
          {STATS.map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className="support-stat-card" style={{ "--stat-border": border } as React.CSSProperties}>
              <div className="support-stat-icon" style={{ background: bg, borderColor: border }}>
                <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.8} />
              </div>
              <div>
                <p className="support-stat-value">{value}</p>
                <p className="support-stat-label">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="catalog-toolbar">
          {/* Search */}
          <div className="catalog-search-wrap">
            <Search className="catalog-search-icon" />
            <input
              className="catalog-search-input"
              placeholder="Buscar produto por nome ou categoria…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Filter tabs */}
            <div className="catalog-filter-tabs">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFilter(t.key)}
                  className={`inbox-tab ${filter === t.key ? "inbox-tab-active" : ""}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Filter button */}
            <button className="inbox-filter-btn" title="Filtros avançados">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* View toggle */}
            <div className="catalog-view-toggle">
              <button
                onClick={() => setView("grid")}
                className={`catalog-view-btn ${view === "grid" ? "catalog-view-btn-active" : ""}`}
                title="Grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setView("list")}
                className={`catalog-view-btn ${view === "list" ? "catalog-view-btn-active" : ""}`}
                title="Lista"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Add product */}
            <button className="catalog-add-btn">
              <Plus className="w-3.5 h-3.5" />
              Adicionar produto
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="catalog-panel">
          {/* Empty state */}
          <div className="catalog-empty">
            <div className="catalog-empty-icon">
              <ShoppingBag className="w-6 h-6 text-slate-600" strokeWidth={1.5} />
            </div>
            <p className="text-[15px] font-semibold text-[#e2e8f0]">Nenhum produto cadastrado</p>
            <p className="text-[12px] text-[#475569] leading-relaxed text-center max-w-xs">
              Adicione produtos ao catálogo para que o agente IA possa apresentá-los, tirar dúvidas e gerar pedidos automaticamente.
            </p>
            <button className="catalog-add-btn mt-2">
              <Plus className="w-3.5 h-3.5" />
              Adicionar primeiro produto
            </button>
          </div>
        </div>

        {/* Info cards */}
        <div className="support-info-row">
          <div className="support-info-card">
            <div className="support-info-card-header">
              <div className="support-info-icon" style={{ background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.2)" }}>
                <Package className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
              </div>
              <span className="text-[12px] font-semibold text-[#e2e8f0]">Como o catálogo funciona</span>
            </div>
            <p className="text-[11px] text-[#64748b] leading-relaxed">
              O agente IA usa o catálogo para responder perguntas sobre produtos, sugerir itens e gerar links de pagamento. Mantenha preços e descrições sempre atualizados.
            </p>
          </div>

          <div className="support-info-card">
            <div className="support-info-card-header">
              <div className="support-info-icon" style={{ background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.2)" }}>
                <Star className="w-3.5 h-3.5 text-green-400" strokeWidth={1.8} />
              </div>
              <span className="text-[12px] font-semibold text-[#e2e8f0]">Produtos em destaque</span>
            </div>
            <p className="text-[11px] text-[#64748b] leading-relaxed">
              Marque produtos como destaque para que o agente os sugira proativamente durante conversas. Ideal para promoções e lançamentos.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
