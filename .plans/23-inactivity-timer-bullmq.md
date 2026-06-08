# Plano: Inactivity Timer com BullMQ

## Contexto

Os campos `inactivityMessage`, `closingMessage` e `inactivityTimeoutMin` existem no banco e na UI da persona, mas nunca foram usados. O comportamento esperado é:

1. **Aviso de inatividade** — após `inactivityTimeoutMin` minutos sem mensagem, o agente manda `inactivityMessage` ("Ainda está por aqui?")
2. **Encerramento** — se o cliente não responder em mais 5 minutos, o agente manda `closingMessage` ("Foi um prazer atender você!") e fecha a conversa (status `CLOSED`)

Requer jobs atrasados (delayed jobs) via BullMQ, que já está configurado no API service. O channel-service tem acesso direto ao Meta API client. A solução mantém tudo no **channel-service** para ter acesso nativo ao `MessagingService` sem depender de hop de RabbitMQ extra.

---

## Arquitetura

```
WebhookService (msg inbound)  ──┐
                                 ├──→ InactivitySchedulerService.schedule()
OutboundConsumer (ai.response) ─┘        │
                                         ↓ BullMQ delayed job (delay = inactivityTimeoutMin × 60 000 ms)
                                  InactivityProcessor (WorkerHost)
                                         │
                                    fase 'warn'?
                                     ├── Envia inactivityMessage via MessagingService
                                     └── Agenda novo job (delay = 5 min, fase 'close')
                                         │
                                    fase 'close'?
                                     ├── Envia closingMessage via MessagingService
                                     ├── Prisma: conversation.status = CLOSED, closedAt = now()
                                     └── SessionService.delete() (Redis)
```

---

## Implementação

### 1. Adicionar BullMQ ao channel-service

**`apps/channel-service/package.json`**  
Adicionar dependências: `@nestjs/bullmq`, `bullmq`.

**`apps/channel-service/src/app.module.ts`**  
Registrar `BullModule.forRoot()` com a mesma conexão Redis (`REDIS_URL`) já usada no API service.

Reutilizar o padrão de `apps/api/src/app.module.ts`:
```typescript
BullModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    connection: { url: config.get('REDIS_URL') },
  }),
  inject: [ConfigService],
})
```

---

### 2. Constantes e tipos

**`apps/channel-service/src/queue/queue.constants.ts`** (novo)
```typescript
export const INACTIVITY_QUEUE = 'conversation-inactivity';
export const CLOSE_GRACE_MINUTES = 5;
```

**`apps/channel-service/src/queue/inactivity.types.ts`** (novo)
```typescript
export interface InactivityJobData {
  conversationId: string;
  tenantId: string;
  contactPhone: string;
  waPhoneId: string;
  phase: 'warn' | 'close';
  scheduledAt: number; // Unix ms — valida se houve nova mensagem entre schedular e disparar
}
```

---

### 3. InactivitySchedulerService

**`apps/channel-service/src/queue/inactivity-scheduler.service.ts`** (novo)

```typescript
@Injectable()
export class InactivitySchedulerService {
  constructor(
    @InjectQueue(INACTIVITY_QUEUE) private readonly queue: Queue,
  ) {}

  async schedule(data: Omit<InactivityJobData, 'phase' | 'scheduledAt'>, delayMs: number): Promise<void> {
    const jobId = `inactivity:${data.conversationId}`;
    await this.queue.remove(jobId); // cancela timer anterior
    await this.queue.add(
      'check-inactivity',
      { ...data, phase: 'warn', scheduledAt: Date.now() },
      { jobId, delay: delayMs, attempts: 2, backoff: { type: 'fixed', delay: 5000 } },
    );
  }

  async cancel(conversationId: string): Promise<void> {
    await this.queue.remove(`inactivity:${conversationId}`);
  }
}
```

---

### 4. InactivityProcessor

**`apps/channel-service/src/queue/inactivity.processor.ts`** (novo)

```typescript
@Processor(INACTIVITY_QUEUE)
export class InactivityProcessor extends WorkerHost {
  async process(job: Job<InactivityJobData>): Promise<void> {
    const { conversationId, tenantId, contactPhone, waPhoneId, phase } = job.data;

    // Verifica se conversa ainda está ATIVA e sem novas mensagens
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId, status: 'ACTIVE' },
      select: { lastMessageAt: true },
    });
    if (!conversation) return; // já foi fechada ou é handoff humano

    const lastMsgMs = conversation.lastMessageAt?.getTime() ?? 0;
    if (lastMsgMs > job.data.scheduledAt) return; // nova mensagem chegou; novo job já foi agendado

    const config = await this.prisma.agentConfig.findUnique({
      where: { tenantId },
      select: { inactivityMessage: true, closingMessage: true, inactivityTimeoutMin: true },
    });

    if (phase === 'warn') {
      await this.messagingService.sendMessage(waPhoneId, contactPhone, {
        type: 'text',
        text: config?.inactivityMessage ?? 'Ainda está por aqui?',
      });
      // Agenda fase de encerramento
      await this.scheduler.queue.add(
        'check-inactivity',
        { ...job.data, phase: 'close', scheduledAt: Date.now() },
        { jobId: `inactivity:${conversationId}`, delay: CLOSE_GRACE_MINUTES * 60_000, attempts: 2 },
      );
    } else {
      // Fase close
      await this.messagingService.sendMessage(waPhoneId, contactPhone, {
        type: 'text',
        text: config?.closingMessage ?? 'Foi um prazer atender você! Até logo.',
      });
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      await this.sessionService.delete(tenantId, contactPhone);
    }
  }
}
```

Injeta: `PrismaService`, `MessagingService`, `InactivitySchedulerService`, `SessionService`.

---

### 5. Módulo

**`apps/channel-service/src/queue/queue.module.ts`** (novo ou expandido)

```typescript
@Module({
  imports: [
    BullModule.registerQueue({ name: INACTIVITY_QUEUE }),
    MessagingModule, // para MessagingService
  ],
  providers: [InactivityProcessor, InactivitySchedulerService],
  exports: [InactivitySchedulerService],
})
export class QueueModule {}
```

---

### 6. Disparar o timer

**`apps/channel-service/src/webhook/webhook.service.ts`**  
Após processar mensagem inbound e salvar no DB, chamar:
```typescript
const delayMs = agentConfig.inactivityTimeoutMin * 60_000;
await this.inactivityScheduler.schedule(
  { conversationId, tenantId, contactPhone, waPhoneId },
  delayMs,
);
```

**`apps/channel-service/src/queue/outbound.consumer.ts`**  
Após enviar a resposta da IA com sucesso:
```typescript
await this.inactivityScheduler.schedule(
  { conversationId, tenantId, contactPhone: event.toPhone, waPhoneId: event.waPhoneId },
  delayMs, // buscado do agentConfig ou passado no evento
);
```

Para o `delayMs` no outbound consumer, incluir `inactivityTimeoutMin` no payload do `ai.response` publicado pelo orquestrador (adicionar campo no `rabbitmq.py` consumer do Python).

---

### 7. SessionService no channel-service

O `SessionService` (atualmente só no AI orchestrator) precisa ser acessível pelo channel-service para deletar a sessão Redis ao encerrar. Opções:

**Opção recomendada**: duplicar a lógica de `delete()` em uma classe simples no channel-service:
```typescript
@Injectable()
export class RedisSessionService {
  async delete(tenantId: string, contactPhone: string): Promise<void> {
    const key = `session:${tenantId}:${contactPhone}`;
    await this.redis.del(key);
  }
}
```

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `apps/channel-service/package.json` | add `@nestjs/bullmq`, `bullmq` |
| `apps/channel-service/src/app.module.ts` | registrar `BullModule.forRoot()` |
| `apps/channel-service/src/queue/queue.constants.ts` | novo |
| `apps/channel-service/src/queue/inactivity.types.ts` | novo |
| `apps/channel-service/src/queue/inactivity-scheduler.service.ts` | novo |
| `apps/channel-service/src/queue/inactivity.processor.ts` | novo |
| `apps/channel-service/src/queue/queue.module.ts` | novo |
| `apps/channel-service/src/webhook/webhook.service.ts` | chamar scheduler após processar inbound |
| `apps/channel-service/src/queue/outbound.consumer.ts` | chamar scheduler após enviar resposta IA |
| `apps/ai-orchestrator/src/consumers/rabbitmq.py` | incluir `inactivityTimeoutMin` no payload `ai.response` |

---

## Padrões reutilizados

- `WorkerHost` + `@Processor()` — padrão de `apps/api/src/queue/knowledge-embedding.processor.ts`
- `@InjectQueue()` + `queue.add()` — padrão de `apps/api/src/modules/agent/knowledge-indexing.service.ts`
- `BullModule.forRootAsync()` — padrão de `apps/api/src/app.module.ts`
- `MessagingService.sendMessage()` — `apps/channel-service/src/messaging/messaging.service.ts`
- `PrismaService` — já disponível no channel-service

---

## Verificação

1. **Unitário**: testar `InactivityProcessor` com Prisma e MessagingService mockados — verificar que `warn` envia `inactivityMessage` e reagenda; `close` envia `closingMessage`, atualiza DB e deleta sessão
2. **Integração manual**: 
   - Configurar `inactivityTimeoutMin = 1` na persona
   - Enviar mensagem ao WhatsApp → aguardar 1 min → verificar recebimento de `inactivityMessage`
   - Não responder por 5 min → verificar recebimento de `closingMessage`
   - Verificar status da conversa = `CLOSED` no DB
3. **Edge cases**: 
   - Enviar mensagem enquanto timer está rodando → timer deve ser cancelado e reagendado
   - Conversa em HUMAN_HANDOFF → processor deve ignorar (conversa não tem status ACTIVE)
