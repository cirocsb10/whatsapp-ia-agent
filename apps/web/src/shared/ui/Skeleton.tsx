import { cn } from "@/lib/utils";

/**
 * Skeleton base do design-system (F0 §3.8).
 * Usar em `loading.tsx`/Suspense e estados de carregamento por tela em vez de spinner global.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-800/60", className)}
      {...props}
    />
  );
}
