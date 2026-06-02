"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { RuleFormModal, RULE_TYPE_LABELS, ACTION_LABELS } from "@/components/agent/rule-form-modal";
import { useApi } from "@/lib/hooks/useApi";
import {
  Shield, Plus, Pencil, Trash2, GripVertical,
  ToggleLeft, ToggleRight, AlertCircle, CheckCircle2,
  Zap, Lock,
} from "lucide-react";
import { GuardRule, CreateGuardRuleDto } from "@/types/guard-rule";
import Link from "next/link";

const TYPE_BADGE: Record<string, { color: string; bg: string; border: string }> = {
  TEXT_BLOCK: { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  SEMANTIC_BLOCK: { color: "#fb923c", bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.25)" },
  NUMERIC_CAP: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.25)" },
  PRODUCT_RESTRICT: { color: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.25)" },
  HANDOFF_TRIGGER: { color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.25)" },
  REGEX_MATCH: { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.25)" },
};

const ACTION_BADGE: Record<string, string> = {
  BLOCK: "tag-red",
  REWRITE: "tag-amber",
  HANDOFF: "tag-purple",
  LOG_ONLY: "tag-slate",
};

export default function GuardRulesPage() {
  const { apiFetch } = useApi();
  const [rules, setRules] = useState<GuardRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRule, setEditRule] = useState<GuardRule | null>(null);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => { void load(); }, [load]);

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

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
  const activeCount = rules.filter((r) => r.isActive).length;

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

      <div className="dashboard-page">
        <div className="rules-hero">
          <div className="rules-hero-glow" />
          <div className="rules-hero-content">
            <div className="rules-hero-icon">
              <Shield className="w-6 h-6 text-green-400" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[16px] font-bold text-[#f1f5f9] tracking-tight">
                Proteção do Agente
              </h2>
              <p className="text-[12px] text-[#64748b] mt-0.5 leading-relaxed">
                {sortedRules.length} regra{sortedRules.length !== 1 ? "s" : ""} configurada
                {sortedRules.length > 0 && ` · ${activeCount} ativa${activeCount !== 1 ? "s" : ""}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setEditRule(null); setModalOpen(true); }}
              className="btn-primary shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nova regra
            </button>
          </div>
        </div>

        <div className="rules-info-card">
          <div className="rules-info-icon">
            <Zap className="w-4 h-4 text-indigo-400" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#e2e8f0]">Como funciona</p>
            <p className="text-[11px] text-[#64748b] mt-1 leading-relaxed">
              As regras são avaliadas em ordem de prioridade (menor número = primeiro).
              Quando uma regra dispara, a ação definida é executada e as demais são ignoradas.
            </p>
          </div>
          <Link href="/agent" className="rules-info-link">
            Voltar ao agente
          </Link>
        </div>

        <section>
          <div className="dashboard-section-head">
            <p className="section-title">Regras configuradas</p>
            <span className="text-[10px] text-[#475569]">
              {loading ? "Carregando..." : `${sortedRules.length} total`}
            </span>
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
              <div className="rules-empty-icon">
                <Lock className="w-8 h-8 text-[#334155]" strokeWidth={1.5} />
              </div>
              <p className="text-[14px] font-semibold text-[#94a3b8]">Nenhuma regra configurada</p>
              <p className="text-[12px] text-[#475569] mt-1 max-w-sm text-center leading-relaxed">
                Crie regras para controlar o comportamento do agente e evitar respostas indesejadas.
              </p>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="btn-primary mt-5"
              >
                <Plus className="w-4 h-4" />
                Criar primeira regra
              </button>
            </div>
          )}

          <div className="rules-list">
            {sortedRules.map((rule, idx) => {
              const badge = TYPE_BADGE[rule.type] ?? TYPE_BADGE.REGEX_MATCH!;
              return (
                <div
                  key={rule.id}
                  className={`rules-card ${!rule.isActive ? "rules-card-inactive" : ""}`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="rules-card-priority">
                    <GripVertical className="w-3.5 h-3.5 text-[#334155]" />
                    <span className="rules-priority-num">{rule.priority}</span>
                  </div>

                  <div className="rules-card-body">
                    <div className="rules-card-top">
                      <span className="rules-card-name">{rule.name}</span>
                      <span
                        className="rules-type-badge"
                        style={{ color: badge.color, background: badge.bg, borderColor: badge.border }}
                      >
                        {RULE_TYPE_LABELS[rule.type] ?? rule.type}
                      </span>
                      <span className={`tag ${ACTION_BADGE[rule.action] ?? "tag-slate"}`}>
                        {ACTION_LABELS[rule.action] ?? rule.action}
                      </span>
                    </div>
                    {rule.description && (
                      <p className="rules-card-desc">{rule.description}</p>
                    )}
                    {rule.fallbackMessage && (
                      <p className="rules-card-fallback">
                        Fallback: {rule.fallbackMessage}
                      </p>
                    )}
                  </div>

                  <div className="rules-card-actions">
                    <button
                      type="button"
                      onClick={() => void handleToggle(rule)}
                      className="rules-action-btn"
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
                      onClick={() => { setEditRule(rule); setModalOpen(true); }}
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
        onClose={() => { setModalOpen(false); setEditRule(null); }}
        onSubmit={handleSubmit}
        rule={editRule}
        loading={saving}
      />
    </div>
  );
}
