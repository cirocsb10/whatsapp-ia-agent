"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useCancelOrder } from "@/features/orders/api/queries";
import { ApiError } from "@/shared/api/fetcher";

interface Props {
  open: boolean;
  onClose: () => void;
  order: { id: string; orderNumber: string } | null;
}

export function CancelOrderModal({ open, onClose, order }: Props) {
  const cancelOrder = useCancelOrder();
  const [error, setError] = useState<string | null>(null);
  const loading = cancelOrder.isPending;

  async function handleCancel() {
    if (!order) return;
    setError(null);
    try {
      await cancelOrder.mutateAsync(order.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao cancelar pedido.");
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
      headerLeading={<XCircle className="w-5 h-5 text-red-600" />}
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
              color: "#dc2626",
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
      <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
        Tem certeza que deseja cancelar o pedido{" "}
        <strong style={{ color: "#0f172a" }}>{order?.orderNumber}</strong>?
        O status será alterado para cancelado e esta ação não poderá ser revertida.
      </p>
      {error && (
        <p style={{ marginTop: 10, fontSize: 12, color: "#dc2626" }}>{error}</p>
      )}
    </Modal>
  );
}
