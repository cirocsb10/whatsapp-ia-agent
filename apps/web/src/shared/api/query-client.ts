import { MutationCache, QueryCache, QueryClient, isServer } from "@tanstack/react-query";
import { ApiError } from "./fetcher";
import { pushToast } from "@/shared/ui/toast.store";

/**
 * onError central (§3.7): toast padronizado para qualquer query/mutation que falhe,
 * sem cada tela precisar de tratamento próprio. Duas saídas de escape:
 * - `meta: { skipToast: true }` na query/mutation — telas com estado de erro inline
 *   (isError + retry na própria UI) não devem duplicar com um toast.
 * - 401 nunca gera toast aqui — é responsabilidade do middleware/proxy (refresh ou
 *   redirect para /login), um toast seria ruído nesse fluxo.
 */
function normalizeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocorreu um erro inesperado.";
}

function reportError(error: unknown, meta: Record<string, unknown> | undefined) {
  if (meta?.["skipToast"]) return;
  if (error instanceof ApiError && error.status === 401) return;
  pushToast("error", normalizeErrorMessage(error));
}

/**
 * Defaults do data layer (F0).
 * - staleTime alto o suficiente para navegação instantânea (cache-first) sem revalidar a cada mount.
 * - refetchOnWindowFocus substitui o polling cego (setInterval) por revalidação sob demanda.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => reportError(error, query.meta),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => reportError(error, mutation.meta),
    }),
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
