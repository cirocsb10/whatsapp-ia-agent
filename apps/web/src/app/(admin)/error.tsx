"use client";

import { RouteErrorFallback } from "@/components/shared/RouteErrorFallback";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} backHref="/tenants" backLabel="Voltar para tenants" />;
}
