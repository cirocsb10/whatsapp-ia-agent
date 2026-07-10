import { Skeleton } from "./Skeleton";

/**
 * Skeletons de rota (F1 §3.8): exibidos via `loading.tsx`/Suspense durante o
 * carregamento do segmento — first-paint com estrutura em vez de tela branca.
 */

export function PageSkeleton() {
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export function KpiGridSkeleton({ cards = 10 }: { cards?: number }) {
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 w-full lg:col-span-2" />
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}

export function InboxSkeleton() {
  return (
    <div className="flex h-full">
      <aside className="hidden w-80 flex-col gap-3 border-r border-slate-800/60 p-4 md:flex">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </aside>
      <div className="flex flex-1 items-center justify-center">
        <Skeleton className="h-10 w-40" />
      </div>
    </div>
  );
}
