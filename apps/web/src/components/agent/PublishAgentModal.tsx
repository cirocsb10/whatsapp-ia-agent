"use client";
import { Rocket, X, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  publishing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function PublishAgentModal({ open, publishing, onConfirm, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900/95 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-green-500/30 bg-green-500/10">
            <Rocket className="w-6 h-6 text-green-400" strokeWidth={1.8} />
          </div>

          <div>
            <h2 className="text-[17px] font-semibold text-[#e2e8f0]">Publicar agente?</h2>
            <p className="mt-1.5 text-[13px] text-[#64748b] leading-relaxed">
              A partir de agora o agente passará a responder mensagens reais no WhatsApp.
              Certifique-se de que persona, base de conhecimento e guard rails estão configurados.
            </p>
          </div>

          <div className="flex w-full items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.08] p-3 text-left">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" strokeWidth={1.8} />
            <p className="text-[12px] text-amber-300/80 leading-relaxed">
              Clientes que enviarem mensagens enquanto o agente está ativo receberão respostas automáticas imediatamente.
            </p>
          </div>

          <div className="flex w-full gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={publishing}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-[13px] font-medium text-[#94a3b8] transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={publishing}
              className="flex-1 rounded-xl bg-green-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {publishing ? "Publicando…" : "Publicar agente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
