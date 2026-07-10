"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useUpdateOrderStatus } from "@/features/orders/api/queries";
import { ApiError } from "@/shared/api/fetcher";

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "AWAITING_PAYMENT", label: "Aguardando pagamento" },
  { value: "PAYMENT_CONFIRMED", label: "Pagamento confirmado" },
  { value: "PROCESSING", label: "Em processamento" },
  { value: "READY_FOR_PICKUP", label: "Pronto para retirada" },
  { value: "OUT_FOR_DELIVERY", label: "Em entrega" },
  { value: "DELIVERED", label: "Entregue" },
  { value: "CANCELLED", label: "Cancelado" },
  { value: "REFUNDED", label: "Reembolsado" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  currentStatus: string;
}

export function UpdateStatusModal({ open, onClose, orderId, currentStatus }: Props) {
  const updateStatus = useUpdateOrderStatus();
  const [selected, setSelected] = useState(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const saving = updateStatus.isPending;

  useEffect(() => {
    if (open) setSelected(currentStatus);
  }, [open, currentStatus]);

  async function handleSave() {
    if (!orderId || selected === currentStatus) { onClose(); return; }
    setError(null);
    try {
      await updateStatus.mutateAsync({ orderId, status: selected });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar status.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Atualizar status"
      subtitle="Selecione o novo status do pedido"
      size="sm"
      headerLeading={<RefreshCw className="w-5 h-5 text-indigo-400" />}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" type="button">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            type="button"
            style={{ height: 34, padding: "0 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)", cursor: "pointer" }}
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {STATUS_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: selected === opt.value ? "rgba(99,102,241,0.1)" : "transparent", border: `1px solid ${selected === opt.value ? "rgba(99,102,241,0.3)" : "transparent"}`, cursor: "pointer", fontSize: 13, color: selected === opt.value ? "#a5b4fc" : "#94a3b8" }}
          >
            <input type="radio" name="status" value={opt.value} checked={selected === opt.value} onChange={() => setSelected(opt.value)} style={{ accentColor: "#6366f1" }} />
            {opt.label}
          </label>
        ))}
      </div>
      {error && <p style={{ marginTop: 10, fontSize: 12, color: "#f87171" }}>{error}</p>}
    </Modal>
  );
}
