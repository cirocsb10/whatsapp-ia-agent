"use client";

import { ShoppingCart, User, Package, CreditCard } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useOrderDetail } from "@/features/orders/api/queries";

interface Props {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
}

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  REFUNDED: "Estornado",
};

export function OrderDetailModal({ open, onClose, orderId }: Props) {
  const orderQuery = useOrderDetail(open ? orderId : null);
  const order = orderQuery.data ?? null;
  const loading = orderQuery.isPending && !!orderId;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={order ? order.orderNumber : "Detalhes do pedido"}
      {...(order ? { subtitle: `Criado em ${new Date(order.createdAt).toLocaleDateString("pt-BR")}` } : {})}
      size="lg"
      headerLeading={<ShoppingCart className="w-5 h-5 text-indigo-400" />}
    >
      {loading && <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: "24px 0" }}>Carregando...</p>}

      {!loading && order && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              <User className="w-3 h-3" style={{ display: "inline", marginRight: 4 }} />
              Cliente
            </p>
            <p style={{ fontSize: 13, color: "#e2e8f0" }}>{order.contact.name ?? "—"}</p>
            <p style={{ fontSize: 12, color: "#64748b" }}>{order.contact.phone}</p>
          </section>

          <section>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              <Package className="w-3 h-3" style={{ display: "inline", marginRight: 4 }} />
              Itens
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {order.items.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#e2e8f0" }}>{item.quantity}× {item.productName}</span>
                  <span style={{ color: "#94a3b8" }}>{money(item.subtotalCents)}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid rgba(51,65,85,0.6)", marginTop: 10, paddingTop: 10 }}>
              {order.discountCents > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                  <span>Desconto</span><span>-{money(order.discountCents)}</span>
                </div>
              )}
              {order.shippingCents > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                  <span>Frete</span><span>{money(order.shippingCents)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                <span>Total</span><span>{money(order.totalCents)}</span>
              </div>
            </div>
          </section>

          {order.payments.length > 0 && (
            <section>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                <CreditCard className="w-3 h-3" style={{ display: "inline", marginRight: 4 }} />
                Pagamento
              </p>
              {order.payments.map((pay) => (
                <div key={pay.id} style={{ fontSize: 13, color: "#e2e8f0", display: "flex", justifyContent: "space-between" }}>
                  <span>{pay.method} — {PAYMENT_STATUS_LABEL[pay.status] ?? pay.status}</span>
                  <span>{money(pay.amountCents)}</span>
                </div>
              ))}
            </section>
          )}

          {order.notes && (
            <section>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Observações</p>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>{order.notes}</p>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
