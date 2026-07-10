# features/

Unidade de organização feature-first do rewrite (plano `.plans/27`).

Cada domínio ganha uma pasta com a estrutura:

```
features/<dominio>/
  api/        # hooks de TanStack Query + chamadas ao fetcher único (shared/api)
  components/ # UI da feature (ilhas client memoizadas)
  hooks/      # lógica de UI local
  store/      # Zustand APENAS para client-state efêmero (aba ativa, rascunho…)
  types/      # tipos do domínio
```

Regras:

- `app/*` fica fino: server component (RSC) faz o prefetch e monta a feature.
- Server-state mora em TanStack Query (`shared/api`); Zustand só para client-state.
- Componentes de lista sempre `React.memo` com props estáveis; handlers via `useCallback`.

Migração incremental (Strangler Fig): uma feature por vez, sem big-bang.
