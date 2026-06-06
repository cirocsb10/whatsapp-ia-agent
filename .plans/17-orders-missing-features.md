# Orders Page — Missing Functionalities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up all non-functional UI elements on `/orders` — per-row actions dropdown, order detail modal, status updates, cancel, manual order creation, CSV export, and catalog navigation.

**Architecture:** All mutations use the existing `apiFetch` hook (Clerk-authed `fetch` wrapper). New modals follow the established `Modal` component pattern used in the catalog page — components live in `apps/web/src/components/orders/`, state controlled in `page.tsx`. Backend adds three endpoints to the existing orders module: `PATCH /orders/:id/status`, `PATCH /orders/:id/cancel`, and `POST /orders` (UI-facing, Clerk-guarded).

**Tech Stack:** NestJS (API), Next.js 14 App Router (web), Prisma, `useApi()` hook, `Modal` from `@/components/ui/Modal`, Clerk auth.

---

## File Map

**Create:**
- `apps/web/src/components/orders/OrderDetailModal.tsx` — read-only view of full order (contact, items, payments)
- `apps/web/src/components/orders/UpdateStatusModal.tsx` — status transition selector
- `apps/web/src/components/orders/CreateOrderModal.tsx` — contact + product search + item builder

**Modify:**
- `apps/api/src/modules/orders/orders.service.ts` — add `updateStatus`, `cancelOrder`, `createFromUi`
- `apps/api/src/modules/orders/orders.controller.ts` — add `PATCH :id/status`, `PATCH :id/cancel`, `POST /orders`
- `apps/web/src/app/(dashboard)/orders/page.tsx` — wire all buttons/menus to modals

---

## Tier 1 — Core Workflow

### Task 1: Backend — `PATCH /orders/:id/status` and `PATCH /orders/:id/cancel`

**Files:**
- Modify: `apps/api/src/modules/orders/orders.service.ts`
- Modify: `apps/api/src/modules/orders/orders.controller.ts`
- Modify: `apps/api/src/modules/orders/orders.service.spec.ts`

- [ ] **Step 1: Add `updateStatus` and `cancelOrder` to the service**

  Open `apps/api/src/modules/orders/orders.service.ts` and add these two methods after `findOne`:

  ```typescript
  async updateStatus(tenantId: string, id: string, status: string) {
    const valid = [
      "DRAFT","AWAITING_PAYMENT","PAYMENT_CONFIRMED",
      "PROCESSING","READY_FOR_PICKUP","OUT_FOR_DELIVERY",
      "DELIVERED","CANCELLED","REFUNDED",
    ];
    if (!valid.includes(status)) {
      throw new BadRequestException(`Status inválido: ${status}`);
    }
    const order = await this.prisma.order.findFirst({ where: { id, tenantId } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return this.prisma.order.update({
      where: { id },
      data: {
        status,
        ...(status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
        ...(status === "CANCELLED" ? { cancelledAt: new Date() } : {}),
      },
    });
  }

  async cancelOrder(tenantId: string, id: string) {
    return this.updateStatus(tenantId, id, "CANCELLED");
  }
  ```

  Also add `BadRequestException` to the import at line 1:
  ```typescript
  import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from "@nestjs/common";
  ```

- [ ] **Step 2: Add the two endpoints to the controller**

  Open `apps/api/src/modules/orders/orders.controller.ts`.

  Add `Patch, Body` to the import from `@nestjs/common`:
  ```typescript
  import {
    Controller, Get, Post, Patch, Param, Query, Body, UseGuards, Headers, HttpCode, UnauthorizedException,
  } from "@nestjs/common";
  ```

  Add these two methods inside the class, before the closing brace:

  ```typescript
  @Patch(":id/status")
  @UseGuards(ClerkAuthGuard)
  updateStatus(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body("status") status: string,
  ) {
    return this.service.updateStatus(tenantId, id, status);
  }

  @Patch(":id/cancel")
  @UseGuards(ClerkAuthGuard)
  cancelOrder(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.service.cancelOrder(tenantId, id);
  }
  ```

- [ ] **Step 3: Write tests for the new service methods**

  Open `apps/api/src/modules/orders/orders.service.spec.ts` and add a new `describe` block:

  ```typescript
  describe("updateStatus", () => {
    it("updates status to PROCESSING", async () => {
      jest.spyOn(prisma.order, "findFirst").mockResolvedValue({ id: "o1", tenantId: "t1" } as any);
      jest.spyOn(prisma.order, "update").mockResolvedValue({ id: "o1", status: "PROCESSING" } as any);
      const result = await service.updateStatus("t1", "o1", "PROCESSING");
      expect(result.status).toBe("PROCESSING");
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: "o1" },
        data: { status: "PROCESSING" },
      });
    });

    it("throws BadRequestException for invalid status", async () => {
      await expect(service.updateStatus("t1", "o1", "INVALID")).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException when order not found", async () => {
      jest.spyOn(prisma.order, "findFirst").mockResolvedValue(null);
      await expect(service.updateStatus("t1", "missing", "PROCESSING")).rejects.toThrow(NotFoundException);
    });
  });
  ```

  Add `BadRequestException` to the NestJS import at the top of the spec file.

- [ ] **Step 4: Run the tests**

  ```bash
  pnpm --filter @whatsagent/api test
  ```

  Expected: all tests pass, including the 3 new ones.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/modules/orders/orders.controller.ts apps/api/src/modules/orders/orders.service.ts apps/api/src/modules/orders/orders.service.spec.ts
  git commit -m "feat(api): add PATCH /orders/:id/status and /cancel endpoints"
  ```

---

### Task 2: Frontend — `OrderDetailModal`

**Files:**
- Create: `apps/web/src/components/orders/OrderDetailModal.tsx`

- [ ] **Step 1: Create the component**

  Create `apps/web/src/components/orders/OrderDetailModal.tsx`:

  ```tsx
  "use client";

  import { useEffect, useState } from "react";
  import { ShoppingCart, User, Package, CreditCard } from "lucide-react";
  import { Modal } from "@/components/ui/Modal";
  import { useApi } from "@/lib/hooks/useApi";

  interface OrderDetail {
    id: string;
    orderNumber: string;
    status: string;
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    totalCents: number;
    notes: string | null;
    createdAt: string;
    confirmedAt: string | null;
    deliveredAt: string | null;
    cancelledAt: string | null;
    contact: { phone: string; name: string | null };
    items: Array<{
      id: string;
      productName: string;
      quantity: number;
      priceCents: number;
      subtotalCents: number;
    }>;
    payments: Array<{
      id: string;
      method: string;
      status: string;
      amountCents: number;
      pixCopyPaste: string | null;
      paidAt: string | null;
    }>;
  }

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
    const { apiFetch } = useApi();
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (!open || !orderId) return;
      setLoading(true);
      apiFetch(`/orders/${orderId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setOrder(data))
        .finally(() => setLoading(false));
    }, [open, orderId]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <Modal
        open={open}
        onClose={onClose}
        title={order ? order.orderNumber : "Detalhes do pedido"}
        subtitle={order ? `Criado em ${new Date(order.createdAt).toLocaleDateString("pt-BR")}` : undefined}
        size="lg"
        headerLeading={<ShoppingCart className="w-5 h-5 text-indigo-400" />}
      >
        {loading && <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: "24px 0" }}>Carregando...</p>}

        {!loading && order && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Contact */}
            <section>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                <User className="w-3 h-3" style={{ display: "inline", marginRight: 4 }} />
                Cliente
              </p>
              <p style={{ fontSize: 13, color: "#e2e8f0" }}>{order.contact.name ?? "—"}</p>
              <p style={{ fontSize: 12, color: "#64748b" }}>{order.contact.phone}</p>
            </section>

            {/* Items */}
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

            {/* Payments */}
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

            {/* Notes */}
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
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/src/components/orders/OrderDetailModal.tsx
  git commit -m "feat(web): add OrderDetailModal for order details view"
  ```

---

### Task 3: Frontend — `UpdateStatusModal`

**Files:**
- Create: `apps/web/src/components/orders/UpdateStatusModal.tsx`

- [ ] **Step 1: Create the component**

  Create `apps/web/src/components/orders/UpdateStatusModal.tsx`:

  ```tsx
  "use client";

  import { useState } from "react";
  import { RefreshCw } from "lucide-react";
  import { Modal } from "@/components/ui/Modal";
  import { useApi } from "@/lib/hooks/useApi";

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
    onUpdated: () => void;
    orderId: string | null;
    currentStatus: string;
  }

  export function UpdateStatusModal({ open, onClose, onUpdated, orderId, currentStatus }: Props) {
    const { apiFetch } = useApi();
    const [selected, setSelected] = useState(currentStatus);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSave() {
      if (!orderId || selected === currentStatus) { onClose(); return; }
      setSaving(true);
      setError(null);
      try {
        const res = await apiFetch(`/orders/${orderId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: selected }),
        });
        if (!res.ok) throw new Error("Erro ao atualizar status.");
        onUpdated();
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
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/src/components/orders/UpdateStatusModal.tsx
  git commit -m "feat(web): add UpdateStatusModal for order status transitions"
  ```

---

### Task 4: Frontend — Wire actions dropdown + modals to `page.tsx`

**Files:**
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx`

- [ ] **Step 1: Add imports and new state to `OrdersPage`**

  At the top of the file, update the import block:

  ```tsx
  import { useRouter } from "next/navigation";
  import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
  import { UpdateStatusModal } from "@/components/orders/UpdateStatusModal";
  ```

  Inside the `OrdersPage` function body, after the existing `useState` declarations, add:

  ```tsx
  const router = useRouter();
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [updateOrder, setUpdateOrder] = useState<{ id: string; status: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  ```

- [ ] **Step 2: Add `loadOrders` helper and close-menu-on-outside-click**

  Extract the existing `load()` logic in `useEffect` into a named `useCallback`. Replace the existing `useEffect` block:

  ```tsx
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/orders?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.items ?? []);
        setTotalPages(data.totalPages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void loadOrders(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);
  ```

  Add `useCallback` to the React import line.

- [ ] **Step 3: Add `exportCsv` function**

  After the `useEffect` blocks, add:

  ```tsx
  function exportCsv() {
    const header = "Pedido,Cliente,Telefone,Total,Status,Data\n";
    const rows = orders.map((o) =>
      [
        o.orderNumber,
        o.contact?.name ?? "",
        o.contact?.phone ?? "",
        (o.totalCents / 100).toFixed(2),
        o.status,
        new Date(o.createdAt).toLocaleDateString("pt-BR"),
      ].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  ```

- [ ] **Step 4: Replace the static `MoreHorizontal` with a working dropdown**

  Find the row cell that renders `MoreHorizontal` (line ~225-227):

  ```tsx
  <div className="orders-td">
    <MoreHorizontal className="w-4 h-4 text-[#64748b]" />
  </div>
  ```

  Replace with:

  ```tsx
  <div className="orders-td" style={{ position: "relative" }}>
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === order.id ? null : order.id); }}
      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", alignItems: "center", color: "#64748b" }}
    >
      <MoreHorizontal className="w-4 h-4" />
    </button>
    {openMenuId === order.id && (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50, background: "#0f172a", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 10, padding: "4px 0", minWidth: 180, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
      >
        {[
          { label: "Ver detalhes", action: () => { setDetailOrderId(order.id); setOpenMenuId(null); }, danger: false },
          { label: "Atualizar status", action: () => { setUpdateOrder({ id: order.id, status: order.status }); setOpenMenuId(null); }, danger: false },
          { label: "Cancelar pedido", action: async () => { setOpenMenuId(null); if (!confirm(`Cancelar ${order.orderNumber}?`)) return; await apiFetch(`/orders/${order.id}/cancel`, { method: "PATCH" }); void loadOrders(); }, danger: true },
        ].map(({ label, action, danger }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: danger ? "#f87171" : "#94a3b8", display: "block" }}
            onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = "none"; }}
          >
            {label}
          </button>
        ))}
      </div>
    )}
  </div>
  ```

- [ ] **Step 5: Wire hero and empty-state buttons**

  Replace the "Novo pedido" button (line ~110):
  ```tsx
  <button className="orders-btn orders-btn-primary" onClick={() => setCreateOpen(true)}>
    Novo pedido
  </button>
  ```

  Replace "Ver catalogo" (line ~187):
  ```tsx
  <button className="orders-btn orders-btn-secondary" onClick={() => router.push("/catalog")}>
    Ver catalogo
  </button>
  ```

  Replace "Criar pedido manual" (line ~190):
  ```tsx
  <button className="orders-btn orders-btn-primary" onClick={() => setCreateOpen(true)}>
    Criar pedido manual
  </button>
  ```

  Wire the Download button (line ~156):
  ```tsx
  <button className="orders-tool-btn" title="Exportar CSV" onClick={exportCsv}>
    <Download className="w-3.5 h-3.5" />
  </button>
  ```

- [ ] **Step 6: Render modals at the end of the JSX**

  Just before the closing `</div>` of the outer `return`, add:

  ```tsx
  <OrderDetailModal
    open={!!detailOrderId}
    onClose={() => setDetailOrderId(null)}
    orderId={detailOrderId}
  />
  <UpdateStatusModal
    open={!!updateOrder}
    onClose={() => setUpdateOrder(null)}
    onUpdated={() => void loadOrders()}
    orderId={updateOrder?.id ?? null}
    currentStatus={updateOrder?.status ?? "DRAFT"}
  />
  ```

  (The `CreateOrderModal` render is added in Task 6.)

- [ ] **Step 7: Verify TypeScript compiles**

  ```bash
  pnpm --filter @whatsagent/web lint
  ```

  Expected: no type errors.

- [ ] **Step 8: Commit**

  ```bash
  git add apps/web/src/app/(dashboard)/orders/page.tsx
  git commit -m "feat(web): wire order row dropdown, detail modal, status update, CSV export"
  ```

---

## Tier 2 — Manual Order Creation

### Task 5: Backend — `POST /orders` (UI-facing, Clerk-guarded)

**Files:**
- Modify: `apps/api/src/modules/orders/orders.service.ts`
- Modify: `apps/api/src/modules/orders/orders.controller.ts`

- [ ] **Step 1: Add `createFromUi` method to the service**

  Add this method after `cancelOrder` in `orders.service.ts`:

  ```typescript
  async createFromUi(tenantId: string, body: {
    contactPhone: string;
    items: Array<{ productId: string; quantity: number }>;
    notes?: string;
  }) {
    const productIds = body.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true, priceCents: true, name: true },
    });
    if (products.length !== productIds.length) {
      const missing = productIds.filter((id) => !products.find((p) => p.id === id));
      throw new NotFoundException(`Produtos não encontrados: ${missing.join(", ")}`);
    }
    const priceMap = new Map(products.map((p) => [p.id, { priceCents: p.priceCents, name: p.name }]));
    const resolvedItems = body.items.map((i) => ({
      productId: i.productId,
      productName: priceMap.get(i.productId)!.name,
      priceCents: priceMap.get(i.productId)!.priceCents,
      quantity: i.quantity,
      subtotalCents: priceMap.get(i.productId)!.priceCents * i.quantity,
      variationSelected: {},
    }));
    const subtotal = resolvedItems.reduce((sum, i) => sum + i.subtotalCents, 0);
    const contact = await this.prisma.contact.upsert({
      where: { tenantId_phone: { tenantId, phone: body.contactPhone } },
      create: { tenantId, phone: body.contactPhone },
      update: {},
    });
    const orderNumber = `ORD-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    return this.prisma.order.create({
      data: {
        tenantId,
        contactId: contact.id,
        orderNumber,
        subtotalCents: subtotal,
        totalCents: subtotal,
        status: "DRAFT",
        notes: body.notes ?? null,
        items: { create: resolvedItems },
      },
    });
  }
  ```

- [ ] **Step 2: Add the `POST /orders` endpoint to the controller**

  Add before the `@Post("internal")` method:

  ```typescript
  @Post()
  @HttpCode(201)
  @UseGuards(ClerkAuthGuard)
  createFromUi(
    @CurrentTenantId() tenantId: string,
    @Body() body: { contactPhone: string; items: Array<{ productId: string; quantity: number }>; notes?: string },
  ) {
    return this.service.createFromUi(tenantId, body);
  }
  ```

- [ ] **Step 3: Run tests**

  ```bash
  pnpm --filter @whatsagent/api test
  ```

  Expected: all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/api/src/modules/orders/orders.service.ts apps/api/src/modules/orders/orders.controller.ts
  git commit -m "feat(api): add POST /orders UI-facing endpoint for manual order creation"
  ```

---

### Task 6: Frontend — `CreateOrderModal`

**Files:**
- Create: `apps/web/src/components/orders/CreateOrderModal.tsx`
- Modify: `apps/web/src/app/(dashboard)/orders/page.tsx`

- [ ] **Step 1: Create the component**

  Create `apps/web/src/components/orders/CreateOrderModal.tsx`:

  ```tsx
  "use client";

  import { useEffect, useState } from "react";
  import { Trash2, ShoppingCart, Search } from "lucide-react";
  import { Modal } from "@/components/ui/Modal";
  import { useApi } from "@/lib/hooks/useApi";

  interface ProductResult {
    id: string;
    name: string;
    priceCents: number;
  }

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
    const { apiFetch } = useApi();
    const [contactPhone, setContactPhone] = useState("");
    const [productSearch, setProductSearch] = useState("");
    const [results, setResults] = useState<ProductResult[]>([]);
    const [cart, setCart] = useState<CartEntry[]>([]);
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      if (!open) {
        setContactPhone(""); setProductSearch(""); setResults([]); setCart([]); setNotes(""); setError(null);
      }
    }, [open]);

    useEffect(() => {
      if (!productSearch.trim()) { setResults([]); return; }
      const t = setTimeout(async () => {
        const res = await apiFetch(`/products?search=${encodeURIComponent(productSearch)}&limit=5&status=ACTIVE`);
        if (res.ok) {
          const data = await res.json();
          setResults((data.items ?? []).map((p: any) => ({ id: p.id, name: p.name, priceCents: p.priceCents })));
        }
      }, 300);
      return () => clearTimeout(t);
    }, [productSearch]); // eslint-disable-line react-hooks/exhaustive-deps

    function addToCart(product: ProductResult) {
      setCart((prev) => {
        const existing = prev.find((e) => e.product.id === product.id);
        if (existing) return prev.map((e) => e.product.id === product.id ? { ...e, quantity: e.quantity + 1 } : e);
        return [...prev, { product, quantity: 1 }];
      });
      setProductSearch("");
      setResults([]);
    }

    function setQty(productId: string, qty: number) {
      if (qty < 1) { setCart((prev) => prev.filter((e) => e.product.id !== productId)); return; }
      setCart((prev) => prev.map((e) => e.product.id === productId ? { ...e, quantity: qty } : e));
    }

    const total = cart.reduce((sum, e) => sum + e.product.priceCents * e.quantity, 0);

    async function handleCreate() {
      if (!contactPhone.trim()) { setError("Informe o telefone do cliente."); return; }
      if (cart.length === 0) { setError("Adicione pelo menos um produto."); return; }
      setSaving(true);
      setError(null);
      try {
        const res = await apiFetch("/orders", {
          method: "POST",
          body: JSON.stringify({
            contactPhone: contactPhone.trim(),
            items: cart.map((e) => ({ productId: e.product.id, quantity: e.quantity })),
            notes: notes.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as any)?.message ?? "Erro ao criar pedido.");
        }
        onCreated();
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
        title="Novo pedido manual"
        subtitle="Crie um pedido diretamente pelo painel"
        size="lg"
        headerLeading={<ShoppingCart className="w-5 h-5 text-green-400" />}
        footer={
          <>
            <button onClick={onClose} className="btn-ghost" type="button">Cancelar</button>
            <button
              onClick={handleCreate}
              disabled={saving}
              type="button"
              style={{ height: 34, padding: "0 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)", cursor: "pointer" }}
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
              style={{ width: "100%", padding: "8px 12px", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(51,65,85,0.6)", borderRadius: 8, fontSize: 13, color: "#e2e8f0", outline: "none", boxSizing: "border-box" }}
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
                style={{ width: "100%", padding: "8px 12px 8px 32px", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(51,65,85,0.6)", borderRadius: 8, fontSize: 13, color: "#e2e8f0", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            {results.length > 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, background: "#0f172a", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 10, padding: "4px 0", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, display: "flex", justifyContent: "space-between", color: "#94a3b8" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                  >
                    <span style={{ color: "#e2e8f0" }}>{p.name}</span>
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
                  <div key={entry.product.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(51,65,85,0.5)", borderRadius: 8 }}>
                    <span style={{ flex: 1, fontSize: 13, color: "#e2e8f0" }}>{entry.product.name}</span>
                    <span style={{ fontSize: 12, color: "#64748b", width: 80, textAlign: "right" }}>{money(entry.product.priceCents * entry.quantity)}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button type="button" onClick={() => setQty(entry.product.id, entry.quantity - 1)} style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(51,65,85,0.5)", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                      <span style={{ fontSize: 13, color: "#e2e8f0", minWidth: 20, textAlign: "center" }}>{entry.quantity}</span>
                      <button type="button" onClick={() => setQty(entry.product.id, entry.quantity + 1)} style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(51,65,85,0.5)", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                    </div>
                    <button type="button" onClick={() => setQty(entry.product.id, 0)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#475569" }}>
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginTop: 10 }}>
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
              style={{ width: "100%", padding: "8px 12px", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(51,65,85,0.6)", borderRadius: 8, fontSize: 13, color: "#e2e8f0", outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          {error && <p style={{ fontSize: 12, color: "#f87171" }}>{error}</p>}
        </div>
      </Modal>
    );
  }
  ```

- [ ] **Step 2: Wire `CreateOrderModal` into `page.tsx`**

  Add to the imports in `apps/web/src/app/(dashboard)/orders/page.tsx`:

  ```tsx
  import { CreateOrderModal } from "@/components/orders/CreateOrderModal";
  ```

  Add inside the JSX just before `<OrderDetailModal`:

  ```tsx
  <CreateOrderModal
    open={createOpen}
    onClose={() => setCreateOpen(false)}
    onCreated={() => { setCreateOpen(false); void loadOrders(); }}
  />
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  pnpm --filter @whatsagent/web lint
  ```

  Expected: no type errors.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/src/components/orders/CreateOrderModal.tsx apps/web/src/app/(dashboard)/orders/page.tsx
  git commit -m "feat(web): add CreateOrderModal for manual order creation"
  ```

---

## Verification

Run the dev stack and confirm end-to-end:

```bash
pnpm docker:up        # ensure Postgres, Redis, RabbitMQ are running
pnpm dev              # starts all services
```

Visit `http://localhost:3000/orders` and verify:

1. **Actions dropdown** — click `⋯` on any order row → dropdown appears with 3 items
2. **View details** — click "Ver detalhes" → `OrderDetailModal` opens with contact, items, payments
3. **Update status** — click "Atualizar status" → `UpdateStatusModal` opens, select new status, save → row status changes in list after reload
4. **Cancel** — click "Cancelar pedido" → confirm dialog → order status changes to CANCELLED
5. **Manual order** — click "Novo pedido" or "Criar pedido manual" → `CreateOrderModal` opens, enter phone, search and add products, click "Criar pedido" → new order appears in list
6. **Export CSV** — click download icon → browser downloads `pedidos-YYYY-MM-DD.csv` with correct columns
7. **Ver catalogo** — click in empty state → navigates to `/catalog`

Run the API tests one final time:

```bash
pnpm --filter @whatsagent/api test
```

Expected: all pass.
