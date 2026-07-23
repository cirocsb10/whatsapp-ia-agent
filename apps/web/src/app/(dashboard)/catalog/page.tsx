"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Package } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { ProductFormModal } from "@/components/catalog/ProductFormModal";
import { DeleteProductModal } from "@/components/catalog/DeleteProductModal";
import { AdvancedFilterPanel } from "@/components/catalog/AdvancedFilterPanel";
import { CatalogStatsGrid } from "@/features/catalog/components/CatalogStatsGrid";
import { CatalogToolbar, type FilterTab, type ViewMode } from "@/features/catalog/components/CatalogToolbar";
import { CatalogProductPanel } from "@/features/catalog/components/CatalogProductPanel";
import { pushToast } from "@/shared/ui/toast.store";
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

const STATUS_MAP: Record<FilterTab, ProductStatus | undefined> = {
  all: undefined,
  active: "ACTIVE",
  inactive: "INACTIVE",
  out_of_stock: "OUT_OF_STOCK",
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
  const products = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
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

  function openCreate() {
    setEditProduct(null);
    setFormOpen(true);
  }

  const activeFilterCount = countActiveFilters(advFilters);
  const hasActiveSearchOrFilter = !!search || filterTab !== "all" || activeFilterCount > 0;

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
            <button onClick={() => setImportOpen(true)} type="button" className="catalog-btn-secondary">
              Importar
            </button>
            <button onClick={openCreate} className="catalog-add-btn" type="button">
              Adicionar produto
            </button>
          </div>
        </div>

        <CatalogStatsGrid stats={stats} loading={statsQuery.isPending} />

        <CatalogToolbar
          search={search}
          onSearchChange={setSearch}
          filterTab={filterTab}
          onFilterTabChange={setFilterTab}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          activeFilterCount={activeFilterCount}
          onOpenFilterPanel={() => setFilterPanelOpen(true)}
        />

        <CatalogProductPanel
          loading={productsQuery.isPending}
          products={products}
          viewMode={viewMode}
          hasActiveSearchOrFilter={hasActiveSearchOrFilter}
          page={page}
          total={total}
          onPageChange={setPage}
          onEdit={openEdit}
          onDelete={setDeleteProduct}
          onCreate={openCreate}
        />
      </div>

      <ProductFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditProduct(null); }}
        onSaved={() => pushToast("success", "Produto salvo com sucesso!")}
        product={editProduct}
      />
      <DeleteProductModal
        open={!!deleteProduct}
        onClose={() => setDeleteProduct(null)}
        onDeleted={() => pushToast("success", "Produto excluído.")}
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
    </div>
  );
}
