"use client";

import { Package, Pencil, Trash2 } from "lucide-react";
import {
  formatPrice,
  Product,
  STATUS_COLOR,
  STATUS_LABEL,
} from "@/types/product";

interface Props {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}

export function ProductCard({ product, onEdit, onDelete }: Props) {
  const isLowStock =
    product.stockQty > 0 &&
    product.stockQty <= product.lowStockThreshold;

  return (
    <div className="product-card">
      <div className="product-card-image">
        {product.imageUrls[0] ? (
          <img src={product.imageUrls[0]} alt={product.name} />
        ) : (
          <Package className="w-8 h-8" style={{ color: "#334155" }} />
        )}
      </div>

      <div className="product-card-body">
        <div className="product-card-name">{product.name}</div>
        {product.sku && (
          <div className="product-card-sku">SKU: {product.sku}</div>
        )}

        <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
          <span className="product-card-price">
            {formatPrice(product.priceCents)}
          </span>
          {product.comparePriceCents && (
            <span className="product-card-compare">
              {formatPrice(product.comparePriceCents)}
            </span>
          )}
        </div>

        <div className={`product-card-stock${isLowStock ? " low" : ""}`}>
          {product.stockQty === 0
            ? "Sem estoque"
            : isLowStock
            ? `Estoque baixo: ${product.stockQty}`
            : `Estoque: ${product.stockQty}`}
        </div>

        <div
          className="product-card-status"
          style={{
            color: STATUS_COLOR[product.status],
            background: `${STATUS_COLOR[product.status]}18`,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: STATUS_COLOR[product.status],
              display: "inline-block",
            }}
          />
          {STATUS_LABEL[product.status]}
        </div>
      </div>

      <div className="product-card-actions">
        <button
          className="product-card-btn"
          onClick={() => onEdit(product)}
          title="Editar produto"
          type="button"
        >
          <Pencil className="w-3 h-3" style={{ display: "inline", marginRight: 4 }} />
          Editar
        </button>
        <button
          className="product-card-btn danger"
          onClick={() => onDelete(product)}
          title="Excluir produto"
          type="button"
        >
          <Trash2 className="w-3 h-3" style={{ display: "inline" }} />
        </button>
      </div>
    </div>
  );
}
