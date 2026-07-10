import { cookies } from "next/headers";
import { API_URL } from "@/lib/auth/api-url";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import type { DashboardData } from "./queries";

/**
 * Busca o agregado do dashboard no backend a partir do RSC, usando o token do
 * cookie httpOnly (mesmo padrão de server/auth.ts). Usado para prefetch +
 * HydrationBoundary do overview, eliminando o flash de skeleton no client (§3.4).
 */
export async function fetchDashboardServer(days: number): Promise<DashboardData> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const res = await fetch(`${API_URL}/analytics/dashboard?days=${days}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`dashboard prefetch failed: ${res.status}`);
  return (await res.json()) as DashboardData;
}
