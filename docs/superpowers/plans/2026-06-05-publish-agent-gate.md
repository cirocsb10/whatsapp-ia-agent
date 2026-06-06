# Publish Agent Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o gate de publicação do agente — o canal só encaminha mensagens para IA quando `isPublished=true`, e o frontend expõe um botão real com modal de confirmação para publicar.

**Architecture:** O `WebhookService` do channel-service passa a verificar `agentConfig.isPublished` (com cache Redis de 60s) após salvar o contato/conversa/mensagem, antes de chamar `publishInbound`. No frontend, o botão "Publicar agente" vira um `<button>` que abre um `PublishAgentModal`; ao confirmar, chama `PATCH /agent/config { isPublished: true }` e atualiza o estado da página.

**Tech Stack:** NestJS (channel-service), Next.js 14 App Router, Prisma, Redis (SessionService), Jest, React hooks, Tailwind CSS + shadcn/ui design tokens do projeto.

---

### Task 1: Gate no channel-service

**Files:**
- Modify: `apps/channel-service/src/webhook/webhook.service.ts`
- Modify: `apps/channel-service/src/webhook/webhook.service.spec.ts`

- [ ] **Step 1: Escrever os testes que devem falhar**

Em `webhook.service.spec.ts`, adicionar os dois novos testes no bloco `describe("WebhookService")` existente, após os testes já existentes. Adicionar também `agentConfig` ao `mockPrisma`:

```typescript
// Adicionar na seção de mocks, junto com mockPrisma:
mockPrisma.agentConfig = {
  findFirst: jest.fn().mockResolvedValue({ isPublished: true }),
};
```

E no `beforeEach`, adicionar reset:
```typescript
mockPrisma.agentConfig.findFirst.mockResolvedValue({ isPublished: true });
```

E os dois novos testes:
```typescript
it("não publica no RabbitMQ quando agentConfig.isPublished=false", async () => {
  mockPrisma.agentConfig.findFirst.mockResolvedValue({ isPublished: false });
  await service.processWebhook(makeTextPayload("Olá"));
  expect(mockProducer.publishInbound).not.toHaveBeenCalled();
  // Mensagem ainda deve ser salva no banco
  expect(mockPrisma.message.create).toHaveBeenCalled();
});

it("usa cache Redis para isPublished e não bate no banco na segunda chamada", async () => {
  // Primeira chamada — DB hit
  await service.processWebhook(makeTextPayload("Msg 1"));
  expect(mockPrisma.agentConfig.findFirst).toHaveBeenCalledTimes(1);

  // Simular cache Redis retornando "true"
  mockSession.get.mockImplementation((key: string) => {
    if (key.startsWith("agent:published:")) return Promise.resolve("true");
    return Promise.resolve(null);
  });

  // Segunda chamada — deve usar cache, não bater no DB novamente
  await service.processWebhook(makeTextPayload("Msg 2"));
  expect(mockPrisma.agentConfig.findFirst).toHaveBeenCalledTimes(1); // ainda 1
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
pnpm --filter @whatsagent/channel-service test -- --testPathPattern=webhook.service
```

Esperado: FAIL — `agentConfig` undefined ou `findFirst` não chamado.

- [ ] **Step 3: Implementar o gate no WebhookService**

Em `webhook.service.ts`, adicionar o método privado `isAgentPublished` e a chamada no `processMessage`.

Adicionar após a linha 151 (`if (!conversation) return;`) e antes da construção do `event` (linha 153):

```typescript
// Verificar se o agente está publicado antes de rotear para IA
const published = await this.isAgentPublished(tenantId);
if (!published) {
  this.logger.log(`Agent not published for tenant ${tenantId} — message saved but not routed`);
  return;
}
```

Adicionar o método privado após `resolveTenantId`:

```typescript
private async isAgentPublished(tenantId: string): Promise<boolean> {
  const key = `agent:published:${tenantId}`;
  const cached = await this.session.get(key);
  if (cached !== null) return cached === "true";

  const config = await this.prisma.agentConfig.findFirst({
    where: { tenantId },
    select: { isPublished: true },
  });

  const published = config?.isPublished ?? false;
  await this.session.set(key, String(published), 60);
  return published;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
pnpm --filter @whatsagent/channel-service test -- --testPathPattern=webhook.service
```

Esperado: todos os testes PASS (incluindo os já existentes — não devem quebrar porque `mockPrisma.agentConfig.findFirst` retorna `{ isPublished: true }` por padrão no `beforeEach`).

- [ ] **Step 5: Commit**

```bash
git add apps/channel-service/src/webhook/webhook.service.ts apps/channel-service/src/webhook/webhook.service.spec.ts
git commit -m "feat(channel): gate isPublished antes de publicar no RabbitMQ"
```

---

### Task 2: Modal de publicação no frontend

**Files:**
- Create: `apps/web/src/components/agent/PublishAgentModal.tsx`
- Modify: `apps/web/src/app/(dashboard)/agent/page.tsx`

- [ ] **Step 1: Criar o componente PublishAgentModal**

Criar `apps/web/src/components/agent/PublishAgentModal.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Rocket, X, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  publishing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function PublishAgentModal({ open, publishing, onConfirm, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900/95 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-green-500/30 bg-green-500/10">
            <Rocket className="w-6 h-6 text-green-400" strokeWidth={1.8} />
          </div>

          <div>
            <h2 className="text-[17px] font-semibold text-[#e2e8f0]">Publicar agente?</h2>
            <p className="mt-1.5 text-[13px] text-[#64748b] leading-relaxed">
              A partir de agora o agente passará a responder mensagens reais no WhatsApp.
              Certifique-se de que persona, base de conhecimento e guard rails estão configurados.
            </p>
          </div>

          <div className="flex w-full items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 text-left">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" strokeWidth={1.8} />
            <p className="text-[12px] text-amber-300/80 leading-relaxed">
              Clientes que enviarem mensagens enquanto o agente está ativo receberão respostas automáticas imediatamente.
            </p>
          </div>

          <div className="flex w-full gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={publishing}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-[13px] font-medium text-[#94a3b8] transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={publishing}
              className="flex-1 rounded-xl bg-green-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {publishing ? "Publicando…" : "Publicar agente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Atualizar page.tsx — adicionar estado e handler de publicação**

Em `apps/web/src/app/(dashboard)/agent/page.tsx`, adicionar os seguintes imports no topo:

```tsx
import { PublishAgentModal } from "@/components/agent/PublishAgentModal";
```

Dentro de `AgentPage()`, adicionar dois novos estados após `const [loading, setLoading] = useState(true);`:

```tsx
const [showPublishModal, setShowPublishModal] = useState(false);
const [publishing, setPublishing] = useState(false);
```

Adicionar a função `handlePublish` após o `useEffect` de carregamento:

```tsx
async function handlePublish() {
  setPublishing(true);
  try {
    const res = await apiFetch("/agent/config", {
      method: "PATCH",
      body: JSON.stringify({ isPublished: true }),
    });
    if (res.ok) {
      const updated = await res.json();
      setConfig(updated);
    }
  } finally {
    setPublishing(false);
    setShowPublishModal(false);
  }
}
```

- [ ] **Step 3: Substituir o Link "Publicar agente" pelo botão com modal**

Localizar em `page.tsx` o bloco:
```tsx
{!published && (
  <Link href="/agent/persona" className="agent-publish-cta">
    <Rocket className="w-4 h-4" strokeWidth={1.8} />
    Publicar agente
    <ArrowRight className="w-3.5 h-3.5" />
  </Link>
)}
```

Substituir por:
```tsx
{!published && (
  <button
    type="button"
    onClick={() => setShowPublishModal(true)}
    className="agent-publish-cta"
  >
    <Rocket className="w-4 h-4" strokeWidth={1.8} />
    Publicar agente
    <ArrowRight className="w-3.5 h-3.5" />
  </button>
)}
```

- [ ] **Step 4: Adicionar o modal ao final do JSX retornado**

Localizar o fechamento `</div>` final da função `AgentPage` (depois do `</div>` que fecha `dashboard-page agent-page`) e adicionar o modal antes do último `</div>`:

```tsx
      </div>

      <PublishAgentModal
        open={showPublishModal}
        publishing={publishing}
        onConfirm={() => { void handlePublish(); }}
        onClose={() => setShowPublishModal(false)}
      />
    </div>
  );
```

- [ ] **Step 5: Remover o import de `Link` se não for mais usado em outro lugar da página**

Verificar se `Link` ainda é usado nos `CONFIG_SECTIONS` (é — no grid de cards). Manter o import. Verificar se `ArrowRight` ainda está sendo usado (sim, no botão e nos cards). Manter.

- [ ] **Step 6: Verificar tipagem**

```bash
pnpm --filter @whatsagent/web lint
```

Esperado: sem erros. Se reportar `Link` não usado, verificar — `Link` é usado nos cards de configuração.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/agent/PublishAgentModal.tsx apps/web/src/app/(dashboard)/agent/page.tsx
git commit -m "feat(web): botao publicar agente com modal de confirmacao"
```

---

### Task 3: Invalidar cache Redis ao publicar

**Files:**
- Modify: `apps/api/src/modules/agent/agent-config.service.ts`
- Modify: `apps/api/src/modules/agent/agent.module.ts`

**Contexto:** O channel-service cacheia `agent:published:{tenantId}` por 60 segundos no Redis. Quando o tenant publica via API, o cache precisa ser invalidado imediatamente — senão o agente pode demorar até 60s para começar a responder.

- [ ] **Step 1: Injetar Redis no AgentConfigService**

Em `apps/api/src/modules/agent/agent-config.service.ts`, adicionar o import e injeção do Redis:

```typescript
import { Injectable, Inject } from "@nestjs/common";
import { Redis } from "ioredis";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UpdateAgentConfigDto } from "./dto/update-agent-config.dto";

@Injectable()
export class AgentConfigService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("REDIS_CLIENT") private readonly redis: Redis,
  ) {}
```

- [ ] **Step 2: Adicionar a invalidação no updateConfig**

No método `updateConfig`, adicionar a invalidação ao final:

```typescript
async updateConfig(tenantId: string, dto: UpdateAgentConfigDto) {
  const data: Prisma.AgentConfigUncheckedUpdateInput = { ...dto };
  if (dto.isPublished) {
    data.publishedAt = new Date();
  } else if (dto.isPublished === false) {
    data.publishedAt = null;
  }

  const result = await this.prisma.agentConfig.upsert({
    where: { tenantId },
    create: { ...(data as Prisma.AgentConfigUncheckedCreateInput), tenantId },
    update: data,
  });

  // Invalidar cache do channel-service para que o gate reflita imediatamente
  if (dto.isPublished !== undefined) {
    await this.redis.del(`agent:published:${tenantId}`);
  }

  return result;
}
```

- [ ] **Step 3: Verificar se REDIS_CLIENT já está disponível no módulo da API**

```bash
grep -rn "REDIS_CLIENT\|provide.*Redis\|RedisModule" apps/api/src/ --include="*.ts" | head -20
```

Se `REDIS_CLIENT` já estiver registrado como provider global ou no `AppModule`, o `AgentModule` herda. Se não, precisará ser adicionado — verificar o resultado antes de continuar.

- [ ] **Step 4: Adicionar REDIS_CLIENT ao AgentModule se necessário**

Se o grep do Step 3 mostrar que `REDIS_CLIENT` existe no `AppModule` mas não no `AgentModule`, adicionar ao `imports` do `AgentModule`. Se já for global, nada a fazer.

Se precisar adicionar, verificar como o provider Redis é declarado no projeto (qual módulo/factory) e importar esse módulo no `AgentModule`.

- [ ] **Step 5: Rodar os testes da API**

```bash
pnpm --filter @whatsagent/api test
```

Esperado: PASS. Se `REDIS_CLIENT` não estiver mockado nos testes de `AgentConfigService`, adicionar ao mock do módulo de teste.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/agent/agent-config.service.ts apps/api/src/modules/agent/agent.module.ts
git commit -m "feat(api): invalida cache Redis ao publicar/despublicar agente"
```

---

## Self-Review

**Spec coverage:**
- ✅ Gate no channel-service (`isPublished` verificado antes de `publishInbound`)
- ✅ Cache Redis para o gate (TTL 60s, invalidação imediata ao publicar)
- ✅ Mensagem/conversa/contato ainda salvos mesmo quando não publicado
- ✅ Botão "Publicar agente" real (não mais Link para /agent/persona)
- ✅ Modal de confirmação com aviso de impacto
- ✅ Feedback de loading durante publicação
- ✅ Estado da página atualizado após publicação sem reload

**Placeholder scan:** nenhum TBD ou TODO — todos os blocos de código são completos.

**Type consistency:** `PublishAgentModal` Props → `open: boolean`, `publishing: boolean`, `onConfirm: () => void`, `onClose: () => void` — consistente nos dois lugares onde é usado.
