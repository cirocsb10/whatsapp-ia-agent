"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/FormSelect";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { NumericInput } from "@/components/ui/NumericInput";
import { Product, ProductStatus, STATUS_COLOR, STATUS_LABEL } from "@/types/product";
import { useSaveProduct } from "@/features/catalog/api/queries";
import { ApiError } from "@/shared/api/fetcher";
import { centsToMaskedPrice, maskedPriceToCents } from "@/lib/decimal-mask";

const STATUS_OPTIONS: ProductStatus[] = ["ACTIVE", "INACTIVE", "OUT_OF_STOCK", "DISCONTINUED"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product?: Product | null;
}

interface FormState {
  name: string;
  description: string;
  sku: string;
  priceReais: string;
  comparePriceReais: string;
  stockQty: string;
  lowStockThreshold: string;
  status: string;
  tags: string;
}

const EMPTY: FormState = {
  name: "",
  description: "",
  sku: "",
  priceReais: "",
  comparePriceReais: "",
  stockQty: "0",
  lowStockThreshold: "5",
  status: "ACTIVE",
  tags: "",
};

function productToForm(p: Product): FormState {
  return {
    name: p.name,
    description: p.description ?? "",
    sku: p.sku ?? "",
    priceReais: centsToMaskedPrice(p.priceCents),
    comparePriceReais: p.comparePriceCents
      ? centsToMaskedPrice(p.comparePriceCents)
      : "",
    stockQty: String(p.stockQty),
    lowStockThreshold: String(p.lowStockThreshold),
    status: p.status,
    tags: p.tags.join(", "),
  };
}

export function ProductFormModal({ open, onClose, onSaved, product }: Props) {
  const saveProduct = useSaveProduct();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const saving = saveProduct.isPending;

  const isEditing = !!product;

  useEffect(() => {
    if (open) {
      setForm(product ? productToForm(product) : EMPTY);
      setError(null);
    }
  }, [open, product]);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceCents = maskedPriceToCents(form.priceReais);
    const comparePriceCents = form.comparePriceReais.trim()
      ? maskedPriceToCents(form.comparePriceReais)
      : null;

    if (priceCents === null || priceCents < 0) {
      setError("Preço inválido.");
      return;
    }

    try {
      await saveProduct.mutateAsync({
        ...(isEditing ? { id: product!.id } : {}),
        input: {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          sku: form.sku.trim() || undefined,
          priceCents,
          comparePriceCents: comparePriceCents ?? undefined,
          stockQty: parseInt(form.stockQty, 10) || 0,
          lowStockThreshold: parseInt(form.lowStockThreshold, 10) || 5,
          status: form.status,
          tags: form.tags
            ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : [],
        },
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar produto.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar produto" : "Novo produto"}
      subtitle={isEditing ? `Editando: ${product?.name}` : "Preencha os dados do produto"}
      size="md"
      headerLeading={<Package className="w-5 h-5 text-indigo-600" />}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" type="button">
            Cancelar
          </button>
          <button
            form="product-form"
            type="submit"
            disabled={saving || !form.name.trim() || !form.priceReais}
            className="catalog-add-btn"
            style={{ minWidth: 120 }}
          >
            {saving ? "Salvando…" : isEditing ? "Salvar" : "Adicionar"}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit}>
        <div className="form-grid-2">
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Nome *</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex.: Camiseta Preta M"
              required
              maxLength={200}
            />
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Descrição</label>
            <textarea
              className="form-input"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Descrição do produto..."
              rows={3}
              maxLength={2000}
              style={{ resize: "vertical" }}
            />
          </div>

          <div className="form-field">
            <label className="form-label">SKU</label>
            <input
              className="form-input"
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
              placeholder="Ex.: CAM-001"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Status</label>
            <FormSelect
              value={form.status}
              onChange={(v) => set("status", v)}
              options={STATUS_OPTIONS.map((status) => ({
                value: status,
                label: STATUS_LABEL[status],
                color: STATUS_COLOR[status],
              }))}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Preço (R$) *</label>
            <DecimalInput
              value={form.priceReais}
              onChange={(v) => set("priceReais", v)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Preço comparativo (R$)</label>
            <DecimalInput
              value={form.comparePriceReais}
              onChange={(v) => set("comparePriceReais", v)}
              placeholder="Preço riscado"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Estoque *</label>
            <NumericInput
              value={form.stockQty}
              onChange={(v) => set("stockQty", v)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Alerta de estoque baixo</label>
            <NumericInput
              value={form.lowStockThreshold}
              onChange={(v) => set("lowStockThreshold", v)}
            />
            <span className="form-hint">Notifica quando estoque atingir este valor</span>
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Tags</label>
            <input
              className="form-input"
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="roupas, masculino, algodão (separadas por vírgula)"
            />
            <span className="form-hint">Usadas pelo AI para recomendação de produtos</span>
          </div>
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8,
              color: "#dc2626",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
