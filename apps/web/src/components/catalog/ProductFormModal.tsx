"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Product } from "@/types/product";
import { useApi } from "@/lib/hooks/useApi";

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
    priceReais: (p.priceCents / 100).toFixed(2),
    comparePriceReais: p.comparePriceCents
      ? (p.comparePriceCents / 100).toFixed(2)
      : "",
    stockQty: String(p.stockQty),
    lowStockThreshold: String(p.lowStockThreshold),
    status: p.status,
    tags: p.tags.join(", "),
  };
}

export function ProductFormModal({ open, onClose, onSaved, product }: Props) {
  const { apiFetch } = useApi();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setSaving(true);
    setError(null);

    const priceCents = Math.round(parseFloat(form.priceReais.replace(",", ".")) * 100);
    const comparePriceCents = form.comparePriceReais
      ? Math.round(parseFloat(form.comparePriceReais.replace(",", ".")) * 100)
      : null;

    if (isNaN(priceCents) || priceCents < 0) {
      setError("Preço inválido.");
      setSaving(false);
      return;
    }

    const body = {
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
    };

    try {
      const res = await apiFetch(
        isEditing ? `/products/${product!.id}` : "/products",
        { method: isEditing ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Erro ao salvar produto.");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar produto" : "Novo produto"}
      subtitle={isEditing ? `Editando: ${product?.name}` : "Preencha os dados do produto"}
      size="lg"
      headerLeading={<Package className="w-5 h-5 text-indigo-400" />}
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
            <select
              className="form-input"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
              <option value="OUT_OF_STOCK">Esgotado</option>
              <option value="DISCONTINUED">Descontinuado</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Preço (R$) *</label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={form.priceReais}
              onChange={(e) => set("priceReais", e.target.value)}
              placeholder="0,00"
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Preço comparativo (R$)</label>
            <input
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={form.comparePriceReais}
              onChange={(e) => set("comparePriceReais", e.target.value)}
              placeholder="Preço de riscado"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Estoque *</label>
            <input
              className="form-input"
              type="number"
              min="0"
              value={form.stockQty}
              onChange={(e) => set("stockQty", e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Alerta de estoque baixo</label>
            <input
              className="form-input"
              type="number"
              min="0"
              value={form.lowStockThreshold}
              onChange={(e) => set("lowStockThreshold", e.target.value)}
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
              color: "#fca5a5",
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
