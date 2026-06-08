"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useApi } from "@/lib/hooks/useApi";

interface Props {
  open: boolean;
  onClose: () => void;
  onCancelled: () => void;
  order: { id: string; orderNumber: string } | null;
}

export function CancelOrderModal({ open, onClose, onCancelled, order }: Props) {
  const { apiFetch } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!order) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/orders/${order.id}/cancel`, { method: "PATCH" });
      if (!res.ok) throw new Error("Erro ao cancelar pedido.");
      onCancelled();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading) return;
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Cancelar pedido"
      subtitle="Esta ação não pode ser desfeita"
      size="sm"
      headerLeading={<XCircle className="w-5 h-5 text-red-400" />}
      footer={
        <>
          <button onClick={handleClose} className="btn-ghost" type="button" disabled={loading}>
            Voltar
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
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
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Cancelando…" : "Confirmar cancelamento"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
        Tem certeza que deseja cancelar o pedido{" "}
        <strong style={{ color: "#e2e8f0" }}>{order?.orderNumber}</strong>?
        O status será alterado para cancelado e esta ação não poderá ser revertida.
      </p>
      {error && (
        <p style={{ marginTop: 10, fontSize: 12, color: "#f87171" }}>{error}</p>
      )}
    </Modal>
  );
}
