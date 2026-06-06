# Agent Persona — Pending Functionalities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the 8 `AgentConfig` database fields that exist in the Prisma schema but are absent from both the NestJS DTO and the Next.js persona page form, adding two new UI sections: "Atendimento & Handoff" and "Horário de Funcionamento".

**Architecture:** Two-layer change — (1) extend the backend `UpdateAgentConfigDto` with the missing optional fields, and (2) extend the frontend persona page with two new `<section>` cards that follow the exact same pattern as the existing Identidade / Mensagens / Modelo cards. No new files need to be created; the existing CSS classes (`persona-card`, `form-field`, `form-input`, `persona-range`) and `FormState` type are extended in-place.

**Tech Stack:** NestJS + class-validator (backend DTO), Next.js 14 App Router + React (frontend), Tailwind + custom CSS (`globals.css`), Prisma `AgentConfig` model.

---

## Context

The `AgentConfig` Prisma model (`packages/database/prisma/schema.prisma:193-219`) has 8 fields with no UI exposure:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `outOfHoursMessage` | String | "No momento estamos fechados..." | Message when agent is closed |
| `handoffMessage` | String | "Estou transferindo você..." | Message on human handoff |
| `autoHandoffThreshold` | Float | 0.3 | Confidence ≤ this → trigger handoff |
| `handoffOrderValueBrl` | Float? | null | Order value threshold to force handoff |
| `inactivityTimeoutMin` | Int | 30 | Minutes without reply → inactivity msg |
| `sessionTtlHours` | Int | 24 | Session expiry in hours |
| `maxConversationLength` | Int | 50 | Max turns before auto-close |
| `businessHours` | Json | {} | Weekly operating schedule |

The backend DTO (`apps/api/src/modules/agent/dto/update-agent-config.dto.ts`) also omits all 8. The frontend `FormState` type and form body (`apps/web/src/app/(dashboard)/agent/persona/page.tsx`) only send the already-covered fields.

---

## File Map

**Modify only:**
- `apps/api/src/modules/agent/dto/update-agent-config.dto.ts` — add 8 optional decorated fields
- `apps/web/src/app/(dashboard)/agent/persona/page.tsx` — extend `FormState`, `DEFAULT_FORM`, and add two new `<section>` cards

---

## Task 1: Extend UpdateAgentConfigDto

**File:** `apps/api/src/modules/agent/dto/update-agent-config.dto.ts`

- [ ] **Step 1: Replace the file content**

```typescript
// apps/api/src/modules/agent/dto/update-agent-config.dto.ts
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { AgentTone } from "@prisma/client";

export class UpdateAgentConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  agentName?: string;

  @IsOptional()
  @IsEnum(AgentTone)
  tone?: AgentTone;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  greetingMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  inactivityMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  closingMessage?: string;

  // ── Atendimento & Handoff ───────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(500)
  outOfHoursMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  handoffMessage?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  autoHandoffThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  handoffOrderValueBrl?: number | null;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  @Type(() => Number)
  inactivityTimeoutMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  @Type(() => Number)
  sessionTtlHours?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(500)
  @Type(() => Number)
  maxConversationLength?: number;

  // ── Horário de funcionamento ────────────────────────────
  @IsOptional()
  @IsObject()
  businessHours?: Record<string, { enabled: boolean; start: string; end: string }>;

  // ── LLM Config ─────────────────────────────────────────
  @IsOptional()
  @IsString()
  llmModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  @Type(() => Number)
  llmTemperature?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(4000)
  @Type(() => Number)
  maxResponseLength?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  systemPromptBase?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
```

- [ ] **Step 2: Restart the API and verify it still starts**

```bash
pnpm --filter @whatsagent/api dev
```

Expected: server starts on port 3002, no import or validation errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/agent/dto/update-agent-config.dto.ts
git commit -m "feat(api): expose missing AgentConfig fields in UpdateAgentConfigDto"
```

---

## Task 2: Extend FormState, DEFAULT_FORM, and load mapping in persona page

**File:** `apps/web/src/app/(dashboard)/agent/persona/page.tsx`

- [ ] **Step 1: Define the BusinessHoursDay type and DAYS constant above `FormState`**

Add before the `type FormState` declaration (around line 34):

```typescript
type BusinessHoursDay = { enabled: boolean; start: string; end: string };
type BusinessHoursMap = Record<string, BusinessHoursDay>;

const DAYS: { key: string; label: string }[] = [
  { key: "monday",    label: "Segunda" },
  { key: "tuesday",   label: "Terça" },
  { key: "wednesday", label: "Quarta" },
  { key: "thursday",  label: "Quinta" },
  { key: "friday",    label: "Sexta" },
  { key: "saturday",  label: "Sábado" },
  { key: "sunday",    label: "Domingo" },
];

const DEFAULT_BUSINESS_HOURS: BusinessHoursMap = Object.fromEntries(
  DAYS.map(({ key }) => [
    key,
    { enabled: key !== "saturday" && key !== "sunday", start: "09:00", end: "18:00" },
  ])
);
```

- [ ] **Step 2: Extend `FormState` type**

Replace the existing `type FormState` block:

```typescript
type FormState = {
  agentName: string;
  tone: string;
  greetingMessage: string;
  inactivityMessage: string;
  closingMessage: string;
  outOfHoursMessage: string;
  handoffMessage: string;
  autoHandoffThreshold: number;
  handoffOrderValueBrl: string;       // empty string = null
  inactivityTimeoutMin: number;
  sessionTtlHours: number;
  maxConversationLength: number;
  businessHours: BusinessHoursMap;
  llmModel: string;
  llmTemperature: number;
  maxResponseLength: number;
  systemPromptBase: string;
  isPublished: boolean;
};
```

- [ ] **Step 3: Extend `DEFAULT_FORM`**

Replace the existing `DEFAULT_FORM` constant:

```typescript
const DEFAULT_FORM: FormState = {
  agentName: "Assistente",
  tone: "FRIENDLY",
  greetingMessage: "Olá! Como posso ajudar?",
  inactivityMessage: "Ainda está por aqui?",
  closingMessage: "Até logo!",
  outOfHoursMessage: "No momento estamos fechados. Retornaremos em breve!",
  handoffMessage: "Estou transferindo você para um de nossos atendentes.",
  autoHandoffThreshold: 0.3,
  handoffOrderValueBrl: "",
  inactivityTimeoutMin: 30,
  sessionTtlHours: 24,
  maxConversationLength: 50,
  businessHours: DEFAULT_BUSINESS_HOURS,
  llmModel: "gpt-4o-mini",
  llmTemperature: 0.3,
  maxResponseLength: 500,
  systemPromptBase: "",
  isPublished: false,
};
```

- [ ] **Step 4: Fix the `handleSave` body to convert `handoffOrderValueBrl` to null/number**

Replace the body assignment inside `handleSave`:

```typescript
async function handleSave() {
  setSaving(true);
  try {
    const payload = {
      ...form,
      handoffOrderValueBrl: form.handoffOrderValueBrl === ""
        ? null
        : Number(form.handoffOrderValueBrl),
    };
    const res = await apiFetch("/agent/config", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error();
    setDirty(false);
    setToast({ type: "success", msg: "Persona salva com sucesso" });
  } catch {
    setToast({ type: "error", msg: "Erro ao salvar persona" });
  } finally {
    setSaving(false);
  }
}
```

- [ ] **Step 5: Normalise `businessHours` when loading from API**

The API may return `{}` (empty object) for a new tenant. Add a normalization helper right after `DEFAULT_BUSINESS_HOURS`:

```typescript
function normalizeBusinessHours(raw: unknown): BusinessHoursMap {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return DEFAULT_BUSINESS_HOURS;
  }
  return Object.fromEntries(
    DAYS.map(({ key }) => {
      const entry = (raw as Record<string, unknown>)[key];
      if (typeof entry === "object" && entry !== null) {
        const e = entry as Partial<BusinessHoursDay>;
        return [key, {
          enabled: e.enabled ?? (key !== "saturday" && key !== "sunday"),
          start: e.start ?? "09:00",
          end: e.end ?? "18:00",
        }];
      }
      return [key, { enabled: key !== "saturday" && key !== "sunday", start: "09:00", end: "18:00" }];
    })
  );
}
```

Then update the `load` function inside `useEffect` to normalise the value:

```typescript
const data = await res.json();
setForm((current) => ({
  ...current,
  ...data,
  handoffOrderValueBrl: data.handoffOrderValueBrl != null
    ? String(data.handoffOrderValueBrl)
    : "",
  businessHours: normalizeBusinessHours(data.businessHours),
}));
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(dashboard)/agent/persona/page.tsx
git commit -m "feat(web): extend persona FormState with atendimento and business hours fields"
```

---

## Task 3: Add "Atendimento & Handoff" card UI

**File:** `apps/web/src/app/(dashboard)/agent/persona/page.tsx`

Add a new `<section>` after the existing "Mensagens automáticas" card (around line 307) and before the "Modelo de IA" card. Add the required import `Clock` and `UserCheck` from `lucide-react`.

- [ ] **Step 1: Add lucide icons to imports**

In the import block at the top, add `Clock` and `UserCheck`:

```typescript
import {
  Bot,
  Clock,
  MessageCircle,
  Sparkles,
  Cpu,
  Thermometer,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Save,
  UserCheck,
  Zap,
} from "lucide-react";
```

- [ ] **Step 2: Add the Atendimento & Handoff section after the Mensagens card closing `</section>` tag**

```tsx
{/* Atendimento & Handoff */}
<section className="persona-card">
  <div className="persona-card-head">
    <div className="persona-card-icon persona-card-icon--indigo">
      <UserCheck className="w-4 h-4" strokeWidth={1.8} />
    </div>
    <div>
      <p className="persona-card-title">Atendimento & Handoff</p>
      <p className="persona-card-sub">Tempos de sessão e transferência humana</p>
    </div>
  </div>

  <div className="persona-card-body persona-card-body--stack">
    {/* Timing row */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
      <label className="form-field">
        <span className="form-label">
          Inatividade
          <span className="form-label-hint"> — min</span>
        </span>
        <input
          type="number"
          min={5}
          max={1440}
          step={5}
          value={form.inactivityTimeoutMin}
          onChange={(e) => patch("inactivityTimeoutMin", Number(e.target.value))}
          className="form-input"
          disabled={loading}
        />
      </label>
      <label className="form-field">
        <span className="form-label">
          Sessão
          <span className="form-label-hint"> — horas</span>
        </span>
        <input
          type="number"
          min={1}
          max={720}
          step={1}
          value={form.sessionTtlHours}
          onChange={(e) => patch("sessionTtlHours", Number(e.target.value))}
          className="form-input"
          disabled={loading}
        />
      </label>
      <label className="form-field">
        <span className="form-label">
          Max. turnos
        </span>
        <input
          type="number"
          min={5}
          max={500}
          step={5}
          value={form.maxConversationLength}
          onChange={(e) => patch("maxConversationLength", Number(e.target.value))}
          className="form-input"
          disabled={loading}
        />
      </label>
    </div>

    {/* Handoff threshold */}
    <div className="form-field">
      <div className="persona-slider-head">
        <span className="form-label">Limite de confiança para handoff</span>
        <span className="persona-slider-value">
          {form.autoHandoffThreshold.toFixed(2)}
          <span className="persona-slider-tag">
            {form.autoHandoffThreshold <= 0.2 ? "Raro" : form.autoHandoffThreshold <= 0.5 ? "Moderado" : "Frequente"}
          </span>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={form.autoHandoffThreshold}
        onChange={(e) => patch("autoHandoffThreshold", Number(e.target.value))}
        className="persona-range"
        style={{ "--range-pct": `${form.autoHandoffThreshold * 100}%` } as React.CSSProperties}
        disabled={loading}
        aria-label="Limite de confiança para handoff"
      />
      <div className="persona-range-labels">
        <span>Raro</span>
        <span>Moderado</span>
        <span>Frequente</span>
      </div>
    </div>

    {/* Order value threshold */}
    <label className="form-field">
      <span className="form-label">
        Valor mínimo para handoff (R$)
        <span className="form-label-hint"> — deixe vazio para desativar</span>
      </span>
      <input
        type="number"
        min={0}
        step={0.01}
        value={form.handoffOrderValueBrl}
        onChange={(e) => patch("handoffOrderValueBrl", e.target.value)}
        placeholder="Ex: 500,00"
        className="form-input"
        disabled={loading}
      />
    </label>

    {/* Handoff message */}
    <label className="form-field">
      <span className="form-label">
        Mensagem de handoff
        <span className="form-label-hint"> — exibida ao transferir para humano</span>
      </span>
      <textarea
        value={form.handoffMessage}
        onChange={(e) => patch("handoffMessage", e.target.value)}
        rows={2}
        className="form-input"
        disabled={loading}
      />
    </label>

    {/* Out of hours message */}
    <label className="form-field">
      <span className="form-label">
        Mensagem fora do horário
        <span className="form-label-hint"> — quando o agente está fechado</span>
      </span>
      <textarea
        value={form.outOfHoursMessage}
        onChange={(e) => patch("outOfHoursMessage", e.target.value)}
        rows={2}
        className="form-input"
        disabled={loading}
      />
    </label>
  </div>
</section>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(dashboard)/agent/persona/page.tsx
git commit -m "feat(web): add Atendimento & Handoff card to persona page"
```

---

## Task 4: Add "Horário de Funcionamento" card UI

**File:** `apps/web/src/app/(dashboard)/agent/persona/page.tsx`

Add the business hours section after the Atendimento card, before the "Modelo de IA" card.

- [ ] **Step 1: Add the business hours section**

```tsx
{/* Horário de Funcionamento */}
<section className="persona-card">
  <div className="persona-card-head">
    <div className="persona-card-icon persona-card-icon--cyan">
      <Clock className="w-4 h-4" strokeWidth={1.8} />
    </div>
    <div>
      <p className="persona-card-title">Horário de Funcionamento</p>
      <p className="persona-card-sub">Define quando o agente responde automaticamente</p>
    </div>
  </div>

  <div className="persona-card-body persona-card-body--stack">
    {DAYS.map(({ key, label }) => {
      const day = form.businessHours[key] ?? { enabled: false, start: "09:00", end: "18:00" };
      return (
        <div key={key} className="persona-hours-row">
          <label className="persona-hours-toggle">
            <input
              type="checkbox"
              checked={day.enabled}
              onChange={(e) =>
                patch("businessHours", {
                  ...form.businessHours,
                  [key]: { ...day, enabled: e.target.checked },
                })
              }
              disabled={loading}
            />
            <span className="persona-hours-day">{label}</span>
          </label>
          <div className="persona-hours-times" style={{ opacity: day.enabled ? 1 : 0.35, pointerEvents: day.enabled ? "auto" : "none" }}>
            <input
              type="time"
              value={day.start}
              onChange={(e) =>
                patch("businessHours", {
                  ...form.businessHours,
                  [key]: { ...day, start: e.target.value },
                })
              }
              className="form-input persona-time-input"
              disabled={loading || !day.enabled}
            />
            <span className="persona-hours-sep">até</span>
            <input
              type="time"
              value={day.end}
              onChange={(e) =>
                patch("businessHours", {
                  ...form.businessHours,
                  [key]: { ...day, end: e.target.value },
                })
              }
              className="form-input persona-time-input"
              disabled={loading || !day.enabled}
            />
          </div>
        </div>
      );
    })}
  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/(dashboard)/agent/persona/page.tsx
git commit -m "feat(web): add Horário de Funcionamento card to persona page"
```

---

## Task 5: Add CSS for new UI elements

**File:** `apps/web/src/app/globals.css`

The `persona-card`, `form-field`, `form-input`, and `persona-range` classes already exist and are reused. Only the business hours row layout and time input sizing need new rules.

- [ ] **Step 1: Append CSS at the end of globals.css** (after the existing `.persona-*` rules)

```css
/* ── Persona — Business Hours ─────────────────────────── */
.persona-hours-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.persona-hours-row:last-child { border-bottom: none; }
.persona-hours-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  min-width: 100px;
  flex-shrink: 0;
}
.persona-hours-toggle input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: #6366f1;
  cursor: pointer;
}
.persona-hours-day {
  font-size: 12px;
  font-weight: 500;
  color: #cbd5e1;
}
.persona-hours-times {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  transition: opacity 0.15s;
}
.persona-hours-sep {
  font-size: 11px;
  color: #475569;
  flex-shrink: 0;
}
.persona-time-input {
  width: 100px !important;
  flex-shrink: 0;
  font-size: 12px !important;
  padding: 5px 8px !important;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): add CSS for business hours row layout in persona page"
```

---

## Verification

- [ ] Start services: `pnpm docker:up && pnpm dev`
- [ ] Open http://localhost:3000/agent/persona
- [ ] Verify three new cards appear: "Atendimento & Handoff", "Horário de Funcionamento" (before "Modelo de IA")
- [ ] Change inactivity timeout, session hours, max turns → save → reload → values persist
- [ ] Move handoff threshold slider → tag label updates ("Raro" / "Moderado" / "Frequente")
- [ ] Enter a handoff order value (e.g. 500) → save → reload → value persists; clear field → save → reload → field empty (null stored)
- [ ] Edit handoff message and out-of-hours message → save → reload → values persist
- [ ] Toggle business hours checkboxes + change times → save → reload → schedule persists
- [ ] Disable a day checkbox → time inputs become greyed out / non-interactive
- [ ] Open a new tenant (empty businessHours = "{}") → form shows sensible weekday defaults (Mon–Fri enabled, weekends off)
- [ ] Run `pnpm --filter @whatsagent/web lint` — no TypeScript errors
