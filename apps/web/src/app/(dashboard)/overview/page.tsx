import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/shared/api/query-client";
import { fetchDashboardServer } from "@/features/analytics/api/prefetch";
import { OverviewClient } from "./OverviewClient";

// Prefetch do agregado no servidor + HydrationBoundary (§3.4): o client monta já
// com os dados no cache do Query (chave ["analytics","dashboard",30]), sem flash
// de skeleton. prefetchQuery nunca rejeita — se o backend falhar, o client refetcha.
export default async function OverviewPage() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["analytics", "dashboard", 30],
    queryFn: () => fetchDashboardServer(30),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OverviewClient />
    </HydrationBoundary>
  );
}
