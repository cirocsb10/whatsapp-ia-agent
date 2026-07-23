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

export interface MessagingCostChannelRow {
  channelId: string | null;
  channelLabel: string;
  messageCount: number;
  costBrlCents: number;
}

export interface MessagingCostCategoryRow {
  category: string;
  messageCount: number;
  costBrlCents: number;
}

export interface MessagingCostData {
  from: string;
  to: string;
  byChannel: MessagingCostChannelRow[];
  byCategory: MessagingCostCategoryRow[];
  totalMessages: number;
  totalBrlCents: number;
  projectedMonthlyBrlCents: number;
  isEstimate: true;
}

export interface DashboardData {
  kpis: Kpis;
  trends: KpiTrends;
  chart: ChartPoint[];
  setupStatus: SetupStatusData;
  funnel: FunnelData;
  handoffReasons: HandoffReasonsData;
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

/** Agregado do overview (F2 §3.4): 1 request cobre kpis+trends+chart+setup+funnel+handoffs. */
export function useDashboard(days: number, refetchInterval?: number) {
  return useQuery({
    queryKey: ["analytics", "dashboard", days],
    queryFn: () => api.get<DashboardData>(`/analytics/dashboard?days=${days}`),
    ...poll(refetchInterval),
  });
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

export function useMessagingCost(days: number, refetchInterval?: number) {
  return useQuery({
    queryKey: ["analytics", "messaging-cost", days],
    queryFn: () => {
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      return api.get<MessagingCostData>(`/analytics/messaging-cost?${params}`);
    },
    ...poll(refetchInterval),
  });
}
