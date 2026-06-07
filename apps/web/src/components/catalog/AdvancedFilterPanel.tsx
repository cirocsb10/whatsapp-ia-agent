"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { FormSelect } from "@/components/ui/FormSelect";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { NumericInput } from "@/components/ui/NumericInput";
import { centsToMaskedPrice, maskedPriceToCents } from "@/lib/decimal-mask";
import {
  AdvancedFilters,
  Category,
  SORT_OPTIONS,
  DEFAULT_ADVANCED_FILTERS,
} from "@/types/product";

interface AdvancedFilterPanelProps {
  open: boolean;
  onClose: () => void;
  filters: AdvancedFilters;
  categories: Category[];
  onApply: (filters: AdvancedFilters) => void;
}

const SORT_ORDER_OPTIONS = [
  { value: "desc", label: "Decrescente" },
  { value: "asc", label: "Crescente" },
];

export function AdvancedFilterPanel({
  open,
  onClose,
  filters,
  categories,
  onApply,
}: AdvancedFilterPanelProps) {
  const [local, setLocal] = useState<AdvancedFilters>(filters);
  const [minPriceMask, setMinPriceMask] = useState("");
  const [maxPriceMask, setMaxPriceMask] = useState("");
  const [minStockMask, setMinStockMask] = useState("");

  useEffect(() => {
    if (!open) return;
    setLocal(filters);
    setMinPriceMask(
      filters.minPriceCents !== undefined ? centsToMaskedPrice(filters.minPriceCents) : "",
    );
    setMaxPriceMask(
      filters.maxPriceCents !== undefined ? centsToMaskedPrice(filters.maxPriceCents) : "",
    );
    setMinStockMask(filters.minStock !== undefined ? String(filters.minStock) : "");
  }, [filters, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  function setField<K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply() {
    const next: AdvancedFilters = {
      ...local,
      minPriceCents: minPriceMask ? maskedPriceToCents(minPriceMask) ?? undefined : undefined,
      maxPriceCents: maxPriceMask ? maskedPriceToCents(maxPriceMask) ?? undefined : undefined,
      minStock: minStockMask === "" ? undefined : parseInt(minStockMask, 10),
    };
    onApply(next);
    onClose();
  }

  function handleClear() {
    const cleared = { ...DEFAULT_ADVANCED_FILTERS };
    setLocal(cleared);
    setMinPriceMask("");
    setMaxPriceMask("");
    setMinStockMask("");
    onApply(cleared);
    onClose();
  }

  if (!open) return null;

  const categoryOptions = [
    { value: "all", label: "Todas as categorias" },
    ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
  ];

  return (
    <div className="filter-panel-overlay" onClick={onClose} role="presentation">
      <aside
        className="filter-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-panel-title"
      >
        <div className="filter-panel-header">
          <h2 id="filter-panel-title" className="filter-panel-title">
            Filtros avançados
          </h2>
          <button type="button" onClick={onClose} className="filter-panel-close" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="filter-panel-body">
          <div className="form-field">
            <label className="form-label">Faixa de preço (R$)</label>
            <div className="filter-panel-price-row">
              <DecimalInput
                placeholder="Mín"
                value={minPriceMask}
                onChange={setMinPriceMask}
              />
              <span className="filter-panel-sep">até</span>
              <DecimalInput
                placeholder="Máx"
                value={maxPriceMask}
                onChange={setMaxPriceMask}
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Estoque mínimo</label>
            <NumericInput
              placeholder="Ex: 5"
              value={minStockMask}
              onChange={setMinStockMask}
            />
          </div>

          {categories.length > 0 && (
            <div className="form-field">
              <label className="form-label">Categoria</label>
              <FormSelect
                value={local.categoryId ?? "all"}
                onChange={(v) => setField("categoryId", v === "all" ? undefined : v)}
                options={categoryOptions}
                placeholder="Todas as categorias"
              />
            </div>
          )}

          <div className="form-field">
            <label className="form-label">Ordenar por</label>
            <FormSelect
              value={local.sortBy ?? "createdAt"}
              onChange={(v) => setField("sortBy", v as AdvancedFilters["sortBy"])}
              options={SORT_OPTIONS.map((opt) => ({
                value: opt.value!,
                label: opt.label,
              }))}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Ordem</label>
            <FormSelect
              value={local.sortOrder ?? "desc"}
              onChange={(v) => setField("sortOrder", v as "asc" | "desc")}
              options={SORT_ORDER_OPTIONS}
            />
          </div>
        </div>

        <div className="filter-panel-footer">
          <button type="button" className="catalog-btn-secondary flex-1" onClick={handleClear}>
            Limpar filtros
          </button>
          <button type="button" className="catalog-add-btn flex-1" onClick={handleApply}>
            Aplicar
          </button>
        </div>
      </aside>
    </div>
  );
}
