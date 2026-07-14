"use client";

import { useEffect, useState } from "react";
import { Kanban, TrendingUp, LayoutGrid, DollarSign } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { DealFormModal } from "@/components/crm/DealFormModal";
import { useStages, useDeals, useCrmStats, useDeleteDeal } from "@/features/crm/api/queries";
import { Deal, formatBRL } from "@/types/crm";

export default function CrmPage() {
  const stagesQuery = useStages();
  const dealsQuery = useDeals();
  const statsQuery = useCrmStats();
  const deleteDeal = useDeleteDeal();

  const stages = stagesQuery.data ?? [];
  const stats = statsQuery.data ?? null;
  const loading = stagesQuery.isPending || dealsQuery.isPending;
  const statsLoading = statsQuery.isPending;

  const [formOpen,       setFormOpen]       = useState(false);
  const [editDeal,       setEditDeal]       = useState<Deal | null>(null);
  const [initialStageId, setInitialStageId] = useState<string | undefined>();
  const [toast,          setToast]          = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<Deal | null>(null);
  const [deleting,       setDeleting]       = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const isEditing = !!editDeal;

  function openCreate(stageId: string) {
    setEditDeal(null);
    setInitialStageId(stageId);
    setFormOpen(true);
  }

  function openEdit(deal: Deal) {
    setEditDeal(deal);
    setInitialStageId(undefined);
    setFormOpen(true);
  }

  function handleSaved() {
    setToast({ type: "success", msg: isEditing ? "Negócio atualizado!" : "Negócio criado!" });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDeal.mutateAsync(deleteTarget.id);
      setToast({ type: "success", msg: "Negócio excluído." });
    } catch {
      setToast({ type: "error", msg: "Falha ao excluir o negócio." });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const STAT_CARDS = [
    { label: "Pipeline total",       value: statsLoading ? "…" : formatBRL(stats?.pipelineValueCents ?? 0), icon: DollarSign, color: "#22c55e" },
    { label: "Negócios em aberto",   value: statsLoading ? "…" : String(stats?.openCount ?? 0),              icon: TrendingUp,  color: "#6366f1" },
    { label: "Etapas ativas",        value: statsLoading ? "…" : String(stats?.byStage.length ?? 0),         icon: LayoutGrid,  color: "#06b6d4" },
  ];

  return (
    <div className="fade-up flex flex-col h-screen overflow-hidden">
      <Header title="CRM" subtitle="Funil de vendas e gestão de negócios" />

      <div className="dashboard-page" style={{ flex: 1, overflow: "hidden", gap: 16 }}>
        <div className="catalog-hero" style={{ marginBottom: 0 }}>
          <div className="catalog-hero-content">
            <div className="catalog-hero-badge">
              <Kanban className="w-3 h-3" strokeWidth={2} />
              CRM Kanban
            </div>
            <h2 className="catalog-hero-title">Funil de Vendas</h2>
            <p className="catalog-hero-sub">Arraste os negócios entre as etapas para atualizar o funil</p>
          </div>
          <div className="catalog-hero-actions">
            <button
              type="button"
              className="catalog-add-btn"
              onClick={() => openCreate(stages[0]?.id ?? "")}
            >
              + Novo negócio
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {STAT_CARDS.map((s) => (
            <div key={s.label} style={{
              background: "#ffffff", border: "1px solid var(--c-border)",
              borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: `${s.color}18`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#64748b", fontSize: 13 }}>Carregando funil…</p>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: "auto" }}>
            <KanbanBoard
              onAddDeal={openCreate}
              onEditDeal={openEdit}
              onDeleteDeal={(deal) => setDeleteTarget(deal)}
            />
          </div>
        )}
      </div>

      <DealFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditDeal(null); }}
        onSaved={handleSaved}
        {...(editDeal ? { deal: editDeal } : {})}
        {...(initialStageId ? { initialStageId } : {})}
      />

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-main">
                <div className="modal-header-text">
                  <h2 className="modal-title">Excluir negócio</h2>
                  <p className="modal-subtitle">
                    Tem certeza que deseja excluir &ldquo;{deleteTarget.title}&rdquo;? Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-ghost" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                style={{
                  padding: "0 16px", height: 36, borderRadius: 8,
                  background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 600,
                  border: "none", cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`kb-toast kb-toast--${toast.type}`}
          style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
