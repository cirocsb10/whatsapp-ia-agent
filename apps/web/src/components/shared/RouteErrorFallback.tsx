"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  backHref?: string;
  backLabel?: string;
}

/** Error boundary por rota (§3.7): mantém o layout (sidebar/header) montado,
 * reporta ao Sentry e permite retry sem recarregar a página inteira. */
export function RouteErrorFallback({
  error,
  reset,
  title = "Algo deu errado nesta tela",
  backHref = "/overview",
  backLabel = "Voltar à visão geral",
}: Props) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}
      >
        <AlertTriangle className="h-5 w-5 text-red-500" strokeWidth={1.8} />
      </div>
      <div className="max-w-[360px]">
        <p className="text-[14px] font-semibold text-[#0f172a]">{title}</p>
        <p className="mt-1 text-[12px] text-[#64748b]">
          A equipe já foi notificada. Você pode tentar novamente ou voltar para a visão geral.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#22C55E] px-4 py-2 text-[12px] font-semibold text-[#020617] transition hover:brightness-110"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Tentar novamente
        </button>
        <Link
          href={backHref}
          className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-[12px] font-medium text-[#64748b] transition hover:bg-slate-50"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
