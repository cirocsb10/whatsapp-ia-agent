# Plano: Assumir Conversa do Bot

## Context

Agentes humanos precisam poder assumir conversas que o bot está respondendo, tanto pelo
sistema (inbox web) quanto pausando o bot para responder via WhatsApp Business. Toda a
infraestrutura de banco (status `HUMAN_HANDOFF`, `HandoffEvent`, `assignedUserId`) já existe
no schema Prisma, mas faltam: bloqueio do AI quando em handoff, endpoints de assume/release/send,
e a UI de input na inbox.

## Estado atual relevante

- `Tenant.whatsappPhoneId` e `Tenant.metaAccessToken` armazenam as credenciais WhatsApp por tenant
- `InboundMessageEvent` usa `extra="forbid"` — campos extras rejeitados pela validação Pydantic
- `InboxEventsConsumer` (api) escuta `msg.inbound` e `ai.response` e emite WebSocket `emitToTenant()`
- `OutboundConsumer` (channel-service) escuta `ai.response` → envia via `MetaApiClient` → persiste com `isFromAi: true`
- `EventsGateway.emitToTenant()` disponível para injetar diretamente na API

## Mudanças por arquivo

### 1. channel-service — `webhook.service.ts` (linha ~128)

Adicionar `conversationStatus` ao evento publicado no RabbitMQ:

```typescript
const event: Record<string, unknown> = {
  tenantId,
  whatsappPhoneId: phoneNumberId,
  // ... campos existentes ...
  conversationId: conversation.id,
  conversationStatus: conversation.status,  // ← ADICIONAR
};
```

### 2. ai-orchestrator — `consumers/rabbitmq.py`

**a) `InboundMessageEvent`**: adicionar campo opcional (linha ~16):
```python
conversation_status: str | None = Field(default=None, alias="conversationStatus")
```
Também mudar `extra="forbid"` → `extra="ignore"` para não quebrar com outros campos futuros.

**b) `process_inbound_message`**: adicionar early return após validar o evento (após linha ~68):
```python
if event.conversation_status in ("HUMAN_HANDOFF", "PAUSED"):
    log.info("Skipping AI — conversation assigned to human", conv=event.conversation_id)
    return
```

### 3. api — `conversations/conversations.controller.ts`

Adicionar 3 rotas:
```typescript
@Patch(":id/assume")
assume(@CurrentTenantId() t: string, @CurrentUserId() u: string, @Param("id") id: string) {
  return this.service.assumeConversation(t, id, u);
}

@Patch(":id/release")
release(@CurrentTenantId() t: string, @CurrentUserId() u: string, @Param("id") id: string) {
  return this.service.releaseConversation(t, id, u);
}

@Post(":id/messages")
sendMessage(
  @CurrentTenantId() t: string,
  @CurrentUserId() u: string,
  @Param("id") id: string,
  @Body() body: { text: string },
) {
  return this.service.sendOperatorMessage(t, id, u, body.text);
}
```

> Verificar se `@CurrentUserId()` decorator já existe; se não, usar `@Req() req` e extrair de `req.auth`.

### 4. api — `conversations/conversations.service.ts`

**a) `findAll()`**: incluir `isAssumed: !!c.assignedUserId` no objeto retornado (para a UI saber distinguir "aguardando" de "assumido").

**b) `assumeConversation(tenantId, id, userId)`**:
```typescript
await prisma.$transaction([
  prisma.conversation.update({ where: { id, tenantId }, data: {
    status: "HUMAN_HANDOFF", handoffAt: new Date(),
    handoffReason: "MANUAL", assignedUserId: userId,
  }}),
  prisma.handoffEvent.create({ data: {
    tenantId, conversationId: id, reason: "MANUAL",
    triggeredBy: "AGENT", agentUserId: userId,
  }}),
]);
gateway.emitToTenant(tenantId, { type: "conversation_status_changed",
  payload: { conversationId: id, status: "HUMAN_HANDOFF", isHandoff: true, isAssumed: true }
});
```

**c) `releaseConversation(tenantId, id, userId)`**:
```typescript
await prisma.$transaction([
  prisma.conversation.update({ where: { id, tenantId }, data: {
    status: "ACTIVE", assignedUserId: null,
  }}),
  prisma.handoffEvent.updateMany({ where: { conversationId: id, resolvedAt: null },
    data: { resolvedAt: new Date() }
  }),
]);
gateway.emitToTenant(tenantId, { type: "conversation_status_changed",
  payload: { conversationId: id, status: "ACTIVE", isHandoff: false, isAssumed: false }
});
```

**d) `sendOperatorMessage(tenantId, id, userId, text)`**:
1. Buscar conversa + contact.phone + tenant.whatsappPhoneId + tenant.metaAccessToken
2. Validar `conversation.status === "HUMAN_HANDOFF"` (throw 400 se não)
3. Persistir: `prisma.message.create({ direction: "OUTBOUND", isFromAi: false, text, ... })`
4. Chamar Meta Graph API via `fetch`:
   ```
   POST https://graph.facebook.com/v21.0/{whatsappPhoneId}/messages
   Authorization: Bearer {metaAccessToken}
   { messaging_product: "whatsapp", to: contact.phone, type: "text", text: { body: text } }
   ```
5. Emitir WebSocket via `gateway.emitToTenant(tenantId, { type: "new_message", payload: { ... isFromAi: false } })`

> Injetar `EventsGateway` em `ConversationsService` — já está no mesmo módulo `GatewaysModule`.

### 5. frontend — `inbox/page.tsx`

**a) Store** (`inbox.store.ts`): adicionar `isAssumed: boolean` ao tipo de conversa e no `updateConversationStatus`.

**b) Header da conversa**: adicionar botão "Assumir conversa" visível quando `isHandoff && !isAssumed`:
```tsx
{activeConv.isHandoff && !activeConv.isAssumed && (
  <button onClick={handleAssume}>Assumir conversa</button>
)}
{activeConv.isAssumed && (
  <button onClick={handleRelease}>Devolver ao bot</button>
)}
```

**c) Área de input** (linhas 342–383): substituir o bloco de status pelo input real quando `isAssumed`:
```tsx
{activeConv?.isAssumed ? (
  <div className="inbox-input-bar">
    <textarea
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
      placeholder="Digite sua mensagem..."
    />
    <button onClick={handleSend}><SendHorizonal /></button>
  </div>
) : (
  /* bloco de status atual */
)}
```

**d) Handlers**:
```typescript
const handleAssume = async () => {
  await ky.patch(`/api/conversations/${activeConv.id}/assume`);
  // WebSocket event vai atualizar o store automaticamente
};
const handleRelease = async () => {
  await ky.patch(`/api/conversations/${activeConv.id}/release`);
};
const handleSend = async () => {
  if (!draft.trim()) return;
  await ky.post(`/api/conversations/${activeConv.id}/messages`, { json: { text: draft } });
  setDraft("");
};
```

**e) WebSocket** (`useSocket.ts`): escutar `conversation_status_changed` para atualizar `isHandoff` e `isAssumed` no store em tempo real.

## Ordem de execução

1. channel-service `webhook.service.ts` (adiciona campo ao evento)
2. ai-orchestrator `rabbitmq.py` (early return + campo no modelo)
3. API controller + service (3 novos endpoints)
4. Frontend store + inbox UI

## Verificação

1. Abrir inbox, iniciar conversa com WhatsApp — bot responde normalmente
2. Clicar "Assumir conversa" — botão muda para "Devolver ao bot", input aparece
3. Enviar mensagem pelo sistema — aparece na inbox com bubble diferente, chega no WhatsApp do cliente
4. Cliente responde — mensagem aparece na inbox mas bot NÃO responde automaticamente
5. Clicar "Devolver ao bot" — status volta a ACTIVE, bot retoma
6. Para testar via WhatsApp Business: antes do passo 2, apenas confirmar que o bot silencia quando status = HUMAN_HANDOFF (mesmo sem assumir pelo sistema)
