# WhatsAgent — Plan 4: Frontend Dashboard (Next.js 14)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o dashboard completo do WhatsAgent em Next.js 14 App Router — incluindo todas as 10 telas principais com design profissional Dark OLED, integração em tempo real via Socket.io, e autenticação Clerk. Produto visual de nível comercial.

**Architecture:** Next.js 14 App Router com grupos de rotas: `(public)` para landing page, `(dashboard)` para back-office do tenant, `(admin)` para super admin. Zustand para estado global. Socket.io para updates em tempo real. shadcn/ui + Tailwind CSS com design system customizado. Recharts para gráficos.

**Tech Stack:** Next.js 14 · TypeScript 5 · Tailwind CSS 3 · shadcn/ui · Radix UI · Zustand · Socket.io-client · Recharts · Lucide Icons · Framer Motion · Clerk · ky (HTTP client) · React Hook Form · Zod · Plus Jakarta Sans

**Design System:**
- Background: `#020617` · Surface-1: `#0F172A` · Surface-2: `#1E293B`
- CTA/Verde: `#22C55E` · Accent/Indigo: `#6366F1`
- Text: `#F8FAFC` · Muted: `#64748B`
- Font: Plus Jakarta Sans 300/400/500/600/700/800

**Pré-requisito:** Plans 1, 2, 3 concluídos (Back-office API rodando na porta 3002)

---

## Estrutura de Arquivos

```
apps/web/
├── app/
│   ├── layout.tsx                    # Root layout (fonts, providers)
│   ├── globals.css                   # Design tokens CSS vars
│   ├── (public)/
│   │   ├── layout.tsx                # Layout público (sem auth)
│   │   ├── page.tsx                  # Landing page
│   │   └── pricing/page.tsx          # Página de preços
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx   # Clerk SignIn
│   │   └── sign-up/[[...sign-up]]/page.tsx   # Clerk SignUp
│   └── (dashboard)/
│       ├── layout.tsx                # Sidebar + Header layout
│       ├── page.tsx                  # /dashboard → redirect
│       ├── overview/page.tsx         # Analytics overview
│       ├── inbox/
│       │   ├── page.tsx              # Unified inbox
│       │   └── [id]/page.tsx         # Conversa individual
│       ├── agent/
│       │   ├── page.tsx              # Agent config home
│       │   ├── persona/page.tsx      # Persona setup
│       │   ├── knowledge/page.tsx    # Knowledge base
│       │   ├── rules/page.tsx        # Guard rules
│       │   └── test/page.tsx         # Test simulator
│       ├── catalog/
│       │   ├── page.tsx              # Product list
│       │   └── [id]/page.tsx         # Product detail/edit
│       ├── orders/
│       │   ├── page.tsx              # Orders list
│       │   └── [id]/page.tsx         # Order detail
│       ├── analytics/page.tsx        # Analytics deep
│       ├── support/page.tsx          # Human handoff panel
│       └── settings/page.tsx         # Tenant settings
├── components/
│   ├── ui/                           # shadcn/ui base components
│   ├── layout/
│   │   ├── Sidebar.tsx               # Sidebar de navegação
│   │   ├── Header.tsx                # Top bar
│   │   └── MobileNav.tsx
│   ├── chat/
│   │   ├── ConversationList.tsx      # Lista de conversas
│   │   ├── ChatView.tsx              # Chat principal
│   │   ├── MessageBubble.tsx         # Bolha de mensagem
│   │   ├── AudioPlayer.tsx           # Player de áudio inline
│   │   └── TypingIndicator.tsx
│   ├── analytics/
│   │   ├── KpiCard.tsx               # Card de KPI
│   │   ├── ConversationsChart.tsx    # LineChart
│   │   ├── ResolutionChart.tsx       # BarChart
│   │   └── FunnelChart.tsx
│   ├── agent/
│   │   ├── PersonaEditor.tsx
│   │   ├── KnowledgeBaseEditor.tsx
│   │   ├── RuleBuilder.tsx
│   │   └── TestSimulator.tsx
│   └── shared/
│       ├── StatusBadge.tsx           # Badge de status colorido
│       ├── TenantGuard.tsx           # Proteção de rota por tenant
│       └── LoadingScreen.tsx
├── lib/
│   ├── api.ts                        # API client (ky)
│   ├── socket.ts                     # Socket.io client singleton
│   └── store/
│       ├── inbox.store.ts            # Zustand: conversas ao vivo
│       ├── notifications.store.ts    # Zustand: notificações
│       └── tenant.store.ts           # Zustand: dados do tenant
└── hooks/
    ├── useSocket.ts                  # Hook para Socket.io
    ├── useInbox.ts                   # Hook para inbox realtime
    └── useConversation.ts            # Hook para conversa individual
```

---

### Task 1: Setup Design System e Globals

**Files:**
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/tailwind.config.ts`

- [ ] **Step 1: Criar globals.css com design tokens**

```css
/* apps/web/app/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=JetBrains+Mono:wght@400;500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* ─── Color Tokens ─────────────────────────────────────────── */
    --bg-base:           #020617;
    --bg-surface-1:      #0F172A;
    --bg-surface-2:      #1E293B;
    --bg-surface-3:      #334155;
    --bg-surface-hover:  #1a2840;

    --color-primary:     #22C55E;
    --color-primary-dim: #16A34A;
    --color-primary-glow:rgba(34, 197, 94, 0.15);

    --color-accent:      #6366F1;
    --color-accent-dim:  #4F46E5;
    --color-accent-glow: rgba(99, 102, 241, 0.15);

    --color-warning:     #F59E0B;
    --color-danger:      #EF4444;
    --color-success:     #22C55E;

    --text-primary:      #F8FAFC;
    --text-secondary:    #CBD5E1;
    --text-muted:        #64748B;
    --text-disabled:     #334155;

    --border-default:    #1E293B;
    --border-subtle:     rgba(255, 255, 255, 0.06);
    --border-focus:      #6366F1;

    /* ─── Glassmorphism ─────────────────────────────────────────── */
    --glass-bg:          rgba(15, 23, 42, 0.8);
    --glass-border:      rgba(255, 255, 255, 0.06);
    --glass-shadow:      0 4px 24px rgba(0, 0, 0, 0.4),
                         inset 0 1px 0 rgba(255, 255, 255, 0.05);

    /* ─── Z-Index Scale ─────────────────────────────────────────── */
    --z-base:      10;
    --z-dropdown:  20;
    --z-sticky:    30;
    --z-overlay:   40;
    --z-modal:     50;
    --z-toast:     60;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  html {
    color-scheme: dark;
  }

  body {
    background-color: var(--bg-base);
    color: var(--text-primary);
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-feature-settings: "cv11", "ss01";
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Scrollbar customizada */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: var(--bg-surface-1);
  }
  ::-webkit-scrollbar-thumb {
    background: var(--bg-surface-3);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #475569;
  }

  /* Focus ring global */
  :focus-visible {
    outline: 2px solid var(--border-focus);
    outline-offset: 2px;
    border-radius: 4px;
  }
}

@layer components {
  /* ─── Glass Card ─────────────────────────────────────────────── */
  .glass-card {
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    box-shadow: var(--glass-shadow);
  }

  /* ─── Glow Effects ───────────────────────────────────────────── */
  .glow-green {
    box-shadow: 0 0 20px var(--color-primary-glow),
                0 0 40px rgba(34, 197, 94, 0.05);
  }

  .glow-indigo {
    box-shadow: 0 0 20px var(--color-accent-glow),
                0 0 40px rgba(99, 102, 241, 0.05);
  }

  /* ─── Live Indicator (pulso verde) ──────────────────────────── */
  .live-indicator {
    @apply relative inline-flex h-2 w-2;
  }
  .live-indicator::before {
    @apply absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75;
    content: '';
    animation: live-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
  }
  .live-indicator::after {
    @apply relative inline-flex rounded-full h-2 w-2 bg-green-500;
    content: '';
  }

  @keyframes live-ping {
    75%, 100% { transform: scale(2.5); opacity: 0; }
  }

  /* ─── Message Bubble ─────────────────────────────────────────── */
  .bubble-inbound {
    @apply bg-[#1E293B] text-slate-100 rounded-2xl rounded-bl-sm;
  }
  .bubble-outbound {
    @apply text-white rounded-2xl rounded-br-sm;
    background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%);
  }
  .bubble-ai {
    @apply text-white rounded-2xl rounded-br-sm;
    background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
  }

  /* ─── Sidebar Nav Item ────────────────────────────────────────── */
  .nav-item {
    @apply flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 
           hover:text-slate-100 hover:bg-slate-800/60 transition-all duration-150
           cursor-pointer text-sm font-medium;
  }
  .nav-item.active {
    @apply text-white bg-slate-800;
    box-shadow: inset 3px 0 0 var(--color-primary);
  }
}
```

- [ ] **Step 2: Configurar tailwind.config.ts**

```typescript
// apps/web/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        border: "var(--border-default)",
        background: "var(--bg-base)",
        foreground: "var(--text-primary)",
        primary: {
          DEFAULT: "#22C55E",
          foreground: "#ffffff",
          dim: "#16A34A",
        },
        accent: {
          DEFAULT: "#6366F1",
          foreground: "#ffffff",
          dim: "#4F46E5",
        },
        surface: {
          1: "#0F172A",
          2: "#1E293B",
          3: "#334155",
        },
        muted: {
          DEFAULT: "#1E293B",
          foreground: "#64748B",
        },
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "6px",
      },
      animation: {
        "slide-in-right": "slide-in-right 0.2s ease-out",
        "fade-in": "fade-in 0.15s ease-out",
        "slide-up": "slide-up 0.2s ease-out",
        "pulse-dot": "pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        "slide-in-right": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

export default config;
```

- [ ] **Step 3: Criar root layout.tsx**

```tsx
// apps/web/app/layout.tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "WhatsAgent — Atendimento IA pelo WhatsApp",
    template: "%s | WhatsAgent",
  },
  description:
    "Plataforma de IA para atendimento e vendas automático via WhatsApp. Configure seu agente em minutos.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="pt-BR" suppressHydrationWarning>
        <body className="bg-[#020617] text-slate-50 antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 4: Instalar dependências da web**

```bash
cd apps/web
pnpm add @clerk/nextjs zustand socket.io-client ky recharts lucide-react
pnpm add framer-motion @radix-ui/react-dialog @radix-ui/react-dropdown-menu
pnpm add react-hook-form @hookform/resolvers zod
pnpm add class-variance-authority clsx tailwind-merge
pnpm add tailwindcss-animate @tailwindcss/typography
# shadcn/ui CLI setup
npx shadcn@latest init
```

Durante o setup do shadcn, escolher:
- Style: Default
- Base color: Slate
- CSS variables: Yes

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat(web): setup design system, tailwind config, and clerk provider"
```

---

### Task 1b: Infraestrutura Frontend — api.ts, SocketProvider, notifications.store

**Files:**
- Create: `apps/web/lib/api.ts`
- Create: `apps/web/lib/store/notifications.store.ts`
- Create: `apps/web/components/providers/SocketProvider.tsx`

- [ ] **Step 1: Criar api.ts (HTTP client tipado com ky)**

```typescript
// apps/web/lib/api.ts
import ky from "ky";
import { auth } from "@clerk/nextjs/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

// Client para Server Components (com auth token automático)
export async function getServerApi() {
  const { getToken } = await auth();
  const token = await getToken();

  return ky.create({
    prefixUrl: API_BASE_URL,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    timeout: 30000,
    retry: { limit: 2, statusCodes: [429, 503] },
  });
}

// Client para Client Components (token injetado via cookie Clerk)
export const api = ky.create({
  prefixUrl: API_BASE_URL,
  credentials: "include",
  timeout: 30000,
  retry: { limit: 1 },
  hooks: {
    beforeRequest: [
      async (request) => {
        // Clerk injeta o token automaticamente via middleware
        // Em Client Components, usar useAuth().getToken() se necessário
      },
    ],
  },
});
```

- [ ] **Step 2: Criar notifications.store.ts (Zustand)**

```typescript
// apps/web/lib/store/notifications.store.ts
import { create } from "zustand";

interface NotificationsStore {
  unreadCount: number;
  badges: Record<string, number>;  // "pending_handoffs" | "active_conversations" | "pending_orders"
  
  incrementHandoffs: () => void;
  decrementHandoffs: () => void;
  setBadge: (key: string, count: number) => void;
  clearAll: () => void;
}

export const useNotificationsStore = create<NotificationsStore>((set) => ({
  unreadCount: 0,
  badges: {},
  
  incrementHandoffs: () =>
    set((s) => ({
      unreadCount: s.unreadCount + 1,
      badges: { ...s.badges, pending_handoffs: (s.badges["pending_handoffs"] ?? 0) + 1 },
    })),
  
  decrementHandoffs: () =>
    set((s) => ({
      unreadCount: Math.max(0, s.unreadCount - 1),
      badges: {
        ...s.badges,
        pending_handoffs: Math.max(0, (s.badges["pending_handoffs"] ?? 0) - 1),
      },
    })),
  
  setBadge: (key, count) =>
    set((s) => ({
      badges: { ...s.badges, [key]: count },
      unreadCount: Object.values({ ...s.badges, [key]: count }).reduce((a, b) => a + b, 0),
    })),
  
  clearAll: () => set({ unreadCount: 0, badges: {} }),
}));
```

- [ ] **Step 3: Criar SocketProvider.tsx**

```tsx
// apps/web/components/providers/SocketProvider.tsx
"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useInboxStore } from "@/lib/store/inbox.store";
import { useNotificationsStore } from "@/lib/store/notifications.store";
import type { WsEvent } from "@whatsagent/shared-types";

const SocketContext = createContext<Socket | null>(null);

export function useSocketContext() {
  return useContext(SocketContext);
}

export function SocketProvider({
  children,
  tenantId,
}: {
  children: React.ReactNode;
  tenantId?: string;
}) {
  const socketRef = useRef<Socket | null>(null);
  const addMessage = useInboxStore((s) => s.addMessage);
  const updateStatus = useInboxStore((s) => s.updateConversationStatus);
  const addHandoff = useInboxStore((s) => s.addHandoffConversation);
  const incrementHandoffs = useNotificationsStore((s) => s.incrementHandoffs);

  useEffect(() => {
    if (!tenantId) return;

    const socket = io(
      process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3002",
      {
        path: "/events/socket.io",
        transports: ["websocket"],
        auth: { tenantId },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
      },
    );

    socketRef.current = socket;

    socket.on("event", (event: WsEvent) => {
      switch (event.type) {
        case "new_message":
          addMessage(event.payload);
          break;
        case "conversation_status":
          updateStatus(event.payload);
          break;
        case "handoff_created":
          addHandoff(event.payload);
          incrementHandoffs();
          break;
      }
    });

    socket.on("connect_error", (err) => {
      console.warn("Socket connection error:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tenantId, addMessage, updateStatus, addHandoff, incrementHandoffs]);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/ apps/web/components/providers/
git commit -m "feat(web): add api client, socket provider, and notifications store"
```

---

### Task 2: Dashboard Layout (Sidebar + Header)

**Files:**
- Create: `apps/web/components/layout/Sidebar.tsx`
- Create: `apps/web/components/layout/Header.tsx`
- Create: `apps/web/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Criar Sidebar.tsx**

```tsx
// apps/web/components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, MessageSquare, Bot, Package,
  ShoppingCart, BarChart3, PhoneCall, Settings,
  Zap, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { useNotificationsStore } from "@/lib/store/notifications.store";

const NAV_ITEMS = [
  { href: "/overview",   label: "Overview",      icon: LayoutDashboard },
  { href: "/inbox",      label: "Conversas",     icon: MessageSquare,   badgeKey: "active_conversations" },
  { href: "/support",    label: "Suporte",       icon: PhoneCall,       badgeKey: "pending_handoffs" },
  { href: "/agent",      label: "Agente IA",     icon: Bot },
  { href: "/catalog",    label: "Catálogo",      icon: Package },
  { href: "/orders",     label: "Pedidos",       icon: ShoppingCart,    badgeKey: "pending_orders" },
  { href: "/analytics",  label: "Analytics",     icon: BarChart3 },
  { href: "/settings",   label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const badges = useNotificationsStore((s) => s.badges);

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-[#0F172A] border-r border-[#1E293B]",
        "transition-all duration-300 ease-in-out shrink-0",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[#1E293B]">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/20 shrink-0">
          <MessageSquare className="w-5 h-5 text-green-400" />
        </div>
        {!collapsed && (
          <span className="font-bold text-white tracking-tight text-lg">
            Whats<span className="text-green-400">Agent</span>
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, badgeKey }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          const badgeCount = badgeKey ? (badges[badgeKey] ?? 0) : 0;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "nav-item",
                isActive && "active",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? label : undefined}
            >
              <div className="relative shrink-0">
                <Icon className="w-5 h-5" />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-red-500 text-white rounded-full">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </div>
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex items-center justify-center w-6 h-6 
                   bg-[#1E293B] border border-[#334155] rounded-full 
                   text-slate-400 hover:text-white hover:border-slate-500
                   transition-colors duration-150 cursor-pointer z-10"
        aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {/* WhatsApp Status Indicator */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-[#1E293B]">
          <div className="flex items-center gap-2">
            <span className="live-indicator" />
            <span className="text-xs text-slate-400">WhatsApp conectado</span>
          </div>
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Criar Header.tsx**

```tsx
// apps/web/components/layout/Header.tsx
"use client";

import { Bell, Search, ChevronDown } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useState } from "react";
import { useNotificationsStore } from "@/lib/store/notifications.store";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const unread = useNotificationsStore((s) => s.unreadCount);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 
                       bg-[#020617]/80 backdrop-blur-xl border-b border-[#1E293B]">
      {/* Title */}
      <div>
        <h1 className="text-lg font-semibold text-white leading-none">{title}</h1>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg 
                     bg-[#0F172A] border border-[#1E293B] text-slate-500
                     hover:text-slate-300 hover:border-slate-700 
                     transition-colors duration-150 cursor-pointer text-sm"
          aria-label="Buscar"
        >
          <Search className="w-4 h-4" />
          <span className="hidden md:inline">Buscar...</span>
          <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] bg-[#1E293B] 
                          rounded border border-[#334155] text-slate-500">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <button
          className="relative flex items-center justify-center w-9 h-9 rounded-lg
                     bg-[#0F172A] border border-[#1E293B] text-slate-400
                     hover:text-white hover:border-slate-700 
                     transition-colors duration-150 cursor-pointer"
          aria-label={`${unread} notificações`}
        >
          <Bell className="w-4.5 h-4.5" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>

        {/* User */}
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "w-9 h-9 rounded-lg",
              userButtonPopoverCard: "bg-[#0F172A] border-[#1E293B]",
            },
          }}
        />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Criar (dashboard)/layout.tsx**

```tsx
// apps/web/app/(dashboard)/layout.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { SocketProvider } from "@/components/providers/SocketProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <SocketProvider>
      <div className="flex h-screen overflow-hidden bg-[#020617]">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SocketProvider>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/ apps/web/app/\(dashboard\)/layout.tsx
git commit -m "feat(web): add sidebar and header layout components"
```

---

### Task 3: Overview Page — Analytics Dashboard

**Files:**
- Create: `apps/web/app/(dashboard)/overview/page.tsx`
- Create: `apps/web/components/analytics/KpiCard.tsx`
- Create: `apps/web/components/analytics/ConversationsChart.tsx`

- [ ] **Step 1: Criar KpiCard.tsx**

```tsx
// apps/web/components/analytics/KpiCard.tsx
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;        // Percentual de mudança (positivo ou negativo)
  changeLabel?: string;   // "vs. ontem" | "vs. semana passada"
  icon: LucideIcon;
  iconColor?: string;     // Classe Tailwind de cor
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
}

export function KpiCard({
  title,
  value,
  change,
  changeLabel = "vs. período anterior",
  icon: Icon,
  iconColor = "text-green-400",
  trend,
  loading = false,
}: KpiCardProps) {
  const trendColor =
    trend === "up" ? "text-green-400" :
    trend === "down" ? "text-red-400" : "text-slate-500";
  
  const TrendIcon =
    trend === "up" ? TrendingUp :
    trend === "down" ? TrendingDown : Minus;

  if (loading) {
    return (
      <div className="glass-card p-5 animate-pulse">
        <div className="h-4 w-24 bg-slate-800 rounded mb-3" />
        <div className="h-8 w-32 bg-slate-800 rounded mb-2" />
        <div className="h-3 w-20 bg-slate-800 rounded" />
      </div>
    );
  }

  return (
    <div className="glass-card p-5 hover:border-slate-700 transition-colors duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            {title}
          </p>
          <p className="text-3xl font-bold text-white tracking-tight">
            {value}
          </p>
        </div>
        <div className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg",
          "bg-slate-800/60 border border-slate-700/50",
        )}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-1.5 mt-3">
          <TrendIcon className={cn("w-3.5 h-3.5", trendColor)} />
          <span className={cn("text-xs font-medium", trendColor)}>
            {change > 0 ? "+" : ""}{change}%
          </span>
          <span className="text-xs text-slate-600">{changeLabel}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar ConversationsChart.tsx**

```tsx
// apps/web/components/analytics/ConversationsChart.tsx
"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface ConversationsChartProps {
  data: Array<{
    date: string;
    total: number;
    ai_resolved: number;
    handoffs: number;
  }>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-[#0F172A] border border-[#334155] rounded-lg p-3 shadow-xl text-sm">
      <p className="text-slate-400 mb-2 text-xs">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-slate-300">{entry.name}:</span>
          <span className="text-white font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export function ConversationsChart({ data }: ConversationsChartProps) {
  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Conversas (30 dias)</h3>
        <p className="text-xs text-slate-500 mt-0.5">Volume total e resolução por IA</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#64748B", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: "#64748B", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="total"
            name="Total"
            stroke="#6366F1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#6366F1" }}
          />
          <Line
            type="monotone"
            dataKey="ai_resolved"
            name="Resolvidos por IA"
            stroke="#22C55E"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#22C55E" }}
          />
          <Line
            type="monotone"
            dataKey="handoffs"
            name="Transferências"
            stroke="#F59E0B"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Criar overview/page.tsx**

```tsx
// apps/web/app/(dashboard)/overview/page.tsx
import { Header } from "@/components/layout/Header";
import { KpiCard } from "@/components/analytics/KpiCard";
import { ConversationsChart } from "@/components/analytics/ConversationsChart";
import {
  MessageSquare, Zap, DollarSign, PhoneCall,
  Users, ShoppingCart, TrendingUp, Clock,
} from "lucide-react";
import { api } from "@/lib/api";

async function getOverviewData() {
  try {
    const [kpis, chartData, recentConversations] = await Promise.all([
      api.get("analytics/kpis").json<Record<string, number>>(),
      api.get("analytics/conversations-chart").json<any[]>(),
      api.get("conversations?limit=5&sort=lastMessageAt").json<any[]>(),
    ]);
    return { kpis, chartData, recentConversations };
  } catch {
    // Retornar dados mock durante dev sem API
    return {
      kpis: {
        conversations_today: 147,
        ai_resolution_rate: 87,
        revenue_today: 428900,
        pending_handoffs: 3,
        avg_response_time_sec: 4,
        new_contacts_today: 31,
        orders_today: 18,
        conversion_rate: 12,
      },
      chartData: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        total: Math.floor(Math.random() * 80) + 60,
        ai_resolved: Math.floor(Math.random() * 60) + 40,
        handoffs: Math.floor(Math.random() * 15) + 3,
      })),
      recentConversations: [],
    };
  }
}

export default async function OverviewPage() {
  const { kpis, chartData, recentConversations } = await getOverviewData();
  
  const kpiCards = [
    {
      title: "Conversas Hoje",
      value: kpis.conversations_today ?? 0,
      change: 12,
      trend: "up" as const,
      icon: MessageSquare,
      iconColor: "text-indigo-400",
      changeLabel: "vs. ontem",
    },
    {
      title: "Resolução por IA",
      value: `${kpis.ai_resolution_rate ?? 0}%`,
      change: 3.2,
      trend: "up" as const,
      icon: Zap,
      iconColor: "text-green-400",
      changeLabel: "vs. semana passada",
    },
    {
      title: "Receita do Dia",
      value: `R$ ${((kpis.revenue_today ?? 0) / 100).toFixed(2).replace(".", ",")}`,
      change: -5.1,
      trend: "down" as const,
      icon: DollarSign,
      iconColor: "text-yellow-400",
      changeLabel: "vs. ontem",
    },
    {
      title: "Handoffs Pendentes",
      value: kpis.pending_handoffs ?? 0,
      icon: PhoneCall,
      iconColor: kpis.pending_handoffs > 0 ? "text-red-400" : "text-slate-400",
      changeLabel: "aguardando atendente",
    },
    {
      title: "Tempo Médio Resp.",
      value: `${kpis.avg_response_time_sec ?? 0}s`,
      change: -18,
      trend: "up" as const,
      icon: Clock,
      iconColor: "text-cyan-400",
      changeLabel: "vs. semana passada",
    },
    {
      title: "Novos Contatos",
      value: kpis.new_contacts_today ?? 0,
      change: 8,
      trend: "up" as const,
      icon: Users,
      iconColor: "text-violet-400",
      changeLabel: "vs. ontem",
    },
    {
      title: "Pedidos Hoje",
      value: kpis.orders_today ?? 0,
      change: 25,
      trend: "up" as const,
      icon: ShoppingCart,
      iconColor: "text-orange-400",
      changeLabel: "vs. ontem",
    },
    {
      title: "Taxa Conversão",
      value: `${kpis.conversion_rate ?? 0}%`,
      change: 1.5,
      trend: "up" as const,
      icon: TrendingUp,
      iconColor: "text-emerald-400",
      changeLabel: "conversations → pedido",
    },
  ];

  return (
    <div className="animate-fade-in">
      <Header
        title="Overview"
        subtitle={new Date().toLocaleDateString("pt-BR", {
          weekday: "long", day: "numeric", month: "long", year: "numeric",
        })}
      />

      <div className="p-6 space-y-6">
        {/* KPI Grid */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Métricas de Hoje
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiCards.map((card) => (
              <KpiCard key={card.title} {...card} />
            ))}
          </div>
        </section>

        {/* Charts Row */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ConversationsChart data={chartData} />
          </div>
          
          {/* Quick Stats */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Status do Agente</h3>
            <div className="space-y-4">
              {[
                { label: "Taxa Resolução IA", value: `${kpis.ai_resolution_rate}%`, color: "bg-green-500", width: `${kpis.ai_resolution_rate}%` },
                { label: "Satisfação CSAT", value: "4.7/5", color: "bg-indigo-500", width: "94%" },
                { label: "Precisão Catálogo", value: "96%", color: "bg-cyan-500", width: "96%" },
                { label: "Uptime API", value: "99.9%", color: "bg-yellow-500", width: "99.9%" },
              ].map(({ label, value, color, width }) => (
                <div key={label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-slate-400">{label}</span>
                    <span className="text-xs font-semibold text-white">{value}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full transition-all duration-700`}
                      style={{ width }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Recent Conversations Table */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Conversas Recentes
            </h2>
            <a href="/inbox" className="text-xs text-green-400 hover:text-green-300 transition-colors">
              Ver todas →
            </a>
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  {["Contato", "Última mensagem", "Estágio", "Status", "Horário"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentConversations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-600 text-sm">
                      Nenhuma conversa recente
                    </td>
                  </tr>
                ) : (
                  recentConversations.map((conv: any) => (
                    <tr key={conv.id} className="border-b border-[#1E293B]/50 hover:bg-[#0F172A]/50 cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{conv.contact?.name ?? conv.contact?.phone}</td>
                      <td className="px-4 py-3 text-slate-400 truncate max-w-[200px]">{conv.lastMessage}</td>
                      <td className="px-4 py-3"><span className="text-xs text-slate-500 capitalize">{conv.currentStage}</span></td>
                      <td className="px-4 py-3"><StatusBadge status={conv.status} /></td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(conv.lastMessageAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; class: string }> = {
    ACTIVE: { label: "Ativo", class: "bg-green-500/10 text-green-400 border-green-500/20" },
    HUMAN_HANDOFF: { label: "Handoff", class: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
    CLOSED: { label: "Encerrado", class: "bg-slate-700 text-slate-400 border-slate-600" },
    PAUSED: { label: "Pausado", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  };
  
  const cfg = statusConfig[status] ?? { label: status, class: "bg-slate-700 text-slate-400 border-slate-600" };
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.class}`}>
      {cfg.label}
    </span>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/overview/ apps/web/components/analytics/
git commit -m "feat(web): add analytics overview page with KPI cards and charts"
```

---

### Task 4: Unified Inbox — Conversas em Tempo Real

**Files:**
- Create: `apps/web/app/(dashboard)/inbox/page.tsx`
- Create: `apps/web/components/chat/ConversationList.tsx`
- Create: `apps/web/components/chat/ChatView.tsx`
- Create: `apps/web/components/chat/MessageBubble.tsx`
- Create: `apps/web/lib/store/inbox.store.ts`
- Create: `apps/web/hooks/useSocket.ts`

- [ ] **Step 1: Criar inbox.store.ts (Zustand)**

```typescript
// apps/web/lib/store/inbox.store.ts
import { create } from "zustand";
import type { WsNewMessage, WsConvStatus, WsHandoff } from "@whatsagent/shared-types";

interface Message {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  type: string;
  text?: string;
  audioUrl?: string;
  sentAt: string;
  isFromAi: boolean;
}

interface Conversation {
  id: string;
  contact: { name?: string; phone: string; avatarUrl?: string };
  status: string;
  lastMessage?: string;
  lastMessageAt?: string;
  currentStage?: string;
  unreadCount: number;
  isHandoff: boolean;
}

interface InboxStore {
  conversations: Conversation[];
  messages: Record<string, Message[]>;  // conversationId → messages
  activeConversationId: string | null;
  
  setConversations: (convs: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  addMessage: (msg: WsNewMessage) => void;
  updateConversationStatus: (update: WsConvStatus) => void;
  addHandoffConversation: (event: WsHandoff) => void;
  markAsRead: (conversationId: string) => void;
}

export const useInboxStore = create<InboxStore>((set) => ({
  conversations: [],
  messages: {},
  activeConversationId: null,
  
  setConversations: (conversations) => set({ conversations }),
  
  setActiveConversation: (id) => set({ activeConversationId: id }),
  
  addMessage: (msg) => set((state) => {
    const existing = state.messages[msg.conversationId] ?? [];
    const newMessage: Message = {
      id: msg.messageId,
      conversationId: msg.conversationId,
      direction: msg.direction,
      type: msg.type,
      text: msg.text,
      audioUrl: msg.audioUrl,
      sentAt: msg.sentAt,
      isFromAi: msg.isFromAi,
    };
    
    // Atualizar última mensagem na lista
    const updatedConvs = state.conversations.map((c) =>
      c.id === msg.conversationId
        ? {
            ...c,
            lastMessage: msg.text ?? "[mídia]",
            lastMessageAt: msg.sentAt,
            unreadCount:
              state.activeConversationId === msg.conversationId
                ? 0
                : c.unreadCount + (msg.direction === "inbound" ? 1 : 0),
          }
        : c,
    );
    
    return {
      messages: {
        ...state.messages,
        [msg.conversationId]: [...existing, newMessage],
      },
      conversations: updatedConvs,
    };
  }),
  
  updateConversationStatus: ({ conversationId, status }) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, status, isHandoff: status === "HUMAN_HANDOFF" } : c,
      ),
    })),
  
  addHandoffConversation: (event) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === event.conversationId
          ? { ...c, isHandoff: true, status: "HUMAN_HANDOFF" }
          : c,
      ),
    })),
  
  markAsRead: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c,
      ),
    })),
}));
```

- [ ] **Step 2: Criar useSocket.ts hook**

```typescript
// apps/web/hooks/useSocket.ts
"use client";

import { useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useInboxStore } from "@/lib/store/inbox.store";
import { useNotificationsStore } from "@/lib/store/notifications.store";
import type { WsEvent } from "@whatsagent/shared-types";

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3002", {
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
}

export function useSocket() {
  const addMessage = useInboxStore((s) => s.addMessage);
  const updateStatus = useInboxStore((s) => s.updateConversationStatus);
  const addHandoff = useInboxStore((s) => s.addHandoffConversation);
  const incrementHandoffs = useNotificationsStore((s) => s.incrementHandoffs);

  useEffect(() => {
    const sock = getSocket();
    
    const handleEvent = (event: WsEvent) => {
      switch (event.type) {
        case "new_message":
          addMessage(event.payload);
          break;
        case "conversation_status":
          updateStatus(event.payload);
          break;
        case "handoff_created":
          addHandoff(event.payload);
          incrementHandoffs();
          // Toast notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Novo handoff", {
              body: `${event.payload.contactName ?? event.payload.contactPhone} aguarda atendimento`,
              icon: "/icon-192.png",
            });
          }
          break;
      }
    };
    
    sock.on("event", handleEvent);
    
    return () => {
      sock.off("event", handleEvent);
    };
  }, [addMessage, updateStatus, addHandoff, incrementHandoffs]);

  const emit = useCallback((eventName: string, data: unknown) => {
    getSocket().emit(eventName, data);
  }, []);

  return { emit };
}
```

- [ ] **Step 3: Criar ChatView.tsx e MessageBubble.tsx**

```tsx
// apps/web/components/chat/MessageBubble.tsx
import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

interface MessageBubbleProps {
  direction: "inbound" | "outbound";
  type: string;
  text?: string;
  audioUrl?: string;
  isFromAi?: boolean;
  sentAt: string;
}

export function MessageBubble({
  direction,
  type,
  text,
  audioUrl,
  isFromAi,
  sentAt,
}: MessageBubbleProps) {
  const isInbound = direction === "inbound";
  const time = new Date(sentAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={cn("flex gap-2 mb-3", isInbound ? "justify-start" : "justify-end")}>
      {isInbound && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center mt-1">
          <User className="w-4 h-4 text-slate-300" />
        </div>
      )}

      <div className={cn("max-w-[75%]")}>
        {type === "audio" && audioUrl ? (
          <div className={cn(
            "flex items-center gap-2 px-3 py-2.5 rounded-2xl",
            isInbound ? "bubble-inbound" : "bubble-ai",
          )}>
            <audio controls className="h-8 max-w-[200px] opacity-80" src={audioUrl}>
              <track kind="captions" />
            </audio>
          </div>
        ) : (
          <div className={cn(
            "px-3.5 py-2.5 text-sm leading-relaxed",
            isInbound ? "bubble-inbound" : isFromAi ? "bubble-ai" : "bubble-outbound",
          )}>
            <p className="whitespace-pre-wrap break-words">{text}</p>
          </div>
        )}

        <div className={cn(
          "flex items-center gap-1 mt-0.5 px-1",
          isInbound ? "justify-start" : "justify-end",
        )}>
          {!isInbound && isFromAi && (
            <Bot className="w-3 h-3 text-indigo-400" />
          )}
          <span className="text-[10px] text-slate-600">{time}</span>
        </div>
      </div>

      {!isInbound && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mt-1">
          {isFromAi ? (
            <Bot className="w-4 h-4 text-indigo-400" />
          ) : (
            <User className="w-4 h-4 text-indigo-300" />
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/inbox/ apps/web/components/chat/ apps/web/hooks/ apps/web/lib/store/
git commit -m "feat(web): add unified inbox with realtime socket.io integration"
```

---

### Task 5: Agent Configuration — Persona + Knowledge + Test Simulator

**Files:**
- Create: `apps/web/app/(dashboard)/agent/persona/page.tsx`
- Create: `apps/web/components/agent/TestSimulator.tsx`

- [ ] **Step 1: Criar TestSimulator.tsx**

```tsx
// apps/web/components/agent/TestSimulator.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Send, RefreshCw, Bug, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface SimMessage {
  role: "user" | "assistant";
  content: string;
  debugTrace?: string[];
  toolCalls?: Array<{ name: string; result: string }>;
}

export function TestSimulator({ tenantId }: { tenantId: string }) {
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [sessionId] = useState(() => `test_${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const response = await api
        .post("agent/test", {
          json: { tenantId, sessionId, message: userMsg },
        })
        .json<{
          response: string;
          debugTrace: string[];
          toolCalls: Array<{ name: string; result: string }>;
        }>();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.response,
          debugTrace: response.debugTrace,
          toolCalls: response.toolCalls,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "[Erro ao processar mensagem. Verifique os logs.]" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function resetSession() {
    setMessages([]);
  }

  return (
    <div className="glass-card flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E293B]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Simulador de Teste</p>
            <p className="text-[10px] text-slate-500">Conversa com o agente configurado</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium",
              "border transition-colors duration-150 cursor-pointer",
              showDebug
                ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                : "bg-transparent border-[#334155] text-slate-500 hover:text-slate-300",
            )}
          >
            <Bug className="w-3.5 h-3.5" />
            Debug
          </button>
          <button
            onClick={resetSession}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                       border border-[#334155] text-slate-500 hover:text-slate-300
                       transition-colors duration-150 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Resetar
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-sm text-slate-600">Envie uma mensagem para testar o agente</p>
            <p className="text-xs text-slate-700 mt-1">
              Ex: "Olá", "Quero ver camisetas", "Me mostra o preço do produto X"
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <div className={cn("flex gap-2 mb-1", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm",
                msg.role === "user"
                  ? "bg-green-500/20 text-green-100 rounded-br-sm"
                  : "bg-[#1E293B] text-slate-100 rounded-bl-sm",
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>

            {/* Debug panel */}
            {showDebug && msg.role === "assistant" && msg.debugTrace && (
              <div className="ml-2 mb-3 text-[10px] font-mono text-slate-600 bg-[#0F172A] border border-[#1E293B] rounded p-2 space-y-0.5">
                {msg.debugTrace.map((trace, j) => (
                  <div key={j} className="text-indigo-400/70">▸ {trace}</div>
                ))}
                {msg.toolCalls?.map((tc, j) => (
                  <div key={j} className="text-yellow-400/70">
                    🔧 {tc.name}: {tc.result?.substring(0, 80)}...
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="bg-[#1E293B] px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse-dot"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[#1E293B]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite uma mensagem de teste..."
            className="flex-1 bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-2.5 
                       text-sm text-white placeholder-slate-600
                       focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20
                       transition-colors duration-150"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-xl
                       bg-green-500 hover:bg-green-400 disabled:bg-slate-700 disabled:cursor-not-allowed
                       text-white transition-colors duration-150 cursor-pointer"
            aria-label="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/agent/ apps/web/app/\(dashboard\)/agent/
git commit -m "feat(web): add agent config pages with test simulator and debug panel"
```

---

## Verificação do Plan 4

- [ ] `pnpm --filter @whatsagent/web dev` → Next.js em http://localhost:3000
- [ ] Landing page carrega corretamente
- [ ] `/sign-in` → Clerk authentication funcional
- [ ] Após login → redirect para `/overview`
- [ ] Dashboard Overview mostra KPI cards e gráfico
- [ ] Sidebar colapsável funciona
- [ ] Inbox recebe mensagem em tempo real via Socket.io (abrir em segundo tab)
- [ ] Agent config → Persona editor salva via API
- [ ] Test Simulator conversa com agente real
- [ ] `pnpm --filter @whatsagent/web build` → build sem erros TypeScript
- [ ] Responsivo em mobile 375px (sidebar some, menu hamburger)
- [ ] Contraste WCAG AA verificado (ferramentas: axe, WAVE)
