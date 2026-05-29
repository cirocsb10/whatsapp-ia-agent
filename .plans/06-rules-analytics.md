# WhatsAgent — Plan 5: Rules Engine & Analytics Avançado

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o motor de regras anti-alucinação configurável via UI (sem código), o dashboard de analytics avançado com funil de conversão, heatmap de horários e performance do agente, e o sistema de exportação CSV/PDF.

**Architecture:** Rule Builder frontend em React com form dinâmico por tipo de regra. Rules são persistidas na tabela `guard_rules` e consumidas pelo AI Orchestrator. Analytics dashboard usa queries PostgreSQL com materialized views para performance. BullMQ para jobs de re-embedding de produtos após atualização.

**Tech Stack:** React Hook Form · Zod · Recharts (advanced: FunnelChart, HeatMap, RadarChart) · PostgreSQL materialized views · BullMQ (embedding jobs) · jsPDF + AutoTable (exports PDF) · papaparse (CSV export) · date-fns

**Pré-requisito:** Plans 0–4 concluídos

---

## Estrutura de Arquivos

```
Criar/Modificar:
  apps/web/app/(dashboard)/agent/rules/page.tsx     # Rule Builder UI
  apps/web/components/agent/RuleBuilder.tsx          # Form builder dinâmico
  apps/web/app/(dashboard)/analytics/page.tsx        # Analytics avançado
  apps/web/components/analytics/FunnelChart.tsx      # Funil de conversão
  apps/web/components/analytics/HeatmapChart.tsx     # Heatmap de horários
  apps/web/components/analytics/RadarChart.tsx       # Performance radar
  apps/api/src/modules/analytics/reports.service.ts  # Export service
  apps/api/src/modules/analytics/reports.controller.ts
  apps/api/src/queue/embedding.processor.ts          # BullMQ: re-embed products
  apps/api/src/queue/embedding.module.ts
```

---

### Task 1: Rule Builder UI — Motor de Regras Anti-Alucinação

**Files:**
- Create: `apps/web/components/agent/RuleBuilder.tsx`
- Create: `apps/web/app/(dashboard)/agent/rules/page.tsx`

- [ ] **Step 1: Criar RuleBuilder.tsx (form builder dinâmico por tipo)**

```tsx
// apps/web/components/agent/RuleBuilder.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Shield, AlertTriangle, Eye, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const RULE_TYPES = [
  {
    value: "TEXT_BLOCK",
    label: "Bloquear Texto",
    description: "Impede que palavras ou frases específicas apareçam nas respostas",
    icon: "🚫",
  },
  {
    value: "HANDOFF_TRIGGER",
    label: "Gatilho de Handoff",
    description: "Transfere automaticamente para humano quando certas palavras são detectadas",
    icon: "👤",
  },
  {
    value: "NUMERIC_CAP",
    label: "Limitar Desconto",
    description: "Impede o agente de oferecer descontos acima do limite configurado",
    icon: "💰",
  },
  {
    value: "REGEX_MATCH",
    label: "Padrão Regex",
    description: "Detecta e trata padrões específicos com expressão regular",
    icon: "🔍",
  },
] as const;

const ACTIONS = [
  { value: "BLOCK", label: "Bloquear resposta", description: "Substitui por mensagem alternativa" },
  { value: "REWRITE", label: "Reescrever", description: "Pede ao agente para reformular" },
  { value: "HANDOFF", label: "Acionar handoff", description: "Transfere para humano imediatamente" },
  { value: "LOG_ONLY", label: "Só registrar", description: "Log sem bloquear (modo monitoramento)" },
] as const;

const ruleSchema = z.object({
  name: z.string().min(3, "Nome muito curto").max(100),
  type: z.enum(["TEXT_BLOCK", "HANDOFF_TRIGGER", "NUMERIC_CAP", "REGEX_MATCH"]),
  action: z.enum(["BLOCK", "REWRITE", "HANDOFF", "LOG_ONLY"]),
  priority: z.number().min(1).max(999).default(100),
  fallbackMessage: z.string().optional(),
  isActive: z.boolean().default(true),
  
  // Campos específicos por tipo
  patterns: z.array(z.string()).optional(),        // TEXT_BLOCK, HANDOFF_TRIGGER
  maxDiscount: z.number().min(0).max(100).optional(), // NUMERIC_CAP
  regexPattern: z.string().optional(),              // REGEX_MATCH
});

type RuleFormData = z.infer<typeof ruleSchema>;

interface Rule extends RuleFormData {
  id: string;
  createdAt: string;
}

interface RuleBuilderProps {
  tenantId: string;
  initialRules?: Rule[];
}

export function RuleBuilder({ tenantId, initialRules = [] }: RuleBuilderProps) {
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [creating, setCreating] = useState(false);
  const [patternInput, setPatternInput] = useState("");
  const [saving, setSaving] = useState(false);

  const form = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      type: "TEXT_BLOCK",
      action: "BLOCK",
      priority: 100,
      isActive: true,
      patterns: [],
    },
  });

  const ruleType = form.watch("type");
  const patterns = form.watch("patterns") ?? [];

  function addPattern() {
    if (!patternInput.trim()) return;
    form.setValue("patterns", [...patterns, patternInput.trim()]);
    setPatternInput("");
  }

  function removePattern(idx: number) {
    form.setValue("patterns", patterns.filter((_, i) => i !== idx));
  }

  async function onSubmit(data: RuleFormData) {
    setSaving(true);
    try {
      const config: Record<string, unknown> = {};
      
      if (data.type === "TEXT_BLOCK" || data.type === "HANDOFF_TRIGGER") {
        config.patterns = data.patterns ?? [];
      } else if (data.type === "NUMERIC_CAP") {
        config.field = "discount_percent";
        config.max = data.maxDiscount ?? 0;
      } else if (data.type === "REGEX_MATCH") {
        config.pattern = data.regexPattern ?? "";
      }

      const created = await api.post("agent-config/rules", {
        json: {
          name: data.name,
          type: data.type,
          action: data.action,
          priority: data.priority,
          isActive: data.isActive,
          config,
          fallbackMessage: data.fallbackMessage,
        },
      }).json<Rule>();

      setRules((prev) => [created, ...prev]);
      form.reset();
      setCreating(false);
    } catch (err) {
      console.error("Failed to save rule:", err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(ruleId: string, isActive: boolean) {
    await api.patch(`agent-config/rules/${ruleId}`, { json: { isActive } });
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, isActive } : r)),
    );
  }

  async function deleteRule(ruleId: string) {
    if (!confirm("Excluir esta regra?")) return;
    await api.delete(`agent-config/rules/${ruleId}`);
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            Regras Anti-Alucinação
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure limites para as respostas do agente IA
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="bg-green-500 hover:bg-green-400 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Regra
        </Button>
      </div>

      {/* Create Form */}
      {creating && (
        <div className="glass-card p-5 border border-indigo-500/20">
          <h3 className="text-sm font-semibold text-white mb-4">Criar Nova Regra</h3>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nome */}
            <div>
              <Label className="text-slate-400 text-xs mb-1.5 block">Nome da Regra</Label>
              <Input
                {...form.register("name")}
                placeholder="Ex: Não mencionar concorrentes"
                className="bg-[#0F172A] border-[#334155] text-white"
              />
              {form.formState.errors.name && (
                <p className="text-red-400 text-xs mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Tipo */}
              <div>
                <Label className="text-slate-400 text-xs mb-1.5 block">Tipo</Label>
                <Select
                  value={ruleType}
                  onValueChange={(v) => form.setValue("type", v as any)}
                >
                  <SelectTrigger className="bg-[#0F172A] border-[#334155] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0F172A] border-[#334155]">
                    {RULE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-slate-200">
                        {t.icon} {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-600 mt-1">
                  {RULE_TYPES.find((t) => t.value === ruleType)?.description}
                </p>
              </div>

              {/* Ação */}
              <div>
                <Label className="text-slate-400 text-xs mb-1.5 block">Ação</Label>
                <Select
                  onValueChange={(v) => form.setValue("action", v as any)}
                  defaultValue="BLOCK"
                >
                  <SelectTrigger className="bg-[#0F172A] border-[#334155] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0F172A] border-[#334155]">
                    {ACTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value} className="text-slate-200">
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campos específicos por tipo */}
            {(ruleType === "TEXT_BLOCK" || ruleType === "HANDOFF_TRIGGER") && (
              <div>
                <Label className="text-slate-400 text-xs mb-1.5 block">
                  Palavras/Frases para Detectar
                </Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={patternInput}
                    onChange={(e) => setPatternInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPattern())}
                    placeholder="Digite e pressione Enter..."
                    className="bg-[#0F172A] border-[#334155] text-white text-sm"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addPattern}
                    className="border-[#334155] text-slate-400 hover:text-white">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {patterns.map((p, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#1E293B] rounded-full text-xs text-slate-300"
                    >
                      {p}
                      <button type="button" onClick={() => removePattern(i)}
                        className="text-slate-500 hover:text-red-400 cursor-pointer">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {ruleType === "NUMERIC_CAP" && (
              <div>
                <Label className="text-slate-400 text-xs mb-1.5 block">
                  Desconto máximo permitido (%)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  {...form.register("maxDiscount", { valueAsNumber: true })}
                  placeholder="Ex: 10"
                  className="bg-[#0F172A] border-[#334155] text-white w-32"
                />
              </div>
            )}

            {ruleType === "REGEX_MATCH" && (
              <div>
                <Label className="text-slate-400 text-xs mb-1.5 block">Expressão Regular</Label>
                <Input
                  {...form.register("regexPattern")}
                  placeholder="Ex: (\\d{11}|\\d{14}) para CPF/CNPJ"
                  className="bg-[#0F172A] border-[#334155] text-white font-mono text-sm"
                />
              </div>
            )}

            {/* Mensagem alternativa */}
            <div>
              <Label className="text-slate-400 text-xs mb-1.5 block">
                Mensagem alternativa (opcional)
              </Label>
              <Textarea
                {...form.register("fallbackMessage")}
                placeholder="Mensagem a enviar quando a regra for acionada..."
                className="bg-[#0F172A] border-[#334155] text-white text-sm resize-none h-20"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isActive")}
                  onCheckedChange={(v) => form.setValue("isActive", v)}
                />
                <span className="text-sm text-slate-400">Regra ativa</span>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setCreating(false)}
                  className="border-[#334155] text-slate-400">
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}
                  className="bg-green-500 hover:bg-green-400 text-white">
                  {saving ? "Salvando..." : "Criar Regra"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-2">
        {rules.length === 0 && !creating && (
          <div className="glass-card p-8 text-center">
            <Shield className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-600">Nenhuma regra configurada</p>
            <p className="text-xs text-slate-700 mt-1">
              Crie regras para controlar o comportamento do agente
            </p>
          </div>
        )}

        {rules.map((rule) => {
          const typeConfig = RULE_TYPES.find((t) => t.value === rule.type);
          const actionConfig = ACTIONS.find((a) => a.value === rule.action);

          return (
            <div
              key={rule.id}
              className={cn(
                "glass-card p-4 flex items-center gap-4",
                !rule.isActive && "opacity-50",
              )}
            >
              <div className="text-2xl">{typeConfig?.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-white truncate">{rule.name}</span>
                  {!rule.isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-500 rounded">
                      Inativa
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {typeConfig?.label} → {actionConfig?.label}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={rule.isActive}
                  onCheckedChange={(v) => void toggleRule(rule.id, v)}
                />
                <button
                  onClick={() => void deleteRule(rule.id)}
                  className="p-1.5 text-slate-600 hover:text-red-400 transition-colors cursor-pointer rounded"
                  aria-label="Excluir regra"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/agent/RuleBuilder.tsx apps/web/app/\(dashboard\)/agent/rules/
git commit -m "feat(web): add visual rule builder for anti-hallucination guard rails"
```

---

### Task 2: Analytics Avançado — Funil + Heatmap + Radar

**Files:**
- Create: `apps/web/components/analytics/FunnelChart.tsx`
- Create: `apps/web/components/analytics/HeatmapChart.tsx`
- Create: `apps/web/app/(dashboard)/analytics/page.tsx`

- [ ] **Step 1: Criar FunnelChart.tsx**

```tsx
// apps/web/components/analytics/FunnelChart.tsx
"use client";

import { FunnelChart, Funnel, LabelList, ResponsiveContainer, Tooltip } from "recharts";

interface FunnelData {
  name: string;
  value: number;
  fill: string;
}

interface ConversionFunnelProps {
  data: {
    conversations: number;
    catalog_viewed: number;
    cart_started: number;
    payment_generated: number;
    payment_confirmed: number;
  };
}

export function ConversionFunnel({ data }: ConversionFunnelProps) {
  const funnelData: FunnelData[] = [
    { name: "Conversas Iniciadas", value: data.conversations, fill: "#6366F1" },
    { name: "Catálogo Consultado", value: data.catalog_viewed, fill: "#8B5CF6" },
    { name: "Carrinho Adicionado", value: data.cart_started, fill: "#EC4899" },
    { name: "Pagamento Gerado", value: data.payment_generated, fill: "#F59E0B" },
    { name: "Pagamento Confirmado", value: data.payment_confirmed, fill: "#22C55E" },
  ].filter((d) => d.value > 0);

  const maxValue = funnelData[0]?.value ?? 1;

  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Funil de Conversão</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Jornada do cliente do contato à compra confirmada
        </p>
      </div>

      <div className="space-y-2">
        {funnelData.map((stage, i) => {
          const pct = Math.round((stage.value / maxValue) * 100);
          const dropoffPct =
            i > 0
              ? Math.round(
                  ((funnelData[i - 1]!.value - stage.value) / funnelData[i - 1]!.value) * 100,
                )
              : 0;

          return (
            <div key={stage.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">{stage.name}</span>
                <div className="flex items-center gap-2">
                  {i > 0 && dropoffPct > 0 && (
                    <span className="text-[10px] text-red-400">-{dropoffPct}%</span>
                  )}
                  <span className="text-xs font-semibold text-white">
                    {stage.value.toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
              <div className="h-7 bg-[#0F172A] rounded-lg overflow-hidden relative">
                <div
                  className="h-full rounded-lg transition-all duration-700 flex items-center px-3"
                  style={{ width: `${pct}%`, backgroundColor: stage.fill + "33", borderLeft: `2px solid ${stage.fill}` }}
                >
                  <span className="text-[10px] font-bold" style={{ color: stage.fill }}>
                    {pct}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar HeatmapChart.tsx**

```tsx
// apps/web/components/analytics/HeatmapChart.tsx
"use client";

interface HeatmapData {
  hour: number;
  day: number;    // 0=Dom, 1=Seg, ..., 6=Sab
  value: number;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}h`);

function getIntensity(value: number, max: number): string {
  if (max === 0 || value === 0) return "bg-[#0F172A]";
  const pct = value / max;
  if (pct < 0.2) return "bg-green-900/30";
  if (pct < 0.4) return "bg-green-800/50";
  if (pct < 0.6) return "bg-green-600/60";
  if (pct < 0.8) return "bg-green-500/70";
  return "bg-green-400/90";
}

export function ActivityHeatmap({ data }: { data: HeatmapData[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  const grid: Record<string, number> = {};
  data.forEach(({ hour, day, value }) => {
    grid[`${day}-${hour}`] = value;
  });

  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Heatmap de Atividade</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Volume de mensagens por hora e dia da semana
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels */}
          <div className="flex mb-1 ml-10">
            {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
              <div key={h} className="flex-1 text-[9px] text-slate-600 text-center">
                {h}h
              </div>
            ))}
          </div>

          {DAYS.map((day, dayIdx) => (
            <div key={day} className="flex items-center gap-1 mb-1">
              <span className="text-[10px] text-slate-600 w-9 text-right">{day}</span>
              <div className="flex flex-1 gap-0.5">
                {HOURS.map((_, hourIdx) => {
                  const value = grid[`${dayIdx}-${hourIdx}`] ?? 0;
                  return (
                    <div
                      key={hourIdx}
                      className={`flex-1 h-5 rounded-sm ${getIntensity(value, max)} transition-opacity hover:opacity-80 cursor-default`}
                      title={`${day} ${hourIdx}h: ${value} msgs`}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-2 justify-end">
            <span className="text-[10px] text-slate-600">Menos</span>
            {["bg-[#0F172A]", "bg-green-900/30", "bg-green-600/60", "bg-green-500/70", "bg-green-400/90"].map((cls, i) => (
              <div key={i} className={`w-3.5 h-3.5 rounded-sm ${cls} border border-white/5`} />
            ))}
            <span className="text-[10px] text-slate-600">Mais</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar analytics/page.tsx completo**

```tsx
// apps/web/app/(dashboard)/analytics/page.tsx
import { Header } from "@/components/layout/Header";
import { KpiCard } from "@/components/analytics/KpiCard";
import { ConversationsChart } from "@/components/analytics/ConversationsChart";
import { ConversionFunnel } from "@/components/analytics/FunnelChart";
import { ActivityHeatmap } from "@/components/analytics/HeatmapChart";
import {
  Target, Users, ShoppingCart, DollarSign, Clock, Zap,
} from "lucide-react";

async function getAnalyticsData() {
  // Em produção: Server Component faz fetch na API
  return {
    funnel: {
      conversations: 1248,
      catalog_viewed: 892,
      cart_started: 445,
      payment_generated: 203,
      payment_confirmed: 156,
    },
    heatmap: Array.from({ length: 7 * 24 }, (_, i) => ({
      day: Math.floor(i / 24),
      hour: i % 24,
      value: Math.random() > 0.3 ? Math.floor(Math.random() * 40) : 0,
    })),
    handoffReasons: {
      KEYWORD_TRIGGER: 45,
      LOW_CONFIDENCE: 28,
      CUSTOMER_REQUEST: 19,
      ORDER_VALUE_THRESHOLD: 8,
    },
    topProducts: [
      { name: "Camiseta Preta Premium", orders: 89, revenue: 532110 },
      { name: "Polo Azul Clássica", orders: 67, revenue: 601830 },
      { name: "Camiseta Estampada Branca", orders: 54, revenue: 269460 },
    ],
  };
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();
  
  const conversionRate = Math.round(
    (data.funnel.payment_confirmed / data.funnel.conversations) * 100,
  );

  return (
    <div className="animate-fade-in">
      <Header title="Analytics" subtitle="Últimos 30 dias" />

      <div className="p-6 space-y-6">
        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { title: "Conversas", value: data.funnel.conversations.toLocaleString("pt-BR"), icon: Users, color: "text-indigo-400" },
            { title: "Viram Catálogo", value: `${Math.round(data.funnel.catalog_viewed / data.funnel.conversations * 100)}%`, icon: Target, color: "text-violet-400" },
            { title: "Adicionaram", value: `${Math.round(data.funnel.cart_started / data.funnel.conversations * 100)}%`, icon: ShoppingCart, color: "text-pink-400" },
            { title: "Converteram", value: `${conversionRate}%`, icon: Zap, color: "text-green-400" },
            { title: "Pedidos", value: data.funnel.payment_confirmed, icon: DollarSign, color: "text-yellow-400" },
            { title: "Tempo Médio", value: "3m 42s", icon: Clock, color: "text-cyan-400" },
          ].map((kpi) => (
            <KpiCard key={kpi.title} {...kpi} />
          ))}
        </div>

        {/* Funnel + Handoff Reasons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ConversionFunnel data={data.funnel} />

          {/* Handoff Reasons */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Motivos de Handoff</h3>
            <div className="space-y-3">
              {Object.entries(data.handoffReasons)
                .sort(([, a], [, b]) => b - a)
                .map(([reason, count]) => {
                  const total = Object.values(data.handoffReasons).reduce((a, b) => a + b, 0);
                  const pct = Math.round((count / total) * 100);
                  const labels: Record<string, string> = {
                    KEYWORD_TRIGGER: "Palavra-chave detectada",
                    LOW_CONFIDENCE: "Baixa confiança do agente",
                    CUSTOMER_REQUEST: "Cliente solicitou",
                    ORDER_VALUE_THRESHOLD: "Valor do pedido alto",
                  };
                  return (
                    <div key={reason}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-400">{labels[reason] ?? reason}</span>
                        <span className="text-xs text-white font-medium">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Heatmap */}
        <ActivityHeatmap data={data.heatmap} />

        {/* Top Products */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Top Produtos por Vendas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  {["#", "Produto", "Pedidos", "Receita", "Ticket Médio"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((p, i) => (
                  <tr key={p.name} className="border-b border-[#1E293B]/50">
                    <td className="px-3 py-2.5 text-slate-600 font-mono text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5 text-white font-medium">{p.name}</td>
                    <td className="px-3 py-2.5 text-slate-300">{p.orders}</td>
                    <td className="px-3 py-2.5 text-green-400 font-medium">
                      R$ {(p.revenue / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">
                      R$ {(p.revenue / p.orders / 100).toFixed(2).replace(".", ",")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/analytics/ apps/web/components/analytics/
git commit -m "feat(web): add advanced analytics with funnel chart, heatmap, and performance metrics"
```

---

### Task 3: BullMQ Product Embedding Processor

**Files:**
- Create: `apps/api/src/queue/embedding.processor.ts`
- Create: `apps/api/src/queue/embedding.module.ts`
- Test: `apps/api/src/queue/embedding.processor.spec.ts`

- [ ] **Step 1: Escrever testes**

```typescript
// apps/api/src/queue/embedding.processor.spec.ts
import { Test } from "@nestjs/testing";
import { EmbeddingProcessor } from "./embedding.processor";
import { PrismaService } from "../common/prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

const mockPrisma = {
  product: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockOpenAI = {
  embeddings: {
    create: jest.fn().mockResolvedValue({
      data: [{ embedding: Array(1536).fill(0.1) }],
    }),
  },
};

jest.mock("openai", () => ({
  OpenAI: jest.fn().mockImplementation(() => mockOpenAI),
}));

describe("EmbeddingProcessor", () => {
  let processor: EmbeddingProcessor;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmbeddingProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: () => "sk-test" } },
      ],
    }).compile();

    processor = module.get<EmbeddingProcessor>(EmbeddingProcessor);
    jest.clearAllMocks();
  });

  it("deve gerar embedding e atualizar produto", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: "prod-uuid",
      name: "Camiseta Preta Premium",
      description: "100% algodão, corte slim",
      tags: ["camiseta", "preta"],
    });

    await processor.process({
      name: "generate-embedding",
      data: { productId: "prod-uuid", tenantId: "tenant-123" },
    } as any);

    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prod-uuid" },
        data: expect.objectContaining({
          isEmbedded: true,
          embeddingText: expect.stringContaining("Camiseta Preta Premium"),
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Implementar EmbeddingProcessor**

```typescript
// apps/api/src/queue/embedding.processor.ts
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

export const EMBEDDING_QUEUE = "product-embeddings";

interface EmbeddingJobData {
  productId: string;
  tenantId: string;
}

@Processor(EMBEDDING_QUEUE)
@Injectable()
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
    this.openai = new OpenAI({
      apiKey: config.get<string>("openai.apiKey"),
    });
  }

  async process(job: Job<EmbeddingJobData>): Promise<void> {
    const { productId, tenantId } = job.data;
    this.logger.log(`Generating embedding for product ${productId}`);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || !product.isEmbedded === false) {
      return; // Produto já embeddado ou não encontrado
    }

    // Construir texto representativo do produto para embedding
    const embeddingText = [
      product.name,
      product.description ?? "",
      product.tags.join(", "),
    ]
      .filter(Boolean)
      .join(". ");

    // Gerar embedding via OpenAI
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: embeddingText,
      dimensions: 1536,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) throw new Error("No embedding returned");

    // Salvar embedding diretamente via SQL (pgvector não tem suporte no Prisma type-safe)
    await this.prisma.$executeRaw`
      UPDATE products
      SET embedding = ${JSON.stringify(embedding)}::vector,
          embedding_text = ${embeddingText},
          is_embedded = true,
          updated_at = NOW()
      WHERE id = ${productId} AND tenant_id = ${tenantId}
    `;

    this.logger.log(`Embedding saved for product ${product.name}`);
  }
}
```

- [ ] **Step 3: Criar embedding.module.ts**

```typescript
// apps/api/src/queue/embedding.module.ts
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EmbeddingProcessor, EMBEDDING_QUEUE } from "./embedding.processor";

@Module({
  imports: [
    BullModule.registerQueue({ name: EMBEDDING_QUEUE }),
  ],
  providers: [EmbeddingProcessor],
  exports: [BullModule],
})
export class EmbeddingModule {}
```

- [ ] **Step 4: Dispatch de jobs no ProductsService após criação/update**

```typescript
// Adicionar ao ProductsService — apps/api/src/modules/products/products.service.ts
// No método create() e update(), após salvar:

async create(tenantId: string, dto: CreateProductDto): Promise<Product> {
  const product = await this.prisma.product.create({ data: { tenantId, ...dto } });
  
  // Enfileirar job de embedding assíncrono
  await this.embeddingQueue.add(
    "generate-embedding",
    { productId: product.id, tenantId },
    { delay: 1000, attempts: 3, backoff: { type: "exponential", delay: 2000 } },
  );
  
  return product;
}
```

- [ ] **Step 5: Rodar testes**

```bash
pnpm test embedding.processor
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/queue/
git commit -m "feat(api): add bullmq embedding processor for async product vector generation"
```

---

## Verificação do Plan 5

- [ ] Rule Builder salva regra no banco e exibe na lista
- [ ] Desativar regra via toggle → isActive=false no banco
- [ ] Criar regra TEXT_BLOCK com padrão "concorrente" → AI Orchestrator bloqueia resposta
- [ ] Analytics page carrega com funil, heatmap e top products
- [ ] Funil mostra percentuais corretos de conversão
- [ ] Heatmap colorido por intensidade de mensagens
- [ ] Criar produto via API → job de embedding enfileirado no BullMQ
- [ ] Bull Board (http://localhost:3100) mostra job processado
- [ ] Busca semântica no catálogo retorna produto após embedding
