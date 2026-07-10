"use client";

import { useCallback, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import { useStages, useDeals, useMoveDeal } from "@/features/crm/api/queries";
import { Deal } from "@/types/crm";
import { KanbanColumn } from "./KanbanColumn";
import { DealCard } from "./DealCard";

interface Props {
  onAddDeal:    (stageId: string) => void;
  onEditDeal:   (deal: Deal) => void;
  onDeleteDeal: (deal: Deal) => void;
}

export function KanbanBoard({ onAddDeal, onEditDeal, onDeleteDeal }: Props) {
  const stages = useStages().data ?? [];
  const deals = useDeals().data ?? [];
  const moveDeal = useMoveDeal();

  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    if (deal) setActiveDeal(deal);
  }, [deals]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
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

    // Optimistic move + rollback vivem no hook useMoveDeal.
    moveDeal.mutate({ dealId: draggedDeal.id, stageId: targetStageId });
  }, [deals, stages, moveDeal]);

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
