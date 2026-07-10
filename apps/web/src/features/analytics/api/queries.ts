import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/fetcher";

export type Kpis = Record<string, number | null>;
export type KpiTrends = Record<string, { change: number; trend: "up" | "down" | "neutral" }>;
export type HandoffReasonsData = Record<string, number>;

export interface FunnelData {
  conversations: number;
  catalog_viewed: number;
  cart_started: number;
  payment_generated: number;
  payment_confirmed: number;
}

export interface SetupStatusData {
  whatsappConnected: boolean;
  agentConfigured: boolean;
  setupComplete: boolean;
}

export interface ChartPoint {
  date: string;
  total: number;
  ai_resolved: number;
  handoffs: number;
}

export interface HeatmapBucket {
  day: number;
  hour: number;
  value: number;
}

/**
 * Hooks de server-state do domínio analytics (F1 §3.3/§3.5).
 *
 * `queryKey` estável por endpoint → overview e analytics compartilham o mesmo cache
 * (dedupe de `/analytics/kpis`, que hoje é buscado 2×). `refetchInterval` opcional
 * substitui o polling cego: o TanStack Query pausa o intervalo com a aba em background
 * (refetchIntervalInBackground=false) e revalida no foco da janela.
 *
 * Nota: `exactOptionalPropertyTypes` exige omitir `refetchInterval` quando indefinido
 * (não passar `undefined` explícito) — daí o spread condicional.
 */
function poll(refetchInterval?: number) {
  return refetchInterval !== undefined ? { refetchInterval } : {};
}

export function useKpis(refetchInterval?: number) {
  return useQuery({
    queryKey: ["analytics", "kpis"],
    queryFn: () => api.get<Kpis>("/analytics/kpis"),
    ...poll(refetchInterval),
  });
}

export function useKpiTrends(refetchInterval?: number) {
  return useQuery({
    queryKey: ["analytics", "kpi-trends"],
    queryFn: () => api.get<KpiTrends>("/analytics/kpi-trends"),
    ...poll(refetchInterval),
  });
}

export function useConversationsChart(days: number, refetchInterval?: number) {
  return useQuery({
    queryKey: ["analytics", "conversations-chart", days],
    queryFn: () => api.get<ChartPoint[]>(`/analytics/conversations-chart?days=${days}`),
    ...poll(refetchInterval),
  });
}

export function useSetupStatus(refetchInterval?: number) {
  return useQuery({
    queryKey: ["analytics", "setup-status"],
    queryFn: () => api.get<SetupStatusData>("/analytics/setup-status"),
    ...poll(refetchInterval),
  });
}

export function useFunnel(days: number, refetchInterval?: number) {
  return useQuery({
    queryKey: ["analytics", "funnel", days],
    queryFn: () => api.get<FunnelData>(`/analytics/funnel?days=${days}`),
    ...poll(refetchInterval),
  });
}

export function useHeatmap(days: number, refetchInterval?: number) {
  return useQuery({
    queryKey: ["analytics", "heatmap", days],
    queryFn: () => api.get<HeatmapBucket[]>(`/analytics/heatmap?days=${days}`),
    ...poll(refetchInterval),
  });
}

export function useHandoffReasons(days: number, refetchInterval?: number) {
  return useQuery({
    queryKey: ["analytics", "handoff-reasons", days],
    queryFn: () => api.get<HandoffReasonsData>(`/analytics/handoff-reasons?days=${days}`),
    ...poll(refetchInterval),
  });
}
