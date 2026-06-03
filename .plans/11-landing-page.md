# Landing Page — WhatsAgent (/)

## Context
A rota raiz `/` exibe apenas "Platform coming soon." — um placeholder sem utilidade. O objetivo é substituir por uma landing page de marketing completa que apresente o produto, convença visitantes a se cadastrar e redirecione usuários já autenticados para o dashboard.

## Arquivo a modificar
- `apps/web/src/app/page.tsx` — único arquivo, reescrita completa

## Design System (já definido no projeto)
- Fundo: `#020617`
- Verde/CTA: `#22C55E`
- Indigo/AI: `#6366F1`
- Cards: glassmorphism (`bg-slate-900/80 backdrop-blur-2xl border border-slate-800`)
- Font: Plus Jakarta Sans (já carregada no layout)
- Ícones: Lucide React

## Estrutura da página (seções em ordem)

### 1. Navbar fixo
- Logo "WhatsAgent" (ícone MessageSquare verde + nome)
- Links: Features, Como funciona, Preços
- Botões: "Entrar" (`<SignInButton>`) + "Começar grátis" (`<SignUpButton>`) — ambos do `@clerk/nextjs`
- Se usuário já logado (`useAuth().isSignedIn`): substituir botões por "Ir para o dashboard" → `/overview`

### 2. Hero
- Badge: "IA + WhatsApp Business"
- Headline: "Atendimento automático que vende enquanto você dorme"
- Subtítulo: proposta de valor em 2 linhas
- CTA primário: "Começar 14 dias grátis" (`<SignUpButton>`)
- CTA secundário: "Ver demonstração" (scroll para #como-funciona)
- Visual: mockup de conversa WhatsApp simulando o bot respondendo

### 3. Features (3 cards em grid)
- 🤖 IA que entende contexto — LangGraph + GPT-4o
- 🛍️ Venda pelo WhatsApp — catálogo, carrinho, pagamento Pix
- 📊 Analytics em tempo real — conversas, receita, handoffs

### 4. Como funciona (#como-funciona)
- 3 passos numerados: Conecta o número → Configura o agente → Bot responde 24/7

### 5. Pricing (3 planos)
Reusar os dados que já existem em `setup/plan/page.tsx`:
- **Starter** R$197/mês — até 500 conversas, 50 produtos
- **Growth** R$497/mês — até 2.000 conversas, 500 produtos (destaque)
- **Scale** R$997/mês — conversas ilimitadas, produtos ilimitados
- CTA de cada card: `<SignUpButton>` com plano pré-selecionado

### 6. CTA final
- Headline: "Pronto para automatizar seu atendimento?"
- Botão grande: "Começar agora — 14 dias grátis"

### 7. Footer
- Logo + copyright + links: Termos, Privacidade

## Implementação técnica

```tsx
"use client";
import { useAuth, SignInButton, SignUpButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) router.replace("/overview");
  }, [isSignedIn, router]);

  // ... seções da landing page
}
```

- Componente único `"use client"` em `page.tsx`
- Sem dependências externas além do que já existe no projeto
- Scroll suave entre seções com `id` anchors
- Responsivo: mobile-first com Tailwind

## Verificação
1. Acessar `http://localhost:3000` sem estar logado → ver landing page completa
2. Clicar "Entrar" → abre modal Clerk de login
3. Clicar "Começar grátis" → abre modal Clerk de cadastro
4. Após login, voltar para `/` → redireciona para `/overview` automaticamente
5. Checar responsividade em mobile (375px)
