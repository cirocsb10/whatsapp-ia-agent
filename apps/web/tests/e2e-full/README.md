# E2E completo (local, não roda no CI)

Cobre o fluxo que o smoke suite (`tests/e2e/`, que roda no CI) não alcança por
não ter backend: login real, navegação com cache, uma mensagem chegando via
socket em tempo real (simulando o WhatsApp via webhook assinado) e handoff
para atendente humano.

Diferente do smoke suite, este **não sobe nenhum serviço sozinho** — ele
assume que você já tem a stack local rodando, e testa contra ela de verdade.

## Como rodar

1. Suba a infra (uma vez, se ainda não estiver rodando):
   ```bash
   pnpm docker:up          # Postgres + Redis + RabbitMQ
   pnpm db:migrate
   pnpm db:seed             # cria o dev-tenant + owner@dev-tenant.com + client@dev-tenant.com
   ```

2. Em um terminal, suba os serviços Node:
   ```bash
   pnpm dev                 # api (3002) + channel-service (3001) + web (3000)
   ```

3. Em outro terminal, suba o ai-orchestrator (opcional para este teste — a
   mensagem inbound chega em tempo real independente da IA responder, mas
   sem o orchestrator rodando o consumer da fila fica parado, o que é OK):
   ```bash
   cd apps/ai-orchestrator
   .venv/Scripts/uvicorn src.main:app --reload --port 8000
   ```

4. Confirme que `META_WEBHOOK_SECRET` está setado no `.env` ou `.env.local`
   da raiz do repo — é o valor que o helper de teste usa para assinar o
   webhook simulado, e precisa ser o **mesmo** que o channel-service já está
   usando (senão o `HmacGuard` rejeita com 403).

5. Rode o teste:
   ```bash
   cd apps/web
   pnpm test:e2e:full
   ```

## Login RBAC (`login-rbac.spec.ts`)

Requer dois usuários no banco local (criados pelo seed). As credenciais podem
ser sobrescritas por variáveis de ambiente:

```powershell
# PowerShell — defaults do seed (não precisa setar se rodou pnpm db:seed)
$env:E2E_CLIENT_EMAIL="client@dev-tenant.com"
$env:E2E_CLIENT_PASSWORD="devpassword123"
$env:E2E_ADMIN_EMAIL="owner@dev-tenant.com"
$env:E2E_ADMIN_PASSWORD="devpassword123"
pnpm --filter @whatsagent/web test:e2e:full -- login-rbac
```

Quando as variáveis não estão definidas, o spec usa por padrão `client@dev-tenant.com`
(non-super-admin) e `owner@dev-tenant.com` (super-admin). Contas pessoais locais
(ex.: `ciroviski@gmail.com`) continuam válidas se sobrescritas via env. Essa suíte
é exclusivamente local e não roda no CI.

## O que é simulado vs. real

- **Real**: login (BFF + cookies httpOnly), navegação com cache do TanStack
  Query, o webhook chegando no channel-service → RabbitMQ → api → Socket.io
  → UI, o botão de handoff (`PATCH /conversations/:id/assume`), o envio de
  mensagem do operador.
- **Simulado**: a mensagem "do cliente" não vem da Meta de verdade — o helper
  `helpers/webhook.ts` monta o mesmo payload que a Meta enviaria e assina com
  HMAC-SHA256 usando `META_WEBHOOK_SECRET`, e faz o POST direto em
  `POST /webhooks/meta`. Do ponto de vista do channel-service é indistinguível
  de um webhook real.
- **Não coberto**: a resposta da IA (exige `OPENAI_API_KEY` configurada e tem
  custo/latência não determinística) — o teste verifica que a mensagem chega
  e que o handoff manual funciona, não que a IA responde algo específico.

## Por que não roda no CI

Rodar isso no CI exigiria subir Postgres/Redis/RabbitMQ como serviços do
GitHub Actions, rodar migrations, seed, e iniciar os 3 serviços Node — do
zero a cada execução, com timeout e superfície de flakiness maiores. Local,
esses passos já fazem parte do fluxo de desenvolvimento normal (`pnpm
docker:up && pnpm dev`), então o teste só precisa assumir que já estão de pé.
Se um dia isso for para o CI, dá pra reaproveitar quase tudo daqui — só
trocar a suposição "stack já rodando" por um `docker-compose`/testcontainers
no workflow.
