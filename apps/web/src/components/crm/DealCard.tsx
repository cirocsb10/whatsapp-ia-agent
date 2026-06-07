"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, User, Pencil, Trash2 } from "lucide-react";
import { Deal, formatBRL, formatDate } from "@/types/crm";

interface Props {
  deal:     Deal;
  onEdit:   (deal: Deal) => void;
  onDelete: (deal: Deal) => void;
}

export function DealCard({ deal, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="crm-deal-card">
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="crm-deal-drag"
        aria-label="Arrastar negócio"
      >
        <GripVertical className="w-3 h-3" />
      </button>

      <div className="crm-deal-body">
        <p className="crm-deal-title">{deal.title}</p>

        {deal.valueCents > 0 && (
          <p className="crm-deal-value">{formatBRL(deal.valueCents)}</p>
        )}

        {deal.contact && (
          <div className="crm-deal-contact">
            <User className="w-3 h-3 shrink-0" />
            <span>{deal.contact.name ?? deal.contact.phone}</span>
          </div>
        )}

        <div className="crm-deal-footer">
          <span className="crm-deal-date">{formatDate(deal.createdAt)}</span>
          <div className="crm-deal-actions">
            <button type="button" className="crm-deal-btn" onClick={() => onEdit(deal)} aria-label="Editar">
              <Pencil className="w-3 h-3" />
            </button>
            <button type="button" className="crm-deal-btn crm-deal-btn--danger" onClick={() => onDelete(deal)} aria-label="Excluir">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
