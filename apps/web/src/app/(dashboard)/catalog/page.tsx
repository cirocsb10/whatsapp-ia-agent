"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Eye,
  Grid3X3,
  List,
  Package,
  Search,
  SlidersHorizontal,
  Tag,
  TrendingUp,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductListRow } from "@/components/catalog/ProductListRow";
import { ProductFormModal } from "@/components/catalog/ProductFormModal";
import { DeleteProductModal } from "@/components/catalog/DeleteProductModal";
import { AdvancedFilterPanel } from "@/components/catalog/AdvancedFilterPanel";
import {
  useProductStats,
  useProducts,
  useCategories,
  type ProductListParams,
} from "@/features/catalog/api/queries";
import {
  Product,
  ProductStatus,
  AdvancedFilters,
  DEFAULT_ADVANCED_FILTERS,
  countActiveFilters,
} from "@/types/product";

// xlsx só é carregado quando o modal de importação abre (fora do bundle inicial).
const ImportProductsModal = dynamic(
  () => import("@/components/catalog/ImportProductsModal").then((m) => m.ImportProductsModal),
  { ssr: false },
);

type ViewMode = "grid" | "list";
type FilterTab = "all" | "active" | "inactive" | "out_of_stock";

const STATUS_MAP: Record<FilterTab, ProductStatus | undefined> = {
  all: undefined,
  active: "ACTIVE",
  inactive: "INACTIVE",
  out_of_stock: "OUT_OF_STOCK",
};

const FILTER_LABELS: Record<FilterTab, string> = {
  all: "Todos",
  active: "Ativos",
  inactive: "Inativos",
  out_of_stock: "Esgotados",
};

const PAGE_SIZE = 20;

export default function CatalogPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED_FILTERS);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const listParams = useMemo<ProductListParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
      status: STATUS_MAP[filterTab],
      minPriceCents: advFilters.minPriceCents,
      maxPriceCents: advFilters.maxPriceCents,
      minStock: advFilters.minStock,
      categoryId: advFilters.categoryId,
      sortBy: advFilters.sortBy,
      sortOrder: advFilters.sortOrder,
    }),
    [page, debouncedSearch, filterTab, advFilters],
  );

  const statsQuery = useProductStats();
  const productsQuery = useProducts(listParams);
  const categoriesQuery = useCategories();

  const stats = statsQuery.data ?? { total: 0, active: 0, inactive: 0, outOfStock: 0 };
  const loadingStats = statsQuery.isPending;
  const products = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const loadingProducts = productsQuery.isPending;
  const categories = categoriesQuery.data ?? [];

  // Debounce da busca (300ms) → alimenta o queryKey via listParams.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [advFilters, filterTab]);

  function handleSearchChange(value: string) {
    setSearch(value);
  }

  function handleTabChange(tab: FilterTab) {
    setFilterTab(tab);
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function onSaved() {
    setToast({ type: "success", msg: "Produto salvo com sucesso!" });
  }

  function onDeleted() {
    setToast({ type: "success", msg: "Produto excluído." });
  }

  function onImported() {
    setSearch("");
    setDebouncedSearch("");
    setFilterTab("all");
    setAdvFilters(DEFAULT_ADVANCED_FILTERS);
    setPage(1);
  }

  function openEdit(p: Product) {
    setEditProduct(p);
    setFormOpen(true);
  }

  function openDelete(p: Product) {
    setDeleteProduct(p);
  }

  function openCreate() {
    setEditProduct(null);
    setFormOpen(true);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeFilterCount = countActiveFilters(advFilters);

  const STATS_CARDS = [
    { label: "Total de produtos", value: loadingStats ? "…" : stats.total, icon: Package, color: "#6366f1" },
    { label: "Produtos ativos", value: loadingStats ? "…" : stats.active, icon: TrendingUp, color: "#22c55e" },
    {
      label: "Inativos / Esgotados",
      value: loadingStats ? "…" : stats.inactive + stats.outOfStock,
      icon: Tag,
      color: "#f59e0b",
    },
    { label: "Visualizações IA", value: "—", icon: Eye, color: "#06b6d4" },
  ];

  return (
    <div className="fade-up flex flex-col h-screen overflow-y-auto">
      <Header title="Catálogo" subtitle="Gerencie os produtos do seu agente IA" />

      <div className="dashboard-page">
        <div className="catalog-hero">
          <div className="catalog-hero-content">
            <div className="catalog-hero-badge">
              <Package className="w-3 h-3" strokeWidth={2} />
              Catálogo inteligente
            </div>
            <h2 className="catalog-hero-title">Catálogo de Produtos</h2>
            <p className="catalog-hero-sub">
              Gerencie seus produtos e deixe o AI recomendar para os clientes
            </p>
          </div>
          <div className="catalog-hero-actions">
            <button
              onClick={() => setImportOpen(true)}
              type="button"
              className="catalog-btn-secondary"
            >
              Importar
            </button>
            <button onClick={openCreate} className="catalog-add-btn" type="button">
              Adicionar produto
            </button>
          </div>
        </div>

        <div
          className="catalog-stats-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {STATS_CARDS.map((s) => (
            <div
              key={s.label}
              style={{
                background: "rgba(15,23,42,0.8)",
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
                <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>
                  {String(s.value)}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="catalog-toolbar" style={{ marginBottom: 16 }}>
          <div className="catalog-search-wrap" style={{ flex: "1 1 220px", maxWidth: "none" }}>
            <Search className="catalog-search-icon" />
            <input
              className="catalog-search-input"
              placeholder="Buscar por nome, SKU..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="catalog-filter-tabs">
              {(["all", "active", "inactive", "out_of_stock"] as FilterTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={`orders-tab ${filterTab === tab ? "orders-tab-active" : ""}`}
                >
                  {FILTER_LABELS[tab]}
                </button>
              ))}
            </div>

            <div className="catalog-view-toggle">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`catalog-view-btn ${viewMode === "grid" ? "catalog-view-btn-active" : ""}`}
                title="Grade"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`catalog-view-btn ${viewMode === "list" ? "catalog-view-btn-active" : ""}`}
                title="Lista"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              className={`orders-tool-btn relative${activeFilterCount > 0 ? " orders-tool-btn--active" : ""}`}
              title="Filtros avançados"
              onClick={() => setFilterPanelOpen(true)}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {activeFilterCount > 0 && (
                <span className="filter-badge">{activeFilterCount}</span>
              )}
            </button>
          </div>
        </div>

        <div className="catalog-panel">
          {loadingProducts ? (
            <div className="catalog-empty">
              <div style={{ fontSize: 12, color: "#64748b" }}>Carregando produtos…</div>
            </div>
          ) : products.length === 0 ? (
            <div className="catalog-empty">
              <div className="catalog-empty-icon">
                <Package className="w-6 h-6" style={{ color: "#475569" }} />
              </div>
              <p className="text-[15px] font-semibold text-[#e2e8f0]">
                {search || filterTab !== "all" || activeFilterCount > 0
                  ? "Nenhum produto encontrado"
                  : "Nenhum produto cadastrado"}
              </p>
              <p className="text-[12px] text-[#475569] leading-relaxed text-center max-w-xs">
                {search || filterTab !== "all" || activeFilterCount > 0
                  ? "Tente outros termos ou limpe os filtros"
                  : "Adicione produtos ou importe uma planilha"}
              </p>
              {!search && filterTab === "all" && activeFilterCount === 0 && (
                <button
                  type="button"
                  className="catalog-add-btn mt-2"
                  onClick={openCreate}
                >
                  Adicionar primeiro produto
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="catalog-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onEdit={openEdit} onDelete={openDelete} />
              ))}
            </div>
          ) : (
            <div className="catalog-list-container">
              <div className="catalog-list-table">
                <div className="product-list-row product-list-header">
                  <div />
                  <div>Produto</div>
                  <div>Preço</div>
                  <div>Estoque</div>
                  <div>Tags</div>
                  <div>Status</div>
                  <div>Ações</div>
                </div>
                {products.map((p) => (
                  <ProductListRow key={p.id} product={p} onEdit={openEdit} onDelete={openDelete} />
                ))}
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="catalog-pagination">
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total} produtos
              </span>
              <div className="catalog-pagination-btns">
                <button
                  type="button"
                  className="catalog-page-btn"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`catalog-page-btn${page === p ? " active" : ""}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="catalog-page-btn"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ProductFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditProduct(null); }}
        onSaved={onSaved}
        product={editProduct}
      />
      <DeleteProductModal
        open={!!deleteProduct}
        onClose={() => setDeleteProduct(null)}
        onDeleted={onDeleted}
        product={deleteProduct}
      />
      <ImportProductsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={onImported}
      />

      <AdvancedFilterPanel
        open={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        filters={advFilters}
        categories={categories}
        onApply={setAdvFilters}
      />

      {toast && (
        <div
          className={`kb-toast kb-toast--${toast.type}`}
          style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
