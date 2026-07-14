"use client";

import Image from "next/image";
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

export function ProductListRow({ product, onEdit, onDelete }: Props) {
  const isLowStock =
    product.stockQty > 0 && product.stockQty <= product.lowStockThreshold;
  const imageUrl = product.imageUrls[0];

  return (
    <div className="product-list-row">
      <div className="product-list-thumb">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            sizes="36px"
            className="object-cover"
          />
        ) : (
          <Package className="w-4 h-4" style={{ color: "#475569" }} />
        )}
      </div>

      <div>
        <div className="product-list-name">{product.name}</div>
        {product.sku && (
          <div className="product-list-sku">SKU: {product.sku}</div>
        )}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
        {formatPrice(product.priceCents)}
      </div>

      <div
        style={{
          fontSize: 12,
          color: isLowStock ? "#a16207" : "#64748b",
        }}
      >
        {product.stockQty === 0
          ? "Esgotado"
          : isLowStock
          ? `${product.stockQty} (baixo)`
          : product.stockQty}
      </div>

      <div
        style={{
          fontSize: 10,
          color: "#64748b",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {product.tags.slice(0, 2).join(", ") || "—"}
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 10,
          fontWeight: 600,
          color: STATUS_COLOR[product.status],
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: STATUS_COLOR[product.status],
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        {STATUS_LABEL[product.status]}
      </div>

      <div className="product-list-actions">
        <button
          className="product-list-action-btn"
          onClick={() => onEdit(product)}
          title="Editar"
          type="button"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          className="product-list-action-btn danger"
          onClick={() => onDelete(product)}
          title="Excluir"
          type="button"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
