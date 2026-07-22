"use client";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToastStore, type ToastType } from "./toast.store";

const ICONS: Record<ToastType, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  error: { bg: "#fef2f2", border: "#fecaca", icon: "#dc2626" },
  success: { bg: "#f0fdf4", border: "#bbf7d0", icon: "#16a34a" },
  info: { bg: "#eff6ff", border: "#bfdbfe", icon: "#2563eb" },
};

/** Toasts globais (§3.7): renderizado uma vez em Providers, alimentado pelo
 * onError central do QueryCache/MutationCache e por chamadas diretas via pushToast(). */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[200] flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type];
        const c = COLORS[toast.type];
        return (
          <div
            key={toast.id}
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg animate-fade-in"
            style={{ background: c.bg, borderColor: c.border }}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: c.icon }} strokeWidth={2} />
            <p className="flex-1 text-[12.5px] leading-snug text-[#0f172a]">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Fechar"
              className="shrink-0 text-[#94a3b8] hover:text-[#475569]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
