# Plan 5 — Rule Builder UI, Knowledge Base Embeddings, Analytics & E2E Tests

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Scope note:** Este "Plan 5" cobre 4 subsistemas independentes. Estão organizados como 3 planos autônomos abaixo — execute um de cada vez.

---

## Descobertas da Exploração (não toque nisto)

- **Guard Rules API**: **já implementada** — `GET/POST/PATCH/DELETE /agent/rules` existem em `apps/api/src/modules/agent/agent-config.controller.ts` (l. 65-91) e `guard-rules.service.ts`. Só falta a UI.
- **KnowledgeBase schema**: existe com `KnowledgeChunk.embedding vector(1536)` via pgvector.
- **EmbeddingsService** Python: existe em `apps/ai-orchestrator/src/services/embeddings.py` (para produtos). Reutilizar para KB.
- **BullMQ processor**: `apps/api/src/queue/embedding.processor.ts` existe mas **não está registrado** em nenhum módulo.
- **Analytics**: 5 endpoints existem; `ai_resolution_rate` (85%) e `avg_response_time_sec` (4s) são hardcoded em `apps/api/src/modules/analytics/analytics.service.ts`.

---

---

# PLANO 5a — Rule Builder UI

**Goal:** Construir a interface CRUD de guard rules em `/agent/rules` — a API já existe, só falta o frontend.

**Architecture:** Página Next.js no route `/agent/rules`, fazendo fetch para `/agent/rules` via `useApi` hook. Formulário modal com campos dinâmicos por tipo de regra (config JSON varia por `GuardRuleType`).

**Tech Stack:** Next.js 14 App Router, shadcn/ui, Tailwind CSS v4, Lucide React, `useApi` hook existente, Zod + react-hook-form

---

### Tipos e interfaces

**Files:**
- Create: `apps/web/src/types/guard-rule.ts`

- [ ] **Step 1: Criar tipos TypeScript**

```typescript
// apps/web/src/types/guard-rule.ts
export type GuardRuleType =
  | 'TEXT_BLOCK'
  | 'SEMANTIC_BLOCK'
  | 'NUMERIC_CAP'
  | 'PRODUCT_RESTRICT'
  | 'HANDOFF_TRIGGER'
  | 'REGEX_MATCH';

export type GuardRuleAction = 'BLOCK' | 'REWRITE' | 'HANDOFF' | 'LOG_ONLY';

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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/types/guard-rule.ts
git commit -m "feat(web): add GuardRule TypeScript types"
```

---

### Task 1: Componente RuleConfigField (campos dinâmicos por tipo)

**Files:**
- Create: `apps/web/src/components/agent/rule-config-field.tsx`

- [ ] **Step 1: Criar componente de config dinâmica**

```tsx
// apps/web/src/components/agent/rule-config-field.tsx
'use client';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GuardRuleType } from '@/types/guard-rule';

interface RuleConfigFieldProps {
  type: GuardRuleType | '';
  form: UseFormReturn<any>;
}

export function RuleConfigField({ type, form }: RuleConfigFieldProps) {
  const { register, formState: { errors } } = form;

  if (!type) return null;

  if (type === 'TEXT_BLOCK' || type === 'SEMANTIC_BLOCK') {
    return (
      <div className="space-y-1">
        <Label className="text-slate-300 text-sm">
          Padrões bloqueados <span className="text-slate-500">(um por linha)</span>
        </Label>
        <Textarea
          {...register('configRaw', { required: 'Informe ao menos um padrão' })}
          placeholder={"concorrente\npreço menor\nrefund"}
          className="bg-slate-800/50 border-slate-700 text-slate-200 h-24 text-sm font-mono"
        />
        {errors.configRaw && (
          <p className="text-red-400 text-xs">{String(errors.configRaw.message)}</p>
        )}
        <p className="text-slate-500 text-xs">Cada linha vira um padrão de texto bloqueado.</p>
      </div>
    );
  }

  if (type === 'REGEX_MATCH') {
    return (
      <div className="space-y-1">
        <Label className="text-slate-300 text-sm">Expressão Regular</Label>
        <Input
          {...register('configRaw', { required: 'Informe o padrão regex' })}
          placeholder={"\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}"}
          className="bg-slate-800/50 border-slate-700 text-slate-200 font-mono text-sm"
        />
        {errors.configRaw && (
          <p className="text-red-400 text-xs">{String(errors.configRaw.message)}</p>
        )}
      </div>
    );
  }

  if (type === 'NUMERIC_CAP') {
    return (
      <div className="space-y-1">
        <Label className="text-slate-300 text-sm">Desconto máximo permitido (%)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          {...register('configRaw', { required: 'Informe o limite máximo' })}
          placeholder="15"
          className="bg-slate-800/50 border-slate-700 text-slate-200 w-32"
        />
        {errors.configRaw && (
          <p className="text-red-400 text-xs">{String(errors.configRaw.message)}</p>
        )}
      </div>
    );
  }

  if (type === 'HANDOFF_TRIGGER') {
    return (
      <div className="space-y-1">
        <Label className="text-slate-300 text-sm">
          Palavras-chave de transferência <span className="text-slate-500">(uma por linha)</span>
        </Label>
        <Textarea
          {...register('configRaw', { required: 'Informe ao menos uma palavra-chave' })}
          placeholder={"falar com humano\natendente\ngerente"}
          className="bg-slate-800/50 border-slate-700 text-slate-200 h-24 text-sm font-mono"
        />
        {errors.configRaw && (
          <p className="text-red-400 text-xs">{String(errors.configRaw.message)}</p>
        )}
      </div>
    );
  }

  if (type === 'PRODUCT_RESTRICT') {
    return (
      <div className="space-y-1">
        <Label className="text-slate-300 text-sm">
          SKUs restritos <span className="text-slate-500">(um por linha)</span>
        </Label>
        <Textarea
          {...register('configRaw', { required: 'Informe ao menos um SKU' })}
          placeholder={"PROD-001\nPROD-002"}
          className="bg-slate-800/50 border-slate-700 text-slate-200 h-24 text-sm font-mono"
        />
        {errors.configRaw && (
          <p className="text-red-400 text-xs">{String(errors.configRaw.message)}</p>
        )}
      </div>
    );
  }

  return null;
}

/** Converte configRaw (string do textarea) para o objeto config esperado pela API */
export function parseConfigRaw(type: GuardRuleType, raw: string): Record<string, unknown> {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  switch (type) {
    case 'TEXT_BLOCK':
    case 'SEMANTIC_BLOCK':
      return { patterns: lines };
    case 'REGEX_MATCH':
      return { pattern: raw.trim() };
    case 'NUMERIC_CAP':
      return { max: Number(raw.trim()) };
    case 'HANDOFF_TRIGGER':
      return { keywords: lines };
    case 'PRODUCT_RESTRICT':
      return { skus: lines };
    default:
      return {};
  }
}

/** Converte objeto config da API para string exibível no textarea */
export function configToRaw(type: GuardRuleType, config: Record<string, unknown>): string {
  switch (type) {
    case 'TEXT_BLOCK':
    case 'SEMANTIC_BLOCK':
      return ((config.patterns as string[]) ?? []).join('\n');
    case 'REGEX_MATCH':
      return (config.pattern as string) ?? '';
    case 'NUMERIC_CAP':
      return String(config.max ?? '');
    case 'HANDOFF_TRIGGER':
      return ((config.keywords as string[]) ?? []).join('\n');
    case 'PRODUCT_RESTRICT':
      return ((config.skus as string[]) ?? []).join('\n');
    default:
      return '';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/agent/rule-config-field.tsx
git commit -m "feat(web): add RuleConfigField dynamic config component"
```

---

### Task 2: Modal de criação/edição de regra

**Files:**
- Create: `apps/web/src/components/agent/rule-form-modal.tsx`

- [ ] **Step 1: Criar modal de formulário**

```tsx
// apps/web/src/components/agent/rule-form-modal.tsx
'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { GuardRule, GuardRuleType, GuardRuleAction, CreateGuardRuleDto } from '@/types/guard-rule';
import { RuleConfigField, parseConfigRaw, configToRaw } from './rule-config-field';

interface FormValues {
  name: string;
  description: string;
  type: GuardRuleType | '';
  action: GuardRuleAction | '';
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

const RULE_TYPE_LABELS: Record<GuardRuleType, string> = {
  TEXT_BLOCK: 'Bloquear texto',
  SEMANTIC_BLOCK: 'Bloquear semântico',
  NUMERIC_CAP: 'Limite numérico',
  PRODUCT_RESTRICT: 'Restringir produto',
  HANDOFF_TRIGGER: 'Acionar transferência',
  REGEX_MATCH: 'Regex',
};

const ACTION_LABELS: Record<GuardRuleAction, string> = {
  BLOCK: 'Bloquear resposta',
  REWRITE: 'Reescrever resposta',
  HANDOFF: 'Transferir para humano',
  LOG_ONLY: 'Apenas registrar',
};

export function RuleFormModal({ open, onClose, onSubmit, rule, loading }: RuleFormModalProps) {
  const form = useForm<FormValues>({
    defaultValues: {
      name: '',
      description: '',
      type: '',
      action: '',
      priority: 100,
      isActive: true,
      fallbackMessage: '',
      configRaw: '',
    },
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = form;
  const selectedType = watch('type');

  useEffect(() => {
    if (rule) {
      reset({
        name: rule.name,
        description: rule.description ?? '',
        type: rule.type,
        action: rule.action,
        priority: rule.priority,
        isActive: rule.isActive,
        fallbackMessage: rule.fallbackMessage ?? '',
        configRaw: configToRaw(rule.type, rule.config),
      });
    } else {
      reset({ name: '', description: '', type: '', action: '', priority: 100, isActive: true, fallbackMessage: '', configRaw: '' });
    }
  }, [rule, reset, open]);

  async function onFormSubmit(values: FormValues) {
    if (!values.type || !values.action) return;
    const dto: CreateGuardRuleDto = {
      name: values.name,
      description: values.description || undefined,
      type: values.type as GuardRuleType,
      action: values.action as GuardRuleAction,
      priority: values.priority,
      isActive: values.isActive,
      fallbackMessage: values.fallbackMessage || undefined,
      config: parseConfigRaw(values.type as GuardRuleType, values.configRaw),
    };
    await onSubmit(dto);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">
            {rule ? 'Editar regra' : 'Nova regra de guarda'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-slate-300 text-sm">Nome *</Label>
            <Input
              {...register('name', { required: 'Nome é obrigatório' })}
              placeholder="Ex: Bloquear menção a concorrentes"
              className="bg-slate-800/50 border-slate-700 text-slate-200"
            />
            {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label className="text-slate-300 text-sm">Descrição</Label>
            <Textarea
              {...register('description')}
              placeholder="Descreva quando esta regra dispara"
              className="bg-slate-800/50 border-slate-700 text-slate-200 h-16 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-300 text-sm">Tipo *</Label>
              <Select
                value={selectedType}
                onValueChange={(v) => setValue('type', v as GuardRuleType)}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700 text-slate-200">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {(Object.keys(RULE_TYPE_LABELS) as GuardRuleType[]).map((t) => (
                    <SelectItem key={t} value={t} className="text-slate-200 focus:bg-slate-700">
                      {RULE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-sm">Ação *</Label>
              <Select
                value={watch('action')}
                onValueChange={(v) => setValue('action', v as GuardRuleAction)}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700 text-slate-200">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {(Object.keys(ACTION_LABELS) as GuardRuleAction[]).map((a) => (
                    <SelectItem key={a} value={a} className="text-slate-200 focus:bg-slate-700">
                      {ACTION_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <RuleConfigField type={selectedType} form={form} />

          <div className="space-y-1">
            <Label className="text-slate-300 text-sm">Mensagem de fallback</Label>
            <Textarea
              {...register('fallbackMessage')}
              placeholder="Mensagem enviada quando a regra bloqueia a resposta"
              className="bg-slate-800/50 border-slate-700 text-slate-200 h-16 text-sm"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="space-y-1 flex-1">
              <Label className="text-slate-300 text-sm">Prioridade</Label>
              <Input
                type="number"
                min={0}
                {...register('priority', { valueAsNumber: true })}
                className="bg-slate-800/50 border-slate-700 text-slate-200 w-24"
              />
              <p className="text-slate-500 text-xs">Menor número = maior prioridade</p>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Switch
                checked={watch('isActive')}
                onCheckedChange={(v) => setValue('isActive', v)}
                className="data-[state=checked]:bg-green-500"
              />
              <Label className="text-slate-300 text-sm">Ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {loading ? 'Salvando...' : rule ? 'Salvar alterações' : 'Criar regra'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/agent/rule-form-modal.tsx
git commit -m "feat(web): add RuleFormModal for guard rule create/edit"
```

---

### Task 3: Página /agent/rules

**Files:**
- Create (ou substituir): `apps/web/src/app/(dashboard)/agent/rules/page.tsx`

- [ ] **Step 1: Verificar se a página já existe**

```bash
ls apps/web/src/app/(dashboard)/agent/
```

Se existir `rules/page.tsx`, leia o conteúdo antes de sobrescrever.

- [ ] **Step 2: Criar página de listagem e gerenciamento de regras**

```tsx
// apps/web/src/app/(dashboard)/agent/rules/page.tsx
'use client';
import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { Shield, Plus, Pencil, Trash2, GripVertical, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RuleFormModal } from '@/components/agent/rule-form-modal';
import { GuardRule, CreateGuardRuleDto } from '@/types/guard-rule';
import { toast } from 'sonner';

const TYPE_BADGE_COLOR: Record<string, string> = {
  TEXT_BLOCK: 'bg-red-500/20 text-red-300 border-red-500/30',
  SEMANTIC_BLOCK: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  NUMERIC_CAP: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  PRODUCT_RESTRICT: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  HANDOFF_TRIGGER: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  REGEX_MATCH: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const TYPE_LABELS: Record<string, string> = {
  TEXT_BLOCK: 'Bloquear texto',
  SEMANTIC_BLOCK: 'Bloquear semântico',
  NUMERIC_CAP: 'Limite numérico',
  PRODUCT_RESTRICT: 'Restringir produto',
  HANDOFF_TRIGGER: 'Transferência',
  REGEX_MATCH: 'Regex',
};

const ACTION_LABELS: Record<string, string> = {
  BLOCK: 'Bloquear',
  REWRITE: 'Reescrever',
  HANDOFF: 'Transferir',
  LOG_ONLY: 'Só registrar',
};

export default function GuardRulesPage() {
  const { data: rules, loading, mutate } = useApi<GuardRule[]>('/agent/rules');
  const [modalOpen, setModalOpen] = useState(false);
  const [editRule, setEditRule] = useState<GuardRule | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(dto: CreateGuardRuleDto) {
    setSaving(true);
    try {
      const url = editRule ? `/agent/rules/${editRule.id}` : '/agent/rules';
      const method = editRule ? 'PATCH' : 'POST';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(dto),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(editRule ? 'Regra atualizada' : 'Regra criada');
      await mutate();
      setModalOpen(false);
      setEditRule(null);
    } catch (err) {
      toast.error('Erro ao salvar regra');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rule: GuardRule) {
    if (!confirm(`Excluir a regra "${rule.name}"?`)) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agent/rules/${rule.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      toast.success('Regra excluída');
      await mutate();
    } catch {
      toast.error('Erro ao excluir regra');
    }
  }

  async function handleToggle(rule: GuardRule) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/agent/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      await mutate();
    } catch {
      toast.error('Erro ao atualizar regra');
    }
  }

  const sortedRules = [...(rules ?? [])].sort((a, b) => a.priority - b.priority);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Regras de guarda</h1>
            <p className="text-sm text-slate-400">
              {sortedRules.length} regra{sortedRules.length !== 1 ? 's' : ''} configurada{sortedRules.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button
          onClick={() => { setEditRule(null); setModalOpen(true); }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova regra
        </Button>
      </div>

      {/* Info box */}
      <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-4 text-sm text-indigo-300">
        <strong>Como funciona:</strong> As regras são avaliadas em ordem de prioridade (menor número = primeiro). Quando uma regra dispara, a ação definida é executada e as demais regras de menor prioridade são ignoradas.
      </div>

      {/* Rules list */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && sortedRules.length === 0 && (
        <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-12 text-center">
          <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Nenhuma regra configurada.</p>
          <p className="text-slate-500 text-xs mt-1">
            Crie regras para controlar o comportamento do agente e evitar respostas indesejadas.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {sortedRules.map((rule) => (
          <div
            key={rule.id}
            className={`rounded-xl border p-4 transition-all ${
              rule.isActive
                ? 'bg-slate-900/80 border-slate-700/50 backdrop-blur-2xl'
                : 'bg-slate-900/40 border-slate-800/50 opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              <GripVertical className="w-4 h-4 text-slate-600 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white text-sm">{rule.name}</span>
                  <Badge className={`text-xs border ${TYPE_BADGE_COLOR[rule.type] ?? ''}`}>
                    {TYPE_LABELS[rule.type] ?? rule.type}
                  </Badge>
                  <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                    {ACTION_LABELS[rule.action] ?? rule.action}
                  </Badge>
                  <span className="text-xs text-slate-500">prioridade {rule.priority}</span>
                </div>
                {rule.description && (
                  <p className="text-xs text-slate-400 mt-1 truncate">{rule.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleToggle(rule)}
                  className="w-8 h-8 text-slate-400 hover:text-white"
                  title={rule.isActive ? 'Desativar' : 'Ativar'}
                >
                  {rule.isActive
                    ? <ToggleRight className="w-4 h-4 text-green-400" />
                    : <ToggleLeft className="w-4 h-4" />
                  }
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => { setEditRule(rule); setModalOpen(true); }}
                  className="w-8 h-8 text-slate-400 hover:text-white"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(rule)}
                  className="w-8 h-8 text-slate-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
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
```

> **Nota:** Verifique como o `useApi` hook está implementado em `apps/web/src/hooks/useApi.ts`. Se a assinatura for diferente (ex: retorna array `[data, loading]`), ajuste os destructures acima. O padrão `{ data, loading, mutate }` é o mais comum para SWR/fetch hooks.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/agent/rules/page.tsx
git commit -m "feat(web): add guard rules management page at /agent/rules"
```

---

### Verificação do Plano 5a

- [ ] Abrir `http://localhost:3000/agent/rules` no browser
- [ ] Criar uma regra do tipo `TEXT_BLOCK` — verificar que a lista atualiza
- [ ] Editar a regra criada — verificar que os campos são preenchidos corretamente
- [ ] Desativar/ativar via toggle — verificar mudança visual
- [ ] Excluir a regra — verificar remoção da lista
- [ ] Verificar responsividade em mobile (340px)

---

---

# PLANO 5b — Knowledge Base BullMQ Embeddings

**Goal:** Indexar itens da base de conhecimento como chunks vetoriais (pgvector) via BullMQ, e expor um `knowledge_search_tool` no orquestrador Python para o agente recuperar contexto relevante.

**Architecture:** Quando um `KnowledgeBase` item é criado/atualizado via API, um job BullMQ é enfileirado em `apps/api`. O processador chama o orquestrador Python via HTTP (`POST /internal/index-knowledge/{id}`). O orquestrador chunka o conteúdo, gera embeddings via OpenAI (`text-embedding-3-small`) e salva `KnowledgeChunk` records com vetores. O `knowledge_search_tool` faz busca cosine no pgvector e retorna os chunks mais relevantes para o raciocínio do agente.

**Tech Stack:** `@nestjs/bull`, `bull`, BullMQ, OpenAI embeddings (já configurado no Python), pgvector `<=>`, LangChain `@tool`

---

### Task 1: Registrar BullMQ no NestJS

**Files:**
- Modify: `apps/api/package.json` (dependências)
- Modify: `apps/api/src/modules/agent/agent.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Instalar dependências BullMQ**

```bash
pnpm --filter @whatsagent/api add @nestjs/bull bull
pnpm --filter @whatsagent/api add -D @types/bull
```

- [ ] **Step 2: Verificar se REDIS_URL está disponível na config do API**

```bash
grep -r "REDIS" apps/api/src/
```

Se não existir um `ConfigService` lendo `REDIS_URL`, adicione a variável ao `app.module.ts` imports do `BullModule.forRootAsync`.

- [ ] **Step 3: Registrar BullModule global em app.module.ts**

Em `apps/api/src/app.module.ts`, adicionar no array `imports`:

```typescript
import { BullModule } from '@nestjs/bull';

// Dentro do @Module imports:
BullModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    redis: config.get<string>('REDIS_URL'),
  }),
}),
```

- [ ] **Step 4: Registrar a fila no AgentModule**

Em `apps/api/src/modules/agent/agent.module.ts`, adicionar:

```typescript
import { BullModule } from '@nestjs/bull';

export const KNOWLEDGE_EMBEDDING_QUEUE = 'knowledge-embeddings';

// No @Module imports:
BullModule.registerQueue({ name: KNOWLEDGE_EMBEDDING_QUEUE }),
```

E exportar a constante para uso no service.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/modules/agent/agent.module.ts apps/api/package.json
git commit -m "feat(api): register BullMQ and knowledge-embeddings queue"
```

---

### Task 2: Endpoint de indexação no orquestrador Python

**Files:**
- Create: `apps/ai-orchestrator/src/routes/internal.py`
- Modify: `apps/ai-orchestrator/src/main.py`

- [ ] **Step 1: Criar service de indexação de knowledge base**

Primeiro verifique como o `EmbeddingsService` está estruturado:

```bash
# Leia apps/ai-orchestrator/src/services/embeddings.py
```

- [ ] **Step 2: Criar rotas internas**

```python
# apps/ai-orchestrator/src/routes/internal.py
from fastapi import APIRouter, HTTPException
from ..services.knowledge_indexing import KnowledgeIndexingService

router = APIRouter(prefix="/internal", tags=["internal"])
_indexing_service = KnowledgeIndexingService()


@router.post("/index-knowledge/{knowledge_base_id}")
async def index_knowledge_base(knowledge_base_id: str, tenant_id: str):
    """Called by NestJS BullMQ processor to index a knowledge base item."""
    try:
        chunk_count = await _indexing_service.index(knowledge_base_id, tenant_id)
        return {"success": True, "chunk_count": chunk_count}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 3: Criar KnowledgeIndexingService**

```python
# apps/ai-orchestrator/src/services/knowledge_indexing.py
import asyncpg
import re
from .embeddings import EmbeddingsService
from ..config import settings


class KnowledgeIndexingService:
    def __init__(self):
        self._embeddings = EmbeddingsService()

    async def index(self, knowledge_base_id: str, tenant_id: str) -> int:
        conn = await asyncpg.connect(settings.database_url)
        try:
            row = await conn.fetchrow(
                "SELECT id, content, type FROM knowledge_bases WHERE id=$1 AND tenant_id=$2",
                knowledge_base_id, tenant_id,
            )
            if not row:
                raise ValueError(f"KnowledgeBase {knowledge_base_id} not found")

            chunks = self._split_into_chunks(row["content"])

            # Remove existing chunks before re-indexing
            await conn.execute(
                "DELETE FROM knowledge_chunks WHERE knowledge_base_id=$1",
                knowledge_base_id,
            )

            for i, chunk_text in enumerate(chunks):
                embedding = await self._embeddings.embed(chunk_text)
                embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
                await conn.execute(
                    """
                    INSERT INTO knowledge_chunks (id, knowledge_base_id, tenant_id, content, embedding, chunk_index)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, $5)
                    """,
                    knowledge_base_id, tenant_id, chunk_text, embedding_str, i,
                )

            await conn.execute(
                """
                UPDATE knowledge_bases
                SET is_indexed=true, indexed_at=now(), chunk_count=$1
                WHERE id=$2
                """,
                len(chunks), knowledge_base_id,
            )

            return len(chunks)
        finally:
            await conn.close()

    def _split_into_chunks(self, content: str, max_chars: int = 500) -> list[str]:
        """Splits content into ~500-char chunks on paragraph/sentence boundaries."""
        paragraphs = re.split(r'\n{2,}', content.strip())
        chunks: list[str] = []
        current = ""
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            if len(current) + len(para) < max_chars:
                current = (current + "\n\n" + para).strip()
            else:
                if current:
                    chunks.append(current)
                current = para
        if current:
            chunks.append(current)
        return chunks or [content[:max_chars]]
```

- [ ] **Step 4: Registrar router em main.py**

Em `apps/ai-orchestrator/src/main.py`, adicionar:

```python
from .routes.internal import router as internal_router

app.include_router(internal_router)
```

- [ ] **Step 5: Escrever testes**

```python
# apps/ai-orchestrator/tests/test_knowledge_indexing.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_split_into_chunks_short_content():
    from src.services.knowledge_indexing import KnowledgeIndexingService
    svc = KnowledgeIndexingService()
    chunks = svc._split_into_chunks("Hello world", max_chars=500)
    assert chunks == ["Hello world"]


@pytest.mark.asyncio
async def test_split_into_chunks_long_content():
    from src.services.knowledge_indexing import KnowledgeIndexingService
    svc = KnowledgeIndexingService()
    content = ("A" * 300 + "\n\n") * 5
    chunks = svc._split_into_chunks(content, max_chars=500)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= 600  # some slack for paragraph boundary


@pytest.mark.asyncio
async def test_index_calls_embed_for_each_chunk():
    from src.services.knowledge_indexing import KnowledgeIndexingService
    svc = KnowledgeIndexingService()
    svc._embeddings.embed = AsyncMock(return_value=[0.1] * 1536)

    fake_row = {"id": "kb-1", "content": "Chunk one\n\nChunk two", "type": "text"}
    fake_conn = AsyncMock()
    fake_conn.fetchrow = AsyncMock(return_value=fake_row)

    with patch("asyncpg.connect", AsyncMock(return_value=fake_conn)):
        count = await svc.index("kb-1", "tenant-1")

    assert count == 2
    assert svc._embeddings.embed.call_count == 2
```

- [ ] **Step 6: Rodar testes**

```bash
cd apps/ai-orchestrator
pytest tests/test_knowledge_indexing.py -v
```

Esperado: 3 testes passando.

- [ ] **Step 7: Commit**

```bash
git add apps/ai-orchestrator/src/services/knowledge_indexing.py \
        apps/ai-orchestrator/src/routes/internal.py \
        apps/ai-orchestrator/src/main.py \
        apps/ai-orchestrator/tests/test_knowledge_indexing.py
git commit -m "feat(orchestrator): add knowledge base indexing endpoint and service"
```

---

### Task 3: BullMQ Processor no NestJS

**Files:**
- Modify: `apps/api/src/queue/embedding.processor.ts` (reescrever para KB)
- Create: `apps/api/src/modules/agent/knowledge-indexing.service.ts`
- Modify: `apps/api/src/modules/agent/knowledge.service.ts`
- Modify: `apps/api/src/modules/agent/agent.module.ts`

- [ ] **Step 1: Ler o embedding.processor.ts existente**

```bash
# Leia apps/api/src/queue/embedding.processor.ts para entender o que já existe
```

- [ ] **Step 2: Criar KnowledgeIndexingService no NestJS**

```typescript
// apps/api/src/modules/agent/knowledge-indexing.service.ts
import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { KNOWLEDGE_EMBEDDING_QUEUE } from './agent.module';

@Injectable()
export class KnowledgeIndexingService {
  private readonly logger = new Logger(KnowledgeIndexingService.name);

  constructor(
    @InjectQueue(KNOWLEDGE_EMBEDDING_QUEUE)
    private readonly embeddingQueue: Queue,
  ) {}

  async enqueueIndexing(knowledgeBaseId: string, tenantId: string): Promise<void> {
    await this.embeddingQueue.add(
      'index-knowledge',
      { knowledgeBaseId, tenantId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
    this.logger.log(`Enqueued indexing for KB ${knowledgeBaseId}`);
  }
}
```

- [ ] **Step 3: Criar o processor BullMQ**

```typescript
// apps/api/src/queue/knowledge-embedding.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { KNOWLEDGE_EMBEDDING_QUEUE } from '../modules/agent/agent.module';

interface IndexJobData {
  knowledgeBaseId: string;
  tenantId: string;
}

@Processor(KNOWLEDGE_EMBEDDING_QUEUE)
export class KnowledgeEmbeddingProcessor {
  private readonly logger = new Logger(KnowledgeEmbeddingProcessor.name);

  constructor(private readonly config: ConfigService) {}

  @Process('index-knowledge')
  async handleIndexing(job: Job<IndexJobData>): Promise<void> {
    const { knowledgeBaseId, tenantId } = job.data;
    this.logger.log(`Processing indexing job for KB ${knowledgeBaseId}`);

    const orchestratorUrl = this.config.get<string>('AI_ORCHESTRATOR_URL', 'http://localhost:8000');
    const res = await fetch(
      `${orchestratorUrl}/internal/index-knowledge/${knowledgeBaseId}?tenant_id=${tenantId}`,
      { method: 'POST' },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Indexing failed: ${body}`);
    }

    const result = await res.json();
    this.logger.log(`KB ${knowledgeBaseId} indexed: ${result.chunk_count} chunks`);
  }
}
```

- [ ] **Step 4: Atualizar AgentModule**

Em `apps/api/src/modules/agent/agent.module.ts`, adicionar ao `providers`:

```typescript
import { KnowledgeIndexingService } from './knowledge-indexing.service';
import { KnowledgeEmbeddingProcessor } from '../../queue/knowledge-embedding.processor';

providers: [
  AgentConfigService,
  KnowledgeService,
  GuardRulesService,
  ChatSimulatorService,
  KnowledgeIndexingService,
  KnowledgeEmbeddingProcessor,
],
```

- [ ] **Step 5: Disparar indexação quando KB item é criado/atualizado**

Leia `apps/api/src/modules/agent/knowledge.service.ts` e localize o método `create` (e `update` se existir). Injete `KnowledgeIndexingService` no construtor e adicione ao final:

```typescript
// Após o createMany/create retornar o knowledge base criado:
await this.knowledgeIndexingService.enqueueIndexing(created.id, tenantId);
return created;
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/agent/ apps/api/src/queue/knowledge-embedding.processor.ts
git commit -m "feat(api): wire BullMQ processor for knowledge base embedding indexing"
```

---

### Task 4: Tool knowledge_search no orquestrador Python

**Files:**
- Modify: `apps/ai-orchestrator/src/graph/tools.py`

- [ ] **Step 1: Adicionar knowledge_search_tool**

No arquivo `apps/ai-orchestrator/src/graph/tools.py`, após a definição dos tools existentes, adicionar:

```python
@tool
async def knowledge_search_tool(query: str, tenant_id: str, limit: int = 4) -> str:
    """
    Search the tenant's knowledge base for information relevant to the query.
    Use this when the user asks about topics that may be in the company's FAQ,
    policies, product descriptions, or any indexed knowledge.

    Args:
        query: The question or topic to search for
        tenant_id: Tenant identifier
        limit: Max chunks to return (default 4)

    Returns:
        Relevant knowledge base excerpts, or a message if nothing found
    """
    import asyncpg
    from ..config import settings
    from ..services.embeddings import EmbeddingsService

    _embeddings = EmbeddingsService()
    embedding = await _embeddings.embed(query)
    embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"

    conn = await asyncpg.connect(settings.database_url)
    try:
        rows = await conn.fetch(
            """
            SELECT kc.content,
                   kb.name AS source,
                   1 - (kc.embedding <=> $1::vector) AS similarity
            FROM knowledge_chunks kc
            JOIN knowledge_bases kb ON kb.id = kc.knowledge_base_id
            WHERE kc.tenant_id = $2
              AND 1 - (kc.embedding <=> $1::vector) > 0.6
            ORDER BY kc.embedding <=> $1::vector
            LIMIT $3
            """,
            embedding_str, tenant_id, limit,
        )
    finally:
        await conn.close()

    if not rows:
        return "Nenhuma informação relevante encontrada na base de conhecimento."

    parts = []
    for row in rows:
        parts.append(f"[{row['source']}] {row['content']}")
    return "\n\n---\n\n".join(parts)
```

- [ ] **Step 2: Adicionar ao ALL_TOOLS**

Localizar `ALL_TOOLS = [...]` no mesmo arquivo e adicionar `knowledge_search_tool`:

```python
ALL_TOOLS = [
    catalog_search_tool,
    get_stock_tool,
    add_to_cart_tool,
    generate_payment_link_tool,
    verify_business_hours_tool,
    transfer_to_human_tool,
    get_conversation_history_tool,
    knowledge_search_tool,  # NEW
]
```

- [ ] **Step 3: Escrever testes**

```python
# apps/ai-orchestrator/tests/test_knowledge_search_tool.py
import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_knowledge_search_returns_results():
    from src.graph.tools import knowledge_search_tool

    fake_embedding = [0.1] * 1536
    fake_rows = [
        {"content": "Nosso horário é 9h-18h", "source": "FAQ", "similarity": 0.85},
    ]
    fake_conn = AsyncMock()
    fake_conn.fetch = AsyncMock(return_value=fake_rows)

    with patch("src.services.embeddings.EmbeddingsService.embed", AsyncMock(return_value=fake_embedding)), \
         patch("asyncpg.connect", AsyncMock(return_value=fake_conn)):
        result = await knowledge_search_tool.ainvoke({"query": "horário", "tenant_id": "t1"})

    assert "Nosso horário é 9h-18h" in result
    assert "[FAQ]" in result


@pytest.mark.asyncio
async def test_knowledge_search_returns_not_found():
    from src.graph.tools import knowledge_search_tool

    fake_conn = AsyncMock()
    fake_conn.fetch = AsyncMock(return_value=[])

    with patch("src.services.embeddings.EmbeddingsService.embed", AsyncMock(return_value=[0.1] * 1536)), \
         patch("asyncpg.connect", AsyncMock(return_value=fake_conn)):
        result = await knowledge_search_tool.ainvoke({"query": "xyz", "tenant_id": "t1"})

    assert "Nenhuma informação" in result
```

- [ ] **Step 4: Rodar testes**

```bash
cd apps/ai-orchestrator
pytest tests/test_knowledge_search_tool.py -v
```

- [ ] **Step 5: Commit**

```bash
git add apps/ai-orchestrator/src/graph/tools.py apps/ai-orchestrator/tests/test_knowledge_search_tool.py
git commit -m "feat(orchestrator): add knowledge_search_tool to agent toolset"
```

---

### Verificação do Plano 5b

- [ ] Criar um item na knowledge base via UI ou API: `POST /agent/knowledge` com `{ name: "FAQ", type: "faq", content: "Nosso horário de atendimento é de segunda a sexta, das 9h às 18h.\n\nTemos suporte por WhatsApp e email." }`
- [ ] Verificar no Redis que o job foi enfileirado: `redis-cli llen bull:knowledge-embeddings:wait`
- [ ] Verificar nos logs do API o processamento do job
- [ ] Verificar no DB que `knowledge_chunks` foram criados: `SELECT COUNT(*) FROM knowledge_chunks WHERE tenant_id='...'`
- [ ] Verificar que `knowledge_bases.is_indexed = true` para o item criado
- [ ] Testar o tool no simulador de chat: perguntar algo que esteja no conteúdo indexado

---

---

# PLANO 5c — Analytics Avançado + E2E Tests Python

**Goal:** Corrigir métricas hardcoded no analytics, adicionar CSAT e custo de tokens, e criar testes de integração para o pipeline completo do orquestrador.

**Architecture:** Fixes no `analytics.service.ts` usando queries Prisma reais. Dois novos KPIs. Testes de integração no Python que exercitam o grafo LangGraph com mocks de DB e LLM.

**Tech Stack:** Prisma `$queryRaw` / `groupBy`, pytest-asyncio, `unittest.mock`

---

### Task 1: Corrigir KPIs hardcoded

**Files:**
- Modify: `apps/api/src/modules/analytics/analytics.service.ts`

- [ ] **Step 1: Ler analytics.service.ts completo**

```bash
# Leia apps/api/src/modules/analytics/analytics.service.ts
```

Identifique as linhas com `85` (ai_resolution_rate) e `4` (avg_response_time_sec) para confirmar o contexto.

- [ ] **Step 2: Substituir ai_resolution_rate pelo cálculo real**

Localizar o trecho hardcoded e substituir pela query Prisma:

```typescript
// ANTES (hardcoded):
// ai_resolution_rate: 85,

// DEPOIS (calculado):
const closedToday = await this.prisma.conversation.count({
  where: { tenantId, status: 'CLOSED', closedAt: { gte: startOfDay } },
});
const closedByAiToday = await this.prisma.conversation.count({
  where: {
    tenantId,
    status: 'CLOSED',
    closedAt: { gte: startOfDay },
    messages: { some: { isFromAi: true } },
    handoffEvents: { none: {} },
  },
});
const ai_resolution_rate =
  closedToday > 0 ? Math.round((closedByAiToday / closedToday) * 100) : 0;
```

- [ ] **Step 3: Substituir avg_response_time_sec pelo cálculo real**

```typescript
// ANTES (hardcoded):
// avg_response_time_sec: 4,

// DEPOIS (calculado):
const latencyResult = await this.prisma.message.aggregate({
  where: {
    tenantId,
    isFromAi: true,
    aiLatencyMs: { not: null },
    sentAt: { gte: startOfDay },
  },
  _avg: { aiLatencyMs: true },
});
const avg_response_time_sec = latencyResult._avg.aiLatencyMs
  ? Math.round(latencyResult._avg.aiLatencyMs / 1000)
  : 0;
```

- [ ] **Step 4: Adicionar avg_csat_score e ai_tokens_today aos KPIs**

No objeto de retorno do `getKpis`, adicionar:

```typescript
// CSAT médio dos últimos 7 dias
const csatResult = await this.prisma.conversation.aggregate({
  where: {
    tenantId,
    csatScore: { not: null },
    closedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  },
  _avg: { csatScore: true },
});
const avg_csat_score = csatResult._avg.csatScore
  ? Number(csatResult._avg.csatScore.toFixed(1))
  : null;

// Tokens consumidos hoje
const tokensResult = await this.prisma.message.aggregate({
  where: {
    tenantId,
    isFromAi: true,
    aiTokensUsed: { not: null },
    sentAt: { gte: startOfDay },
  },
  _sum: { aiTokensUsed: true },
});
const ai_tokens_today = tokensResult._sum.aiTokensUsed ?? 0;

return {
  // ... campos existentes ...
  ai_resolution_rate,
  avg_response_time_sec,
  avg_csat_score,
  ai_tokens_today,
};
```

- [ ] **Step 5: Rodar testes do API**

```bash
pnpm --filter @whatsagent/api test
```

Esperado: todos passando (sem quebrar os existentes).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/analytics/analytics.service.ts
git commit -m "fix(api): replace hardcoded analytics KPIs with real DB queries; add csat and token metrics"
```

---

### Task 2: Exibir novos KPIs no frontend

**Files:**
- Modify: `apps/web/src/app/(dashboard)/overview/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/analytics/page.tsx`

- [ ] **Step 1: Ler overview/page.tsx para entender a estrutura dos KpiCard**

```bash
# Leia apps/web/src/app/(dashboard)/overview/page.tsx
```

- [ ] **Step 2: Adicionar KpiCard de CSAT e tokens**

Localizar onde os `KpiCard`s são renderizados e adicionar (após os existentes):

```tsx
// CSAT score
<KpiCard
  title="CSAT (7 dias)"
  value={kpis?.avg_csat_score != null ? `${kpis.avg_csat_score}/5` : '—'}
  icon={Star}
  iconColor="text-yellow-400"
  loading={loading}
/>

// Tokens consumidos hoje
<KpiCard
  title="Tokens hoje"
  value={kpis?.ai_tokens_today != null
    ? kpis.ai_tokens_today > 1000
      ? `${(kpis.ai_tokens_today / 1000).toFixed(1)}k`
      : String(kpis.ai_tokens_today)
    : '—'
  }
  icon={Cpu}
  iconColor="text-indigo-400"
  loading={loading}
/>
```

Importar `Star` e `Cpu` de `lucide-react` no topo do arquivo.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/overview/page.tsx
git commit -m "feat(web): show CSAT and token metrics in overview KPIs"
```

---

### Task 3: Testes de integração do orquestrador Python

**Files:**
- Create: `apps/ai-orchestrator/tests/test_integration_pipeline.py`

- [ ] **Step 1: Ler tests/test_agent.py para entender o padrão de mock existente**

```bash
# Leia apps/ai-orchestrator/tests/test_agent.py
```

- [ ] **Step 2: Criar testes de integração do pipeline completo**

```python
# apps/ai-orchestrator/tests/test_integration_pipeline.py
"""
Integration tests for the full LangGraph conversation pipeline.
External dependencies (DB, LLM, RabbitMQ) are mocked.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from langchain_core.messages import HumanMessage, AIMessage


def make_mock_llm_response(content: str):
    """Creates a mock LLM response that LangChain understands."""
    mock_response = MagicMock()
    mock_response.content = content
    mock_response.tool_calls = []
    return mock_response


@pytest.fixture
def base_state():
    return {
        "tenant_id": "tenant-test",
        "conversation_id": "conv-001",
        "contact_phone": "+5511999999999",
        "messages": [HumanMessage(content="Qual o horário de atendimento?")],
        "system_prompt": "Você é um assistente de vendas.",
        "intent": None,
        "guard_rail_triggered": False,
        "guard_rail_action": None,
        "guard_rail_reason": None,
        "guard_rail_fallback": None,
        "should_handoff": False,
        "final_response": None,
    }


@pytest.mark.asyncio
async def test_full_pipeline_happy_path(base_state):
    """Full pipeline: entry → route → reasoning → guard_rail → output."""
    from src.graph.agent import get_agent_graph

    mock_llm_response = make_mock_llm_response("Atendemos de segunda a sexta, das 9h às 18h.")

    with patch("src.graph.nodes._fetch_guard_rules", AsyncMock(return_value=[])), \
         patch("src.graph.nodes._get_llm_with_tools") as mock_get_llm, \
         patch("src.graph.nodes._build_system_prompt", AsyncMock(return_value="prompt")), \
         patch("src.graph.nodes._classify_intent", AsyncMock(return_value="faq")):

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=mock_llm_response)
        mock_get_llm.return_value = mock_llm

        graph = get_agent_graph()
        result = await graph.ainvoke(base_state)

    assert result["final_response"] is not None
    assert result["guard_rail_triggered"] is False
    assert result["should_handoff"] is False


@pytest.mark.asyncio
async def test_pipeline_guard_rail_block(base_state):
    """Guard rail with TEXT_BLOCK should set guard_rail_triggered=True and use fallback."""
    from src.graph.agent import get_agent_graph
    from src.models.guard_rule import GuardRule

    block_rule = GuardRule(
        id="rule-1",
        tenant_id="tenant-test",
        name="Block competitor",
        type="TEXT_BLOCK",
        action="BLOCK",
        priority=10,
        is_active=True,
        config={"patterns": ["concorrente"]},
        fallback_message="Não posso falar sobre isso.",
    )

    mock_llm_response = make_mock_llm_response("Nossa concorrente cobra mais barato.")

    with patch("src.graph.nodes._fetch_guard_rules", AsyncMock(return_value=[block_rule])), \
         patch("src.graph.nodes._get_llm_with_tools") as mock_get_llm, \
         patch("src.graph.nodes._build_system_prompt", AsyncMock(return_value="prompt")), \
         patch("src.graph.nodes._classify_intent", AsyncMock(return_value="general")):

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=mock_llm_response)
        mock_get_llm.return_value = mock_llm

        graph = get_agent_graph()
        result = await graph.ainvoke(base_state)

    assert result["guard_rail_triggered"] is True
    assert result["guard_rail_action"] == "BLOCK"
    assert "Não posso falar sobre isso" in (result["final_response"] or "")


@pytest.mark.asyncio
async def test_pipeline_handoff_trigger(base_state):
    """HANDOFF_TRIGGER rule should set should_handoff=True."""
    from src.graph.agent import get_agent_graph
    from src.models.guard_rule import GuardRule

    handoff_rule = GuardRule(
        id="rule-2",
        tenant_id="tenant-test",
        name="Human request",
        type="HANDOFF_TRIGGER",
        action="HANDOFF",
        priority=5,
        is_active=True,
        config={"keywords": ["falar com humano"]},
        fallback_message=None,
    )

    base_state["messages"] = [HumanMessage(content="Quero falar com humano")]
    mock_llm_response = make_mock_llm_response("Vou te transferir para um atendente.")

    with patch("src.graph.nodes._fetch_guard_rules", AsyncMock(return_value=[handoff_rule])), \
         patch("src.graph.nodes._get_llm_with_tools") as mock_get_llm, \
         patch("src.graph.nodes._build_system_prompt", AsyncMock(return_value="prompt")), \
         patch("src.graph.nodes._classify_intent", AsyncMock(return_value="general")):

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(return_value=mock_llm_response)
        mock_get_llm.return_value = mock_llm

        graph = get_agent_graph()
        result = await graph.ainvoke(base_state)

    assert result["should_handoff"] is True


@pytest.mark.asyncio
async def test_pipeline_with_tool_call(base_state):
    """Reasoning node should execute tool calls and return final response."""
    from src.graph.agent import get_agent_graph

    # First call: LLM requests catalog_search_tool
    mock_tool_call_response = MagicMock()
    mock_tool_call_response.content = ""
    mock_tool_call_response.tool_calls = [{
        "id": "call-1",
        "name": "catalog_search_tool",
        "args": {"query": "camiseta", "tenant_id": "tenant-test"},
    }]

    # Second call: LLM returns final answer after tool result
    mock_final_response = make_mock_llm_response("Temos camisetas a partir de R$49,90.")

    with patch("src.graph.nodes._fetch_guard_rules", AsyncMock(return_value=[])), \
         patch("src.graph.nodes._get_llm_with_tools") as mock_get_llm, \
         patch("src.graph.nodes._build_system_prompt", AsyncMock(return_value="prompt")), \
         patch("src.graph.nodes._classify_intent", AsyncMock(return_value="product_search")), \
         patch("src.graph.tools.catalog_search_tool.ainvoke",
               AsyncMock(return_value="Camiseta Básica - R$49,90")):

        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(side_effect=[mock_tool_call_response, mock_final_response])
        mock_get_llm.return_value = mock_llm

        graph = get_agent_graph()
        result = await graph.ainvoke(base_state)

    assert result["final_response"] is not None
    assert result["guard_rail_triggered"] is False
```

> **Nota:** Os nomes exatos das funções internas (`_fetch_guard_rules`, `_build_system_prompt`, `_classify_intent`, `_get_llm_with_tools`) precisam ser verificados no arquivo `apps/ai-orchestrator/src/graph/nodes.py`. Se os nomes forem diferentes, ajuste os patches correspondentes.

- [ ] **Step 3: Rodar os testes de integração**

```bash
cd apps/ai-orchestrator
pytest tests/test_integration_pipeline.py -v
```

Se algum teste falhar por nome de função incorreto, inspecione `src/graph/nodes.py` e ajuste os patches.

- [ ] **Step 4: Commit**

```bash
git add apps/ai-orchestrator/tests/test_integration_pipeline.py
git commit -m "test(orchestrator): add integration tests for full LangGraph conversation pipeline"
```

---

### Verificação do Plano 5c

- [ ] `pnpm --filter @whatsagent/api test` — todos passando
- [ ] `cd apps/ai-orchestrator && pytest -v` — todos os 8 arquivos + novos passando
- [ ] Abrir `/overview` no browser — confirmar que CSAT e Tokens aparecem nos cards
- [ ] Confirmar no Prisma Studio que `conversations.csat_score` tem dados de seed para validar o KPI visualmente
