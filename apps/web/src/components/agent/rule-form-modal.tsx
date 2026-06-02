"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Shield, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  GuardRule,
  GuardRuleType,
  GuardRuleAction,
  CreateGuardRuleDto,
} from "@/types/guard-rule";
import { RuleConfigField, parseConfigRaw, configToRaw } from "./rule-config-field";

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

export const RULE_TYPE_LABELS: Record<GuardRuleType, string> = {
  TEXT_BLOCK: "Bloquear texto",
  SEMANTIC_BLOCK: "Bloquear semântico",
  NUMERIC_CAP: "Limite numérico",
  PRODUCT_RESTRICT: "Restringir produto",
  HANDOFF_TRIGGER: "Acionar transferência",
  REGEX_MATCH: "Regex",
};

export const ACTION_LABELS: Record<GuardRuleAction, string> = {
  BLOCK: "Bloquear resposta",
  REWRITE: "Reescrever resposta",
  HANDOFF: "Transferir para humano",
  LOG_ONLY: "Apenas registrar",
};

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

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = form;
  const selectedType = watch("type");
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
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancelar
          </button>
          <button
            type="submit"
            form="rule-form"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Salvando...
              </>
            ) : rule ? (
              "Salvar alterações"
            ) : (
              "Criar regra"
            )}
          </button>
        </>
      }
    >
      <form id="rule-form" onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        <div className="rules-form-banner">
          <Shield className="w-4 h-4 text-green-400 shrink-0" strokeWidth={1.8} />
          <p className="text-[11px] text-[#94a3b8] leading-relaxed">
            Regras com prioridade menor são avaliadas primeiro. Quando uma dispara, as demais são ignoradas.
          </p>
        </div>

        <div className="form-field">
          <label className="form-label">Nome *</label>
          <input
            {...register("name", { required: "Nome é obrigatório" })}
            placeholder="Ex: Bloquear menção a concorrentes"
            className="form-input"
          />
          {errors.name && <p className="form-error">{errors.name.message}</p>}
        </div>

        <div className="form-field">
          <label className="form-label">Descrição</label>
          <textarea
            {...register("description")}
            placeholder="Descreva quando esta regra dispara"
            rows={2}
            className="form-input"
          />
        </div>

        <div className="form-grid-2">
          <div className="form-field">
            <label className="form-label">Tipo *</label>
            <select
              value={selectedType}
              onChange={(e) => setValue("type", e.target.value as GuardRuleType)}
              className="form-input form-select"
            >
              <option value="">Selecione...</option>
              {(Object.keys(RULE_TYPE_LABELS) as GuardRuleType[]).map((t) => (
                <option key={t} value={t}>{RULE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Ação *</label>
            <select
              value={watch("action")}
              onChange={(e) => setValue("action", e.target.value as GuardRuleAction)}
              className="form-input form-select"
            >
              <option value="">Selecione...</option>
              {(Object.keys(ACTION_LABELS) as GuardRuleAction[]).map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a]}</option>
              ))}
            </select>
          </div>
        </div>

        <RuleConfigField type={selectedType} form={form} />

        <div className="form-field">
          <label className="form-label">Mensagem de fallback</label>
          <textarea
            {...register("fallbackMessage")}
            placeholder="Mensagem enviada quando a regra bloqueia a resposta"
            rows={2}
            className="form-input"
          />
        </div>

        <div className="flex items-end gap-6">
          <div className="form-field flex-1">
            <label className="form-label">Prioridade</label>
            <input
              type="number"
              min={0}
              {...register("priority", { valueAsNumber: true })}
              className="form-input w-24"
            />
            <p className="form-hint">Menor número = maior prioridade</p>
          </div>
          <label className="rules-toggle">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setValue("isActive", e.target.checked)}
              className="sr-only"
            />
            <span className={`rules-toggle-track ${isActive ? "rules-toggle-on" : ""}`}>
              <span className="rules-toggle-thumb" />
            </span>
            <span className="text-[12px] text-[#94a3b8] font-medium">Ativa</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}
