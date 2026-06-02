export type GuardRuleType =
  | "TEXT_BLOCK"
  | "SEMANTIC_BLOCK"
  | "NUMERIC_CAP"
  | "PRODUCT_RESTRICT"
  | "HANDOFF_TRIGGER"
  | "REGEX_MATCH";

export type GuardRuleAction = "BLOCK" | "REWRITE" | "HANDOFF" | "LOG_ONLY";

export interface GuardRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: GuardRuleType;
  action: GuardRuleAction;
  priority: number;
  isActive: boolean;
  config: Record<string, unknown>;
  fallbackMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGuardRuleDto {
  name: string;
  description?: string;
  type: GuardRuleType;
  action: GuardRuleAction;
  priority?: number;
  isActive?: boolean;
  config: Record<string, unknown>;
  fallbackMessage?: string;
}

export type UpdateGuardRuleDto = Partial<CreateGuardRuleDto>;
