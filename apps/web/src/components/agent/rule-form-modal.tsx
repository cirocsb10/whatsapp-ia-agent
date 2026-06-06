"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Shield,
  Loader2,
  Sparkles,
  ListOrdered,
  Settings2,
  MessageSquareWarning,
  Check,
  ShieldPlus,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  GuardRule,
  GuardRuleType,
  GuardRuleAction,
  CreateGuardRuleDto,
} from "@/types/guard-rule";
import { RuleConfigField, parseConfigRaw, configToRaw } from "./rule-config-field";
import {
  TYPE_META,
  ACTION_META,
  RULE_TYPE_LABELS,
  ACTION_LABELS,
} from "./guard-rule-ui";

export { RULE_TYPE_LABELS, ACTION_LABELS };

interface FormValues {
  name: string;
  description: string;
  type: GuardRuleType | "";
  action: GuardRuleAction | "";
  priority: number;
  isActive: boolean;
  fallbackMessage: string;
  configRaw: string;
}

interface RuleFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateGuardRuleDto) => Promise<void>;
  rule?: GuardRule | null;
  loading?: boolean;
}

export function RuleFormModal({ open, onClose, onSubmit, rule, loading }: RuleFormModalProps) {
  const form = useForm<FormValues>({
    defaultValues: {
      name: "",
      description: "",
      type: "",
      action: "",
      priority: 100,
      isActive: true,
      fallbackMessage: "",
      configRaw: "",
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const selectedType = watch("type");
  const selectedAction = watch("action");
  const isActive = watch("isActive");

  useEffect(() => {
    if (rule) {
      reset({
        name: rule.name,
        description: rule.description ?? "",
        type: rule.type,
        action: rule.action,
        priority: rule.priority,
        isActive: rule.isActive,
        fallbackMessage: rule.fallbackMessage ?? "",
        configRaw: configToRaw(rule.type, rule.config),
      });
    } else {
      reset({
        name: "",
        description: "",
        type: "",
        action: "",
        priority: 100,
        isActive: true,
        fallbackMessage: "",
        configRaw: "",
      });
    }
  }, [rule, reset, open]);

  async function onFormSubmit(values: FormValues) {
    if (!values.type || !values.action) return;
    const dto: CreateGuardRuleDto = {
      name: values.name,
      type: values.type as GuardRuleType,
      action: values.action as GuardRuleAction,
      priority: values.priority,
      isActive: values.isActive,
      config: parseConfigRaw(values.type as GuardRuleType, values.configRaw),
      ...(values.description ? { description: values.description } : {}),
      ...(values.fallbackMessage ? { fallbackMessage: values.fallbackMessage } : {}),
    };
    await onSubmit(dto);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={rule ? "Editar regra" : "Nova regra de guarda"}
      subtitle="Configure limites e comportamentos do agente IA"
      size="lg"
      panelClassName="rules-modal-panel"
      headerLeading={
        <div className="rules-modal-header-icon">
          <Shield className="w-5 h-5 text-green-400" strokeWidth={1.6} />
        </div>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancelar
          </button>
          <button
            type="submit"
            form="rule-form"
            disabled={loading}
            className="rules-add-btn"
          >
            {loading ? (
              <>
                <span className="rules-add-btn-icon" aria-hidden="true">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </span>
                Salvando...
              </>
            ) : (
              <>
                <span className="rules-add-btn-icon" aria-hidden="true">
                  {rule ? (
                    <ShieldCheck className="w-4 h-4" strokeWidth={2} />
                  ) : (
                    <ShieldPlus className="w-4 h-4" strokeWidth={2} />
                  )}
                </span>
                {rule ? "Salvar alterações" : "Criar regra"}
              </>
            )}
          </button>
        </>
      }
    >
      <form id="rule-form" onSubmit={handleSubmit(onFormSubmit)} className="rules-modal-form">
        <div className="rules-modal-banner">
          <div className="rules-modal-banner-icon">
            <Sparkles className="w-3.5 h-3.5 text-green-400" strokeWidth={2} />
          </div>
          <div>
            <p className="rules-modal-banner-title">Ordem de avaliação</p>
            <p className="rules-modal-banner-desc">
              Regras com prioridade menor são avaliadas primeiro. Quando uma dispara, as demais são
              ignoradas naquela resposta.
            </p>
          </div>
        </div>

        <section className="rules-modal-section">
          <div className="rules-modal-section-head">
            <div className="rules-modal-section-icon">
              <Shield className="w-3.5 h-3.5 text-green-400" strokeWidth={1.8} />
            </div>
            <div>
              <p className="rules-modal-section-title">Identificação</p>
              <p className="rules-modal-section-sub">Nome e contexto da regra</p>
            </div>
          </div>

          <div className="rules-modal-section-body">
            <div className="form-field">
              <label className="form-label">Nome *</label>
              <input
                {...register("name", { required: "Nome é obrigatório" })}
                placeholder="Ex: Bloquear menção a concorrentes"
                className="form-input rules-modal-input"
              />
              {errors.name && <p className="form-error">{errors.name.message}</p>}
            </div>

            <div className="form-field">
              <label className="form-label">Descrição</label>
              <textarea
                {...register("description")}
                placeholder="Descreva quando esta regra dispara"
                rows={2}
                className="form-input rules-modal-input"
              />
            </div>
          </div>
        </section>

        <section className="rules-modal-section">
          <div className="rules-modal-section-head">
            <div className="rules-modal-section-icon rules-modal-section-icon--indigo">
              <Settings2 className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
            </div>
            <div>
              <p className="rules-modal-section-title">Tipo e ação *</p>
              <p className="rules-modal-section-sub">O que monitorar e como reagir</p>
            </div>
          </div>

          <div className="rules-modal-section-body">
            <div className="form-field">
              <span className="form-label">Tipo de proteção</span>
              <div className="rules-modal-type-grid" role="radiogroup" aria-label="Tipo de regra">
                {(Object.entries(TYPE_META) as [GuardRuleType, (typeof TYPE_META)[GuardRuleType]][]).map(
                  ([key, meta]) => {
                    const Icon = meta.icon;
                    const active = selectedType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setValue("type", key, { shouldValidate: true })}
                        className={`rules-modal-type-card ${active ? "rules-modal-type-card--active" : ""}`}
                        style={
                          active
                            ? ({
                                "--type-accent": meta.color,
                                "--type-bg": meta.bg,
                                "--type-border": meta.border,
                              } as React.CSSProperties)
                            : undefined
                        }
                      >
                        <div
                          className="rules-modal-type-icon"
                          style={{ background: meta.bg, borderColor: meta.border }}
                        >
                          <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} strokeWidth={1.8} />
                        </div>
                        <div className="rules-modal-type-text">
                          <span className="rules-modal-type-label">{meta.label}</span>
                          <span className="rules-modal-type-desc">{meta.desc}</span>
                        </div>
                        {active && (
                          <span className="rules-modal-type-check">
                            <Check className="w-3 h-3" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <div className="form-field">
              <span className="form-label">Ação ao disparar</span>
              <div className="rules-modal-action-grid" role="radiogroup" aria-label="Ação da regra">
                {(Object.entries(ACTION_META) as [GuardRuleAction, (typeof ACTION_META)[GuardRuleAction]][]).map(
                  ([key, meta]) => {
                    const Icon = meta.icon;
                    const active = selectedAction === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setValue("action", key, { shouldValidate: true })}
                        className={`rules-modal-action-card ${active ? "rules-modal-action-card--active" : ""}`}
                        style={
                          active
                            ? ({
                                "--action-accent": meta.color,
                                "--action-bg": meta.bg,
                                "--action-border": meta.border,
                              } as React.CSSProperties)
                            : undefined
                        }
                      >
                        <Icon
                          className="w-4 h-4 shrink-0"
                          style={{ color: active ? meta.color : "#64748b" }}
                          strokeWidth={1.8}
                        />
                        <div className="rules-modal-action-text">
                          <span className="rules-modal-action-label">{meta.label}</span>
                          <span className="rules-modal-action-desc">{ACTION_LABELS[key]}</span>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </section>

        {selectedType && (
          <section className="rules-modal-section rules-modal-section--config">
            <div className="rules-modal-section-head">
              <div className="rules-modal-section-icon rules-modal-section-icon--amber">
                <ListOrdered className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.8} />
              </div>
              <div>
                <p className="rules-modal-section-title">Configuração</p>
                <p className="rules-modal-section-sub">
                  Parâmetros para {RULE_TYPE_LABELS[selectedType as GuardRuleType].toLowerCase()}
                </p>
              </div>
            </div>
            <div className="rules-modal-section-body rules-modal-config-panel">
              <RuleConfigField type={selectedType} form={form} />
            </div>
          </section>
        )}

        <section className="rules-modal-section">
          <div className="rules-modal-section-head">
            <div className="rules-modal-section-icon rules-modal-section-icon--rose">
              <MessageSquareWarning className="w-3.5 h-3.5 text-rose-400" strokeWidth={1.8} />
            </div>
            <div>
              <p className="rules-modal-section-title">Comportamento</p>
              <p className="rules-modal-section-sub">Fallback, prioridade e status</p>
            </div>
          </div>

          <div className="rules-modal-section-body">
            <div className="form-field">
              <label className="form-label">Mensagem de fallback</label>
              <textarea
                {...register("fallbackMessage")}
                placeholder="Mensagem enviada quando a regra bloqueia a resposta"
                rows={2}
                className="form-input rules-modal-input"
              />
            </div>

            <div className="rules-modal-footer-row">
              <div className="form-field">
                <label className="form-label">Prioridade</label>
                <input
                  type="number"
                  min={0}
                  {...register("priority", { valueAsNumber: true })}
                  className="form-input rules-modal-input rules-modal-priority-input"
                />
                <p className="form-hint">Menor número = maior prioridade</p>
              </div>

              <label className="rules-modal-active-card">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setValue("isActive", e.target.checked)}
                  className="sr-only"
                />
                <span className={`rules-toggle-track ${isActive ? "rules-toggle-on" : ""}`}>
                  <span className="rules-toggle-thumb" />
                </span>
                <span className="rules-modal-active-text">
                  <span className="rules-modal-active-label">Regra ativa</span>
                  <span className="rules-modal-active-desc">
                    {isActive ? "Será avaliada nas respostas" : "Pausada temporariamente"}
                  </span>
                </span>
              </label>
            </div>
          </div>
        </section>
      </form>
    </Modal>
  );
}
