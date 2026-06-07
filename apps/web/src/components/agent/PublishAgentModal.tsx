"use client";

import { useEffect, useRef } from "react";
import {
  Rocket,
  AlertTriangle,
  Loader2,
  Bot,
  Database,
  Shield,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export interface PublishChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

interface Props {
  open: boolean;
  publishing: boolean;
  readiness: number;
  checklist: PublishChecklistItem[];
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

const CHECKLIST_ICONS: Record<string, typeof Bot> = {
  persona: Bot,
  knowledge: Database,
  rules: Shield,
};

export function PublishAgentModal({
  open,
  publishing,
  readiness,
  checklist,
  error,
  onConfirm,
  onClose,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const allReady = checklist.every((item) => item.done);

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
            className="catalog-add-btn publish-modal-confirm"
          >
            {publishing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Publicando…
              </>
            ) : (
              "Publicar agente"
            )}
          </button>
        </>
      }
    >
      <div className="publish-modal-body">
        <div className="publish-modal-readiness">
          <div className="publish-modal-readiness-head">
            <span className="publish-modal-readiness-label">Prontidão do agente</span>
            <span className="publish-modal-readiness-pct">{readiness}%</span>
          </div>
          <div className="publish-modal-readiness-track">
            <div
              className="publish-modal-readiness-fill"
              style={{ width: `${readiness}%` }}
            />
          </div>
        </div>

        <p className="publish-modal-desc">
          A partir de agora o agente responderá mensagens reais no WhatsApp.
          Revise os itens abaixo antes de confirmar.
        </p>

        <ul className="publish-modal-checklist">
          {checklist.map((item) => {
            const Icon = CHECKLIST_ICONS[item.key] ?? Bot;
            return (
              <li
                key={item.key}
                className={`publish-modal-check-item${item.done ? " is-done" : ""}`}
              >
                <span className="publish-modal-check-icon">
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
                </span>
                <span className="publish-modal-check-label">{item.label}</span>
                <span className="publish-modal-check-status">
                  {item.done ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
                      OK
                    </>
                  ) : (
                    <>
                      <Circle className="w-3.5 h-3.5" strokeWidth={2} />
                      Pendente
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {!allReady && (
          <div className="publish-modal-hint">
            Você pode publicar mesmo com itens pendentes, mas recomendamos completar a
            configuração primeiro.
          </div>
        )}

        <div className="publish-modal-warning">
          <AlertTriangle className="publish-modal-warning-icon" strokeWidth={2} />
          <div>
            <p className="publish-modal-warning-title">Respostas imediatas</p>
            <p className="publish-modal-warning-desc">
              Clientes que enviarem mensagens receberão respostas automáticas assim que
              o agente estiver ativo.
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
