import { QueryClient, isServer } from "@tanstack/react-query";

/**
 * Defaults do data layer (F0).
 * - staleTime alto o suficiente para navegação instantânea (cache-first) sem revalidar a cada mount.
 * - refetchOnWindowFocus substitui o polling cego (setInterval) por revalidação sob demanda.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * No servidor (RSC) cria sempre um client novo por request; no browser reusa um singleton
 * para preservar o cache entre navegações. Padrão recomendado pelo TanStack Query v5.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
