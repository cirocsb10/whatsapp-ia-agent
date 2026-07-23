"use client";

import { Header } from "@/components/layout/Header";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ScrollText,
  Shield,
} from "lucide-react";
import {
  useSystemLog,
  type SystemAccessLogItem,
  type SystemLogFilters,
} from "@/features/admin/api/system-log";
import { LogDrawer } from "@/features/admin/components/LogDrawer";

const PAGE_SIZE = 50;
const METHODS = ["", "GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function methodBadgeClass(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "super-admin-method-get";
    case "POST":
      return "super-admin-method-post";
    case "PUT":
    case "PATCH":
      return "super-admin-method-put";
    case "DELETE":
      return "super-admin-method-delete";
    default:
      return "super-admin-method-other";
  }
}

function statusBadgeClass(status: number): string {
  if (status >= 500) return "super-admin-status-5xx";
  if (status >= 400) return "super-admin-status-4xx";
  if (status >= 300) return "super-admin-status-3xx";
  return "super-admin-status-2xx";
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export default function SystemLogPage() {
  const [page, setPage] = useState(1);
  const [method, setMethod] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [ip, setIp] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<SystemAccessLogItem | null>(null);

  const debouncedEndpoint = useDebounced(endpoint, 300);
  const debouncedIp = useDebounced(ip, 300);

  const filters: SystemLogFilters = useMemo(
    () => ({
      ...(method ? { method } : {}),
      ...(debouncedEndpoint ? { endpoint: debouncedEndpoint } : {}),
      ...(debouncedIp ? { ip: debouncedIp } : {}),
      ...(from ? { from: new Date(from).toISOString() } : {}),
      ...(to ? { to: new Date(to).toISOString() } : {}),
    }),
    [method, debouncedEndpoint, debouncedIp, from, to],
  );

  useEffect(() => {
    setPage(1);
  }, [method, debouncedEndpoint, debouncedIp, from, to]);

  const query = useSystemLog(filters, page, PAGE_SIZE);
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="fade-up flex flex-col min-h-full">
      <Header
        title="Logs do Sistema"
        subtitle="Registro completo de acesso HTTP da API"
      />

      <div className="dashboard-page space-y-5">
        <section className="super-admin-hero">
          <div className="relative z-10 space-y-2">
            <span className="super-admin-badge">
              <Shield className="w-3 h-3" aria-hidden />
              Controle da plataforma
            </span>
            <p className="dashboard-greeting-title">Log de acesso</p>
            <p className="dashboard-greeting-sub max-w-xl">
              Cada request autenticada (e anônima, exceto health/webhooks) é
              registrada com método, status, duração e payload sanitizado.
            </p>
          </div>
          <div className="relative z-10 hidden sm:flex items-center gap-2 text-slate-500">
            <ScrollText className="w-8 h-8 opacity-40" aria-hidden />
          </div>
        </section>

        <div className="super-admin-table-wrap">
          <div className="super-admin-filters">
            <label className="super-admin-filter-field">
              <span>Método</span>
              <select
                className="settings-input"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {METHODS.map((m) => (
                  <option key={m || "all"} value={m}>
                    {m || "Todos"}
                  </option>
                ))}
              </select>
            </label>
            <label className="super-admin-filter-field">
              <span>Endpoint</span>
              <input
                className="settings-input"
                placeholder="/auth/login"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
              />
            </label>
            <label className="super-admin-filter-field">
              <span>IP</span>
              <input
                className="settings-input"
                placeholder="127.0.0.1"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
              />
            </label>
            <label className="super-admin-filter-field">
              <span>De</span>
              <input
                className="settings-input"
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="super-admin-filter-field">
              <span>Até</span>
              <input
                className="settings-input"
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="super-admin-table-head">
                  <th>Quando</th>
                  <th>Método</th>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>Usuário</th>
                  <th>IP</th>
                  <th>ms</th>
                </tr>
              </thead>
              <tbody>
                {query.isLoading && (
                  <tr className="super-admin-table-row">
                    <td colSpan={7}>
                      <div className="shimmer h-8 w-full rounded" />
                    </td>
                  </tr>
                )}
                {!query.isLoading && items.length === 0 && (
                  <tr className="super-admin-table-row">
                    <td colSpan={7} className="text-sm text-slate-500 text-center py-8">
                      Nenhum log encontrado para os filtros atuais.
                    </td>
                  </tr>
                )}
                {items.map((log) => (
                  <tr
                    key={log.id}
                    className="super-admin-table-row cursor-pointer"
                    onClick={() => setSelected(log)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(log);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Abrir detalhes de ${log.method} ${log.endpoint}`}
                  >
                    <td className="text-[12px] text-slate-600 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td>
                      <span className={`super-admin-method-badge ${methodBadgeClass(log.method)}`}>
                        {log.method}
                      </span>
                    </td>
                    <td className="text-[13px] text-slate-900 font-medium max-w-[280px] truncate">
                      {log.endpoint}
                    </td>
                    <td>
                      <span className={`super-admin-status-badge ${statusBadgeClass(log.statusCode)}`}>
                        {log.statusCode}
                      </span>
                    </td>
                    <td className="text-[12px] text-slate-600 max-w-[160px] truncate">
                      {log.userEmail ?? "—"}
                    </td>
                    <td className="text-[12px] text-slate-500 font-mono">
                      {log.ip ?? "—"}
                    </td>
                    <td className="text-[12px] text-slate-500 tabular-nums">
                      {log.duration}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="super-admin-pagination">
            <p className="text-[12px] text-slate-500">
              {total} registro{total === 1 ? "" : "s"} · página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="super-admin-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden />
              </button>
              <button
                type="button"
                className="super-admin-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Próxima página"
              >
                <ChevronRight className="w-4 h-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>

      <LogDrawer log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
