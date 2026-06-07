"use client";

import { useCallback, useRef, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import { useCrmStore } from "@/lib/store/crm.store";
import { useApi } from "@/lib/hooks/useApi";
import { Deal } from "@/types/crm";
import { KanbanColumn } from "./KanbanColumn";
import { DealCard } from "./DealCard";

interface Props {
  onAddDeal:    (stageId: string) => void;
  onEditDeal:   (deal: Deal) => void;
  onDeleteDeal: (deal: Deal) => void;
}

export function KanbanBoard({ onAddDeal, onEditDeal, onDeleteDeal }: Props) {
  const { apiFetch } = useApi();
  const stages         = useCrmStore((s) => s.stages);
  const deals          = useCrmStore((s) => s.deals);
  const optimisticMove = useCrmStore((s) => s.optimisticMove);
  const revertMove     = useCrmStore((s) => s.revertMove);
  const updateDeal     = useCrmStore((s) => s.updateDeal);

  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const dragOriginStageId = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    if (deal) {
      setActiveDeal(deal);
      dragOriginStageId.current = deal.stageId;
    }
  }, [deals]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;

    const draggedDeal = deals.find((d) => d.id === active.id);
    if (!draggedDeal) return;

    const targetStageId =
      stages.find((s) => s.id === over.id)
        ? (over.id as string)
        : deals.find((d) => d.id === over.id)?.stageId ?? null;

    if (!targetStageId || targetStageId === draggedDeal.stageId) return;

    const originStageId = dragOriginStageId.current!;
    optimisticMove(draggedDeal.id, targetStageId);

    try {
      const res = await apiFetch(`/crm/deals/${draggedDeal.id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stageId: targetStageId }),
      });
      if (!res.ok) throw new Error("Falha ao mover negócio");
      const updated: Deal = await res.json();
      updateDeal(updated);
    } catch {
      revertMove(draggedDeal.id, originStageId);
    }
  }, [deals, stages, apiFetch, optimisticMove, revertMove, updateDeal]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="crm-board">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={deals.filter((d) => d.stageId === stage.id)}
            onAddDeal={onAddDeal}
            onEditDeal={onEditDeal}
            onDeleteDeal={onDeleteDeal}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDeal && (
          <DealCard deal={activeDeal} onEdit={() => {}} onDelete={() => {}} />
        )}
      </DragOverlay>
    </DndContext>
  );
}
