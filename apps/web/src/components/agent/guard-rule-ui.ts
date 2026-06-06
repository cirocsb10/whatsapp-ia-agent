import {
  Ban,
  Brain,
  Hash,
  Package,
  UserRound,
  Code2,
  ShieldOff,
  PenLine,
  Headphones,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { GuardRuleType, GuardRuleAction } from "@/types/guard-rule";

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

export type RuleTypeMeta = {
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
};

export const TYPE_META: Record<GuardRuleType, RuleTypeMeta> = {
  TEXT_BLOCK: {
    label: "Bloquear texto",
    desc: "Palavras ou frases proibidas",
    icon: Ban,
    color: "#f87171",
    bg: "rgba(248,113,113,0.12)",
    border: "rgba(248,113,113,0.25)",
  },
  SEMANTIC_BLOCK: {
    label: "Bloquear semântico",
    desc: "Temas sensíveis por IA",
    icon: Brain,
    color: "#fb923c",
    bg: "rgba(251,146,60,0.12)",
    border: "rgba(251,146,60,0.25)",
  },
  NUMERIC_CAP: {
    label: "Limite numérico",
    desc: "Teto de valores e quantidades",
    icon: Hash,
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.12)",
    border: "rgba(251,191,36,0.25)",
  },
  PRODUCT_RESTRICT: {
    label: "Restringir produto",
    desc: "Catálogo permitido ou bloqueado",
    icon: Package,
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.12)",
    border: "rgba(96,165,250,0.25)",
  },
  HANDOFF_TRIGGER: {
    label: "Transferência",
    desc: "Encaminha para humano",
    icon: UserRound,
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    border: "rgba(167,139,250,0.25)",
  },
  REGEX_MATCH: {
    label: "Regex",
    desc: "Padrões avançados",
    icon: Code2,
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.12)",
    border: "rgba(148,163,184,0.25)",
  },
};

export type RuleActionMeta = {
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
};

export const ACTION_META: Record<GuardRuleAction, RuleActionMeta> = {
  BLOCK: {
    label: "Bloquear",
    desc: "Interrompe a resposta",
    icon: ShieldOff,
    color: "#f87171",
    bg: "rgba(248,113,113,0.12)",
    border: "rgba(248,113,113,0.25)",
  },
  REWRITE: {
    label: "Reescrever",
    desc: "Ajusta antes de enviar",
    icon: PenLine,
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.12)",
    border: "rgba(251,191,36,0.25)",
  },
  HANDOFF: {
    label: "Transferir",
    desc: "Passa para humano",
    icon: Headphones,
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    border: "rgba(167,139,250,0.25)",
  },
  LOG_ONLY: {
    label: "Registrar",
    desc: "Apenas audita o evento",
    icon: ScrollText,
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.12)",
    border: "rgba(148,163,184,0.25)",
  },
};
