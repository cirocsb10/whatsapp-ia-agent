import { Package } from "lucide-react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductListRow } from "@/components/catalog/ProductListRow";
import type { Product } from "@/types/product";
import type { ViewMode } from "./CatalogToolbar";

const PAGE_SIZE = 20;

interface Props {
  loading: boolean;
  products: Product[];
  viewMode: ViewMode;
  hasActiveSearchOrFilter: boolean;
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onCreate: () => void;
}

export function CatalogProductPanel({
  loading,
  products,
  viewMode,
  hasActiveSearchOrFilter,
  page,
  total,
  onPageChange,
  onEdit,
  onDelete,
  onCreate,
}: Props) {
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="catalog-panel">
      {loading ? (
        <div className="catalog-empty">
          <div style={{ fontSize: 12, color: "#64748b" }}>Carregando produtos…</div>
        </div>
      ) : products.length === 0 ? (
        <div className="catalog-empty">
          <div className="catalog-empty-icon">
            <Package className="w-6 h-6" style={{ color: "#475569" }} />
          </div>
          <p className="text-[15px] font-semibold text-[#0f172a]">
            {hasActiveSearchOrFilter ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
          </p>
          <p className="text-[12px] text-[#475569] leading-relaxed text-center max-w-xs">
            {hasActiveSearchOrFilter
              ? "Tente outros termos ou limpe os filtros"
              : "Adicione produtos ou importe uma planilha"}
          </p>
          {!hasActiveSearchOrFilter && (
            <button type="button" className="catalog-add-btn mt-2" onClick={onCreate}>
              Adicionar primeiro produto
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="catalog-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onEdit={onEdit} onDelete={onDelete} />
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
              <ProductListRow key={p.id} product={p} onEdit={onEdit} onDelete={onDelete} />
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
              onClick={() => onPageChange(page - 1)}
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
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </button>
              );
            })}
            <button
              type="button"
              className="catalog-page-btn"
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
