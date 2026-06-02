"use client";

import { UseFormReturn } from "react-hook-form";
import { GuardRuleType } from "@/types/guard-rule";

interface RuleConfigFieldProps {
  type: GuardRuleType | "";
  form: UseFormReturn<any>;
}

export function RuleConfigField({ type, form }: RuleConfigFieldProps) {
  const { register, formState: { errors } } = form;

  if (!type) return null;

  const fieldClass = "form-input form-input-mono";
  const errMsg = errors.configRaw ? String(errors.configRaw.message) : null;

  if (type === "TEXT_BLOCK" || type === "SEMANTIC_BLOCK") {
    return (
      <div className="form-field">
        <label className="form-label">
          Padrões bloqueados <span className="form-label-hint">(um por linha)</span>
        </label>
        <textarea
          {...register("configRaw", { required: "Informe ao menos um padrão" })}
          placeholder={"concorrente\npreço menor\nrefund"}
          rows={4}
          className={fieldClass}
        />
        {errMsg && <p className="form-error">{errMsg}</p>}
        <p className="form-hint">Cada linha vira um padrão de texto bloqueado.</p>
      </div>
    );
  }

  if (type === "REGEX_MATCH") {
    return (
      <div className="form-field">
        <label className="form-label">Expressão Regular</label>
        <input
          {...register("configRaw", { required: "Informe o padrão regex" })}
          placeholder={"\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}"}
          className={fieldClass}
        />
        {errMsg && <p className="form-error">{errMsg}</p>}
      </div>
    );
  }

  if (type === "NUMERIC_CAP") {
    return (
      <div className="form-field">
        <label className="form-label">Desconto máximo permitido (%)</label>
        <input
          type="number"
          min={0}
          max={100}
          {...register("configRaw", { required: "Informe o limite máximo" })}
          placeholder="15"
          className="form-input w-32"
        />
        {errMsg && <p className="form-error">{errMsg}</p>}
      </div>
    );
  }

  if (type === "HANDOFF_TRIGGER") {
    return (
      <div className="form-field">
        <label className="form-label">
          Palavras-chave de transferência <span className="form-label-hint">(uma por linha)</span>
        </label>
        <textarea
          {...register("configRaw", { required: "Informe ao menos uma palavra-chave" })}
          placeholder={"falar com humano\natendente\ngerente"}
          rows={4}
          className={fieldClass}
        />
        {errMsg && <p className="form-error">{errMsg}</p>}
      </div>
    );
  }

  if (type === "PRODUCT_RESTRICT") {
    return (
      <div className="form-field">
        <label className="form-label">
          SKUs restritos <span className="form-label-hint">(um por linha)</span>
        </label>
        <textarea
          {...register("configRaw", { required: "Informe ao menos um SKU" })}
          placeholder={"PROD-001\nPROD-002"}
          rows={4}
          className={fieldClass}
        />
        {errMsg && <p className="form-error">{errMsg}</p>}
      </div>
    );
  }

  return null;
}

export function parseConfigRaw(type: GuardRuleType, raw: string): Record<string, unknown> {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  switch (type) {
    case "TEXT_BLOCK":
    case "SEMANTIC_BLOCK":
      return { patterns: lines };
    case "REGEX_MATCH":
      return { pattern: raw.trim() };
    case "NUMERIC_CAP":
      return { max: Number(raw.trim()) };
    case "HANDOFF_TRIGGER":
      return { keywords: lines };
    case "PRODUCT_RESTRICT":
      return { skus: lines };
    default:
      return {};
  }
}

export function configToRaw(type: GuardRuleType, config: Record<string, unknown>): string {
  switch (type) {
    case "TEXT_BLOCK":
    case "SEMANTIC_BLOCK":
      return ((config.patterns as string[]) ?? []).join("\n");
    case "REGEX_MATCH":
      return (config.pattern as string) ?? "";
    case "NUMERIC_CAP":
      return String(config.max ?? "");
    case "HANDOFF_TRIGGER":
      return ((config.keywords as string[]) ?? []).join("\n");
    case "PRODUCT_RESTRICT":
      return ((config.skus as string[]) ?? []).join("\n");
    default:
      return "";
  }
}
