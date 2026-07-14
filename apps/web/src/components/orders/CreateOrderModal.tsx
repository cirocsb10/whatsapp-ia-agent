"use client";

import { useEffect, useState } from "react";
import { Trash2, ShoppingCart, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useProductSearch, useCreateOrder, type ProductResult } from "@/features/orders/api/queries";
import { ApiError } from "@/shared/api/fetcher";

interface CartEntry {
  product: ProductResult;
  quantity: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CreateOrderModal({ open, onClose, onCreated }: Props) {
  const createOrder = useCreateOrder();
  const [contactPhone, setContactPhone] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const saving = createOrder.isPending;

  const resultsQuery = useProductSearch(debouncedSearch, open);
  const results = resultsQuery.data ?? [];

  useEffect(() => {
    if (!open) {
      setContactPhone(""); setProductSearch(""); setDebouncedSearch(""); setCart([]); setNotes(""); setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setDebouncedSearch(productSearch), 300);
    return () => clearTimeout(t);
  }, [productSearch, open]);

  function addToCart(product: ProductResult) {
    setCart((prev) => {
      const existing = prev.find((e) => e.product.id === product.id);
      if (existing) return prev.map((e) => e.product.id === product.id ? { ...e, quantity: e.quantity + 1 } : e);
      return [...prev, { product, quantity: 1 }];
    });
    setProductSearch("");
    setDebouncedSearch("");
  }

  function setQty(productId: string, qty: number) {
    if (qty < 1) { setCart((prev) => prev.filter((e) => e.product.id !== productId)); return; }
    setCart((prev) => prev.map((e) => e.product.id === productId ? { ...e, quantity: qty } : e));
  }

  const total = cart.reduce((sum, e) => sum + e.product.priceCents * e.quantity, 0);

  async function handleCreate() {
    if (!contactPhone.trim()) { setError("Informe o telefone do cliente."); return; }
    if (cart.length === 0) { setError("Adicione pelo menos um produto."); return; }
    setError(null);
    try {
      await createOrder.mutateAsync({
        contactPhone: contactPhone.trim(),
        items: cart.map((e) => ({ productId: e.product.id, quantity: e.quantity })),
        notes: notes.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar pedido.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo pedido manual"
      subtitle="Crie um pedido diretamente pelo painel"
      size="lg"
      headerLeading={<ShoppingCart className="w-5 h-5 text-green-600" />}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" type="button">Cancelar</button>
          <button
            onClick={handleCreate}
            disabled={saving}
            type="button"
            style={{ height: 34, padding: "0 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(34,197,94,0.15)", color: "#15803d", border: "1px solid rgba(34,197,94,0.3)", cursor: "pointer" }}
          >
            {saving ? "Criando…" : `Criar pedido${total ? ` — ${money(total)}` : ""}`}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
            Telefone do cliente
          </label>
          <input
            type="tel"
            placeholder="+55 11 99999-9999"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", background: "#ffffff", border: "1px solid var(--c-border)", borderRadius: 8, fontSize: 13, color: "#0f172a", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ position: "relative" }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
            Buscar produto
          </label>
          <div style={{ position: "relative" }}>
            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#475569" }} />
            <input
              type="text"
              placeholder="Nome do produto..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              style={{ width: "100%", padding: "8px 12px 8px 32px", background: "#ffffff", border: "1px solid var(--c-border)", borderRadius: 8, fontSize: 13, color: "#0f172a", outline: "none", boxSizing: "border-box" }}
            />
          </div>
          {productSearch.trim() && results.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, background: "#ffffff", border: "1px solid var(--c-border)", borderRadius: 10, padding: "4px 0", boxShadow: "0 8px 32px rgba(15,23,42,0.16)" }}>
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, display: "flex", justifyContent: "space-between", color: "#64748b" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(15,23,42,0.05)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                >
                  <span style={{ color: "#0f172a" }}>{p.name}</span>
                  <span>{money(p.priceCents)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
              Itens do pedido
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cart.map((entry) => (
                <div key={entry.product.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f8fafc", border: "1px solid var(--c-border)", borderRadius: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, color: "#0f172a" }}>{entry.product.name}</span>
                  <span style={{ fontSize: 12, color: "#64748b", width: 80, textAlign: "right" }}>{money(entry.product.priceCents * entry.quantity)}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button type="button" onClick={() => setQty(entry.product.id, entry.quantity - 1)} style={{ width: 24, height: 24, borderRadius: 6, background: "#f1f5f9", border: "none", cursor: "pointer", color: "#475569", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <span style={{ fontSize: 13, color: "#0f172a", minWidth: 20, textAlign: "center" }}>{entry.quantity}</span>
                    <button type="button" onClick={() => setQty(entry.product.id, entry.quantity + 1)} style={{ width: 24, height: 24, borderRadius: 6, background: "#f1f5f9", border: "none", cursor: "pointer", color: "#475569", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                  <button type="button" onClick={() => setQty(entry.product.id, 0)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#475569" }}>
                    <Trash2 style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "#0f172a", marginTop: 10 }}>
              Total: {money(total)}
            </div>
          </div>
        )}

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
            Observações (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{ width: "100%", padding: "8px 12px", background: "#ffffff", border: "1px solid var(--c-border)", borderRadius: 8, fontSize: 13, color: "#0f172a", outline: "none", resize: "vertical", boxSizing: "border-box" }}
          />
        </div>

        {error && <p style={{ fontSize: 12, color: "#dc2626" }}>{error}</p>}
      </div>
    </Modal>
  );
}
