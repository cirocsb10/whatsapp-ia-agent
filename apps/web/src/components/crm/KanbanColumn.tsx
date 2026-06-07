"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Deal, FunnelStage, formatBRL } from "@/types/crm";
import { DealCard } from "./DealCard";

interface Props {
  stage:        FunnelStage;
  deals:        Deal[];
  onAddDeal:    (stageId: string) => void;
  onEditDeal:   (deal: Deal) => void;
  onDeleteDeal: (deal: Deal) => void;
}

export function KanbanColumn({ stage, deals, onAddDeal, onEditDeal, onDeleteDeal }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const totalValue = deals.reduce((sum, d) => sum + d.valueCents, 0);

  return (
    <div className={`crm-column${isOver ? " crm-column--over" : ""}`}>
      <div className="crm-column-header">
        <div className="crm-column-header-left">
          <span className="crm-column-dot" style={{ background: stage.color }} aria-hidden />
          <span className="crm-column-name">{stage.name}</span>
          <span className="crm-column-count">{deals.length}</span>
        </div>
        <button
          type="button"
          className="crm-column-add-btn"
          onClick={() => onAddDeal(stage.id)}
          aria-label={`Adicionar negócio em ${stage.name}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {totalValue > 0 && <p className="crm-column-value">{formatBRL(totalValue)}</p>}

      <div ref={setNodeRef} className="crm-column-cards">
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onEdit={onEditDeal} onDelete={onDeleteDeal} />
          ))}
        </SortableContext>
        {deals.length === 0 && <div className="crm-column-empty">Nenhum negócio</div>}
      </div>
    </div>
  );
}
