"use client";

import { useEffect, useRef } from "react";
import { Rocket, AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface Props {
  open: boolean;
  publishing: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function PublishAgentModal({ open, publishing, error, onConfirm, onClose }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
  }, [open]);

  function handleClose() {
    if (publishing) return;
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Publicar agente?"
      subtitle="Ative respostas automáticas no WhatsApp"
      size="sm"
      panelClassName="publish-modal-panel"
      headerLeading={<Rocket className="w-5 h-5 text-green-400" strokeWidth={1.6} />}
      footer={
        <>
          <button
            ref={cancelRef}
            type="button"
            onClick={handleClose}
            disabled={publishing}
            className="btn-ghost"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={publishing}
            className="rules-add-btn"
          >
            {publishing ? (
              <>
                <span className="rules-add-btn-icon" aria-hidden="true">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </span>
                Publicando…
              </>
            ) : (
              <>
                <span className="rules-add-btn-icon" aria-hidden="true">
                  <Rocket className="w-4 h-4" strokeWidth={2} />
                </span>
                Publicar agente
              </>
            )}
          </button>
        </>
      }
    >
      <div className="publish-modal-body">
        <p className="publish-modal-desc">
          A partir de agora o agente passará a responder mensagens reais no WhatsApp.
          Certifique-se de que persona, base de conhecimento e guard rails estão configurados.
        </p>

        <div className="publish-modal-warning">
          <div className="publish-modal-warning-icon">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" strokeWidth={2} />
          </div>
          <div>
            <p className="publish-modal-warning-title">Atenção</p>
            <p className="publish-modal-warning-desc">
              Clientes que enviarem mensagens enquanto o agente está ativo receberão respostas
              automáticas imediatamente.
            </p>
          </div>
        </div>

        {error && (
          <p className="publish-modal-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
