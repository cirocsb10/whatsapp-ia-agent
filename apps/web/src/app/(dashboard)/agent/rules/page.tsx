"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { RuleFormModal, RULE_TYPE_LABELS, ACTION_LABELS } from "@/components/agent/rule-form-modal";
import { TYPE_META } from "@/components/agent/guard-rule-ui";
import { useApi } from "@/lib/hooks/useApi";
import {
  Shield,
  Pencil,
  Trash2,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle2,
  Zap,
  Lock,
  Sparkles,
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  ShieldPlus,
  Filter,
} from "lucide-react";
import { GuardRule, CreateGuardRuleDto } from "@/types/guard-rule";
import Link from "next/link";

const ACTION_BADGE: Record<string, string> = {
  BLOCK: "tag-red",
  REWRITE: "tag-amber",
  HANDOFF: "tag-purple",
  LOG_ONLY: "tag-slate",
};

type FilterKey = "all" | "active" | "inactive";

export default function GuardRulesPage() {
  const { apiFetch } = useApi();
  const [rules, setRules] = useState<GuardRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRule, setEditRule] = useState<GuardRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/agent/rules");
      if (res.ok) setRules(await res.json());
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSubmit(dto: CreateGuardRuleDto) {
    setSaving(true);
    try {
      const url = editRule ? `/agent/rules/${editRule.id}` : "/agent/rules";
      const method = editRule ? "PATCH" : "POST";
      const res = await apiFetch(url, { method, body: JSON.stringify(dto) });
      if (!res.ok) throw new Error(await res.text());
      setToast({ type: "success", msg: editRule ? "Regra atualizada" : "Regra criada" });
      await load();
      setModalOpen(false);
      setEditRule(null);
    } catch {
      setToast({ type: "error", msg: "Erro ao salvar regra" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rule: GuardRule) {
    if (!confirm(`Excluir a regra "${rule.name}"?`)) return;
    try {
      const res = await apiFetch(`/agent/rules/${rule.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setToast({ type: "success", msg: "Regra excluída" });
      await load();
    } catch {
      setToast({ type: "error", msg: "Erro ao excluir regra" });
    }
  }

  async function handleToggle(rule: GuardRule) {
    try {
      await apiFetch(`/agent/rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      await load();
    } catch {
      setToast({ type: "error", msg: "Erro ao atualizar regra" });
    }
  }

  const stats = useMemo(() => {
    const active = rules.filter((r) => r.isActive).length;
    const blocking = rules.filter((r) => r.isActive && (r.action === "BLOCK" || r.action === "HANDOFF")).length;
    return { total: rules.length, active, inactive: rules.length - active, blocking };
  }, [rules]);

  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => a.priority - b.priority),
    [rules],
  );

  const filteredRules = useMemo(() => {
    if (filter === "active") return sortedRules.filter((r) => r.isActive);
    if (filter === "inactive") return sortedRules.filter((r) => !r.isActive);
    return sortedRules;
  }, [sortedRules, filter]);

  const openCreate = () => {
    setEditRule(null);
    setModalOpen(true);
  };

  return (
    <div className="fade-up flex flex-col h-screen overflow-y-auto">
      <Header title="Guard Rails" subtitle="Regras anti-alucinação e limites de comportamento" />

      {toast && (
        <div className={`rules-toast rules-toast-${toast.type}`}>
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.msg}
        </div>
      )}

      <div className="dashboard-page rules-page">
        {/* Hero */}
        <div className={`rules-hero ${stats.total > 0 ? "rules-hero--active" : ""}`}>
          <div className="rules-hero-glow rules-hero-glow--green" aria-hidden="true" />
          <div className="rules-hero-glow rules-hero-glow--indigo" aria-hidden="true" />
          <div className="rules-hero-mesh" aria-hidden="true" />

          <div className="rules-hero-content">
            <div className={`rules-hero-icon ${stats.active > 0 ? "rules-hero-icon--active" : ""}`}>
              <Shield className="w-6 h-6 text-green-400" strokeWidth={1.5} />
              {stats.blocking > 0 && <span className="rules-hero-icon-pulse" aria-hidden="true" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="rules-hero-badge">
                <Sparkles className="w-3 h-3" strokeWidth={2} />
                Guard Rails · Proteção em tempo real
              </div>
              <h2 className="rules-hero-title">
                {loading
                  ? "Carregando…"
                  : `${stats.total} regra${stats.total !== 1 ? "s" : ""} configurada${stats.total !== 1 ? "s" : ""}`}
              </h2>
              <p className="rules-hero-sub">
                {stats.total === 0 ? (
                  "Defina limites para evitar respostas indesejadas e alucinações."
                ) : (
                  <>
                    <span className="rules-hero-accent">
                      {stats.active} ativa{stats.active !== 1 ? "s" : ""}
                    </span>
                    {stats.inactive > 0 && (
                      <> · {stats.inactive} pausada{stats.inactive !== 1 ? "s" : ""}</>
                    )}
                    {stats.blocking > 0 && (
                      <> · {stats.blocking} bloqueio{stats.blocking !== 1 ? "s" : ""} crítico{stats.blocking !== 1 ? "s" : ""}</>
                    )}
                  </>
                )}
              </p>
            </div>

            <button type="button" onClick={openCreate} className="rules-add-btn">
              <span className="rules-add-btn-icon" aria-hidden="true">
                <ShieldPlus className="w-4 h-4" strokeWidth={2} />
              </span>
              Nova regra
            </button>
          </div>

          {stats.total > 0 && (
            <div className="rules-stats-row">
              {[
                { label: "Total", value: stats.total, icon: Shield, color: "#22c55e" },
                { label: "Ativas", value: stats.active, icon: ShieldCheck, color: "#4ade80" },
                { label: "Críticas", value: stats.blocking, icon: ShieldAlert, color: "#f87171" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div
                  key={label}
                  className="rules-stat-chip"
                  style={{ "--chip-accent": color } as React.CSSProperties}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={1.8} />
                  <span className="rules-stat-value">{loading ? "…" : value}</span>
                  <span className="rules-stat-label">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info banner */}
        <div className="rules-info-banner">
          <div className="rules-info-icon">
            <Zap className="w-4 h-4 text-green-400" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="rules-info-title">Como funciona</p>
            <p className="rules-info-desc">
              As regras são avaliadas em ordem de prioridade — menor número executa primeiro.
              Quando uma dispara, a ação definida é aplicada e as demais são ignoradas naquela resposta.
            </p>
          </div>
          <Link href="/agent" className="rules-info-link">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao agente
          </Link>
        </div>

        {/* Rules list */}
        <section>
          <div className="rules-section-head">
            <div>
              <p className="section-title">Regras configuradas</p>
              <p className="rules-section-sub">
                {loading ? "Carregando…" : `${filteredRules.length} de ${sortedRules.length} exibidas`}
              </p>
            </div>

            {sortedRules.length > 0 && (
              <div className="rules-filter-row" role="group" aria-label="Filtrar regras">
                <Filter className="w-3.5 h-3.5 text-[#475569] shrink-0" strokeWidth={1.8} />
                {(
                  [
                    { key: "all" as const, label: "Todas" },
                    { key: "active" as const, label: "Ativas" },
                    { key: "inactive" as const, label: "Pausadas" },
                  ] as const
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`rules-filter-pill ${filter === key ? "rules-filter-pill--active" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading && (
            <div className="rules-list">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rules-card rules-card-skeleton shimmer" />
              ))}
            </div>
          )}

          {!loading && sortedRules.length === 0 && (
            <div className="rules-empty">
              <div className="rules-empty-glow" aria-hidden="true" />
              <div className="rules-empty-icon">
                <Lock className="w-8 h-8 text-green-400/60" strokeWidth={1.5} />
              </div>
              <p className="rules-empty-title">Nenhuma regra configurada</p>
              <p className="rules-empty-desc">
                Crie guard rails para controlar o comportamento do agente, bloquear temas sensíveis
                e evitar respostas imprecisas ou arriscadas.
              </p>
              <button type="button" onClick={openCreate} className="rules-add-btn rules-add-btn--lg">
                <span className="rules-add-btn-icon" aria-hidden="true">
                  <ShieldPlus className="w-4 h-4" strokeWidth={2} />
                </span>
                Criar primeira regra
              </button>
            </div>
          )}

          {!loading && sortedRules.length > 0 && filteredRules.length === 0 && (
            <div className="rules-empty rules-empty--compact">
              <p className="rules-empty-title">Nenhuma regra neste filtro</p>
              <button type="button" onClick={() => setFilter("all")} className="rules-filter-pill rules-filter-pill--active">
                Ver todas
              </button>
            </div>
          )}

          <div className="rules-list">
            {filteredRules.map((rule, idx) => {
              const meta = TYPE_META[rule.type] ?? TYPE_META.REGEX_MATCH;
              const TypeIcon = meta.icon;
              return (
                <div
                  key={rule.id}
                  className={`rules-card ${!rule.isActive ? "rules-card-inactive" : ""}`}
                  style={
                    {
                      "--type-accent": meta.color,
                      "--type-bg": meta.bg,
                      "--type-border": meta.border,
                      animationDelay: `${idx * 45}ms`,
                    } as React.CSSProperties
                  }
                >
                  <div className="rules-card-accent" aria-hidden="true" />

                  <div className="rules-card-priority">
                    <GripVertical className="w-3.5 h-3.5 text-[#334155]" />
                    <span className="rules-priority-num">{rule.priority}</span>
                  </div>

                  <div
                    className="rules-card-type-icon"
                    style={{ background: meta.bg, borderColor: meta.border }}
                  >
                    <TypeIcon className="w-4 h-4" style={{ color: meta.color }} strokeWidth={1.8} />
                  </div>

                  <div className="rules-card-body">
                    <div className="rules-card-top">
                      <span className="rules-card-name">{rule.name}</span>
                      <span
                        className={`rules-status-dot ${rule.isActive ? "rules-status-dot--on" : ""}`}
                        title={rule.isActive ? "Ativa" : "Pausada"}
                      />
                      <span
                        className="rules-type-badge"
                        style={{ color: meta.color, background: meta.bg, borderColor: meta.border }}
                      >
                        {RULE_TYPE_LABELS[rule.type] ?? rule.type}
                      </span>
                      <span className={`tag ${ACTION_BADGE[rule.action] ?? "tag-slate"}`}>
                        {ACTION_LABELS[rule.action] ?? rule.action}
                      </span>
                    </div>
                    {rule.description && <p className="rules-card-desc">{rule.description}</p>}
                    {rule.fallbackMessage && (
                      <p className="rules-card-fallback">
                        <span className="rules-fallback-label">Fallback</span>
                        {rule.fallbackMessage}
                      </p>
                    )}
                  </div>

                  <div className="rules-card-actions">
                    <button
                      type="button"
                      onClick={() => void handleToggle(rule)}
                      className={`rules-action-btn ${rule.isActive ? "rules-action-btn--on" : ""}`}
                      title={rule.isActive ? "Desativar" : "Ativar"}
                      aria-label={rule.isActive ? "Desativar regra" : "Ativar regra"}
                    >
                      {rule.isActive ? (
                        <ToggleRight className="w-5 h-5 text-green-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-[#475569]" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditRule(rule);
                        setModalOpen(true);
                      }}
                      className="rules-action-btn"
                      aria-label="Editar regra"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(rule)}
                      className="rules-action-btn rules-action-danger"
                      aria-label="Excluir regra"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <RuleFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditRule(null);
        }}
        onSubmit={handleSubmit}
        rule={editRule}
        loading={saving}
      />
    </div>
  );
}
