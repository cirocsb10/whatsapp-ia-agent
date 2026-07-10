"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Product } from "@/types/product";
import { useDeleteProduct } from "@/features/catalog/api/queries";
import { ApiError } from "@/shared/api/fetcher";

interface Props {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  product: Product | null;
}

export function DeleteProductModal({ open, onClose, onDeleted, product }: Props) {
  const deleteProduct = useDeleteProduct();
  const [error, setError] = useState<string | null>(null);
  const deleting = deleteProduct.isPending;

  async function handleDelete() {
    if (!product) return;
    setError(null);
    try {
      await deleteProduct.mutateAsync(product.id);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao excluir produto.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Excluir produto"
      subtitle="Esta ação não pode ser desfeita"
      size="sm"
      headerLeading={<Trash2 className="w-5 h-5 text-red-400" />}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" type="button">
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            type="button"
            style={{
              height: 34,
              padding: "0 16px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: "rgba(239,68,68,0.15)",
              color: "#f87171",
              border: "1px solid rgba(239,68,68,0.3)",
              cursor: "pointer",
            }}
          >
            {deleting ? "Excluindo…" : "Excluir"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
        Tem certeza que deseja excluir{" "}
        <strong style={{ color: "#e2e8f0" }}>{product?.name}</strong>?
        Todos os dados do produto serão removidos permanentemente.
      </p>
      {error && (
        <p style={{ marginTop: 10, fontSize: 12, color: "#f87171" }}>{error}</p>
      )}
    </Modal>
  );
}
