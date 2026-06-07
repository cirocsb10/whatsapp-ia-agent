import { create } from "zustand";
import { Deal, FunnelStage, CrmStats } from "@/types/crm";

interface CrmStore {
  stages:          FunnelStage[];
  deals:           Deal[];
  stats:           CrmStats | null;
  loading:         boolean;
  statsLoading:    boolean;

  setStages:       (stages: FunnelStage[]) => void;
  setDeals:        (deals: Deal[])         => void;
  setStats:        (stats: CrmStats)       => void;
  setLoading:      (v: boolean)            => void;
  setStatsLoading: (v: boolean)            => void;

  optimisticMove: (dealId: string, toStageId: string)   => void;
  revertMove:     (dealId: string, fromStageId: string)  => void;

  addDeal:    (deal: Deal)      => void;
  updateDeal: (deal: Deal)      => void;
  removeDeal: (dealId: string)  => void;

  addStage:    (stage: FunnelStage)  => void;
  updateStage: (stage: FunnelStage)  => void;
  removeStage: (stageId: string)     => void;
}

export const useCrmStore = create<CrmStore>((set) => ({
  stages:          [],
  deals:           [],
  stats:           null,
  loading:         false,
  statsLoading:    false,

  setStages:       (stages)       => set({ stages }),
  setDeals:        (deals)        => set({ deals }),
  setStats:        (stats)        => set({ stats }),
  setLoading:      (loading)      => set({ loading }),
  setStatsLoading: (statsLoading) => set({ statsLoading }),

  optimisticMove: (dealId, toStageId) =>
    set((s) => ({ deals: s.deals.map((d) => d.id === dealId ? { ...d, stageId: toStageId } : d) })),

  revertMove: (dealId, fromStageId) =>
    set((s) => ({ deals: s.deals.map((d) => d.id === dealId ? { ...d, stageId: fromStageId } : d) })),

  addDeal:    (deal)    => set((s) => ({ deals: [...s.deals, deal] })),
  updateDeal: (deal)    => set((s) => ({ deals: s.deals.map((d) => d.id === deal.id ? deal : d) })),
  removeDeal: (dealId)  => set((s) => ({ deals: s.deals.filter((d) => d.id !== dealId) })),

  addStage:    (stage)   => set((s) => ({ stages: [...s.stages, stage].sort((a, b) => a.position - b.position) })),
  updateStage: (stage)   => set((s) => ({ stages: s.stages.map((st) => st.id === stage.id ? stage : st) })),
  removeStage: (stageId) => set((s) => ({ stages: s.stages.filter((st) => st.id !== stageId) })),
}));
