"use client";

import { X } from "lucide-react";
import type { SystemAccessLogItem } from "../api/system-log";

export function LogDrawer({
  log,
  onClose,
}: {
  log: SystemAccessLogItem | null;
  onClose: () => void;
}) {
  if (!log) return null;

  return (
    <div className="super-admin-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="super-admin-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do log de acesso"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Detalhe da requisição
            </p>
            <p className="text-sm font-semibold text-slate-900 mt-1 break-all">
              {log.method} {log.endpoint}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="super-admin-page-btn"
            aria-label="Fechar detalhes"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <dl className="super-admin-drawer-meta">
          <Meta label="Status" value={String(log.statusCode)} />
          <Meta label="Duração" value={`${log.duration} ms`} />
          <Meta label="IP" value={log.ip ?? "—"} />
          <Meta label="Usuário" value={log.userEmail ?? log.userId ?? "—"} />
          <Meta label="Tenant" value={log.tenantId ?? "—"} />
          <Meta
            label="Quando"
            value={new Date(log.createdAt).toLocaleString("pt-BR")}
          />
          <Meta label="User-Agent" value={log.userAgent ?? "—"} />
        </dl>

        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Payload
          </p>
          <pre className="super-admin-drawer-json">
            {log.payload == null
              ? "—"
              : JSON.stringify(log.payload, null, 2)}
          </pre>
        </div>
      </aside>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-[13px] text-slate-900 break-all mt-0.5">{value}</dd>
    </div>
  );
}
