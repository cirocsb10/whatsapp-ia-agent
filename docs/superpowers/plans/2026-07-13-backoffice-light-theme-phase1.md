# Backoffice Light Theme Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme the WhatsAgent backoffice shell (tokens, Sidebar, Header, generic Modal, buttons, form primitives, tags) from the current dark OLED look to a light theme matching PrevConsulta's backoffice, without touching the public landing page or feature-specific pages (those are later phases).

**Architecture:** The whole app is styled through named CSS classes in one file, `apps/web/src/app/globals.css` (`@layer components`), consumed by React components that only ever reference class names (`.nav-item`, `.modal-panel`, `.form-input`, etc.) — almost no inline Tailwind color utilities. This means Phase 1 is executed as a sequence of precise CSS-value edits to that file, plus a handful of small JSX edits where a component hardcodes a hex color instead of using a class/token (`Sidebar.tsx`, `Header.tsx`, the two dashboard/admin layout wrappers, `layout.tsx`).

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS v4 (`@import "tailwindcss"` + `@layer` — no separate PostCSS config), `next/font/google`.

**Testing approach note:** This phase is a visual restyle with no business logic, so there are no unit tests to write. Each task's "test" step is (a) a `grep` that proves the old dark value is gone and the new value is present, and (b) `pnpm --filter @whatsagent/web build` to catch any broken reference. Task 8 adds a manual visual QA pass in the browser, which is the real acceptance check for a theme change.

## Global Constraints

- Keep the existing green (`#22c55e`) and indigo (`#6366f1`) accent colors — do not introduce a new accent palette.
- Do not touch any `.lp-*` class (landing page) or `AuthShell.tsx` (public login/register) — those stay dark per the approved design.
- Do not touch feature-page-specific classes (`.kpi*`, `.product-card*`, `.product-list-row*`, `.catalog-*`, `.import-*`, `.filter-panel*`, `.rules-*`, chat/kanban classes) — later phases.
- All edits are exact-string replacements in `apps/web/src/app/globals.css`; reproduce whitespace/indentation exactly as shown in each step so the edit applies cleanly.
- Font changes to `Outfit` everywhere `Plus_Jakarta_Sans`/`Inter` previously applied to the backoffice; `Fraunces` (landing-page-only serif) is untouched.

---

### Task 1: Design tokens, base styles, and font swap

**Files:**
- Modify: `apps/web/src/app/globals.css:1-35`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`
- Modify: `apps/web/src/app/(admin)/layout.tsx`

**Interfaces:**
- Produces: light-theme CSS custom properties (`--c-base`, `--c-s1`, `--c-s2`, `--c-s3`, `--c-border`, `--c-text`, `--c-muted`, `--c-subtle`, `--c-green`, `--c-indigo`) that every later task's CSS rules reference via `var(...)`. Later tasks assume these already resolve to light values.
- Produces: `Outfit` as the active `font-sans` family (via `tailwind.config.ts` `fontFamily.sans` and the `next/font` `outfit` variable applied on `<body>`).

- [ ] **Step 1: Replace the design-tokens/base block in `globals.css`**

Find this exact block at the top of the file:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800&display=swap');
@import "tailwindcss";

/* ─── Design tokens ─────────────────────────────────────────── */
@layer base {
  :root {
    --c-base:    #070d1a;
    --c-s1:      #0c1526;
    --c-s2:      #111e32;
    --c-s3:      #1a2d47;
    --c-border:  #1a2d47;
    --c-green:   #22c55e;
    --c-indigo:  #6366f1;
    --c-text:    #e2e8f0;
    --c-muted:   #64748b;
    --c-subtle:  #334155;
  }

  html { color-scheme: dark; scroll-behavior: smooth; }

  body {
    background: var(--c-base);
    color: var(--c-text);
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    font-feature-settings: 'cv02','cv03','cv04','cv11','ss01';
  }

  * { box-sizing: border-box; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--c-s3); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--c-muted); }
}
```

Replace it with:

```css
@import "tailwindcss";

/* ─── Design tokens ─────────────────────────────────────────── */
@layer base {
  :root {
    --c-base:    #f8fafc;
    --c-s1:      #ffffff;
    --c-s2:      #f8fafc;
    --c-s3:      #cbd5e1;
    --c-border:  #e2e8f0;
    --c-green:   #22c55e;
    --c-indigo:  #6366f1;
    --c-text:    #0f172a;
    --c-muted:   #64748b;
    --c-subtle:  #94a3b8;
  }

  html { color-scheme: light; scroll-behavior: smooth; }

  body {
    background: var(--c-base);
    color: var(--c-text);
    -webkit-font-smoothing: antialiased;
    font-feature-settings: 'cv02','cv03','cv04','cv11','ss01';
  }

  * { box-sizing: border-box; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--c-s3); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--c-muted); }
}
```

- [ ] **Step 2: Swap the font in `layout.tsx`**

In `apps/web/src/app/layout.tsx`, replace:

```tsx
import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
```

with:

```tsx
import { Outfit, Fraunces } from "next/font/google";
```

Replace:

```tsx
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});
```

with:

```tsx
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});
```

Replace:

```tsx
      <body className={`${plusJakarta.variable} ${fraunces.variable} bg-[#020617] font-sans text-slate-50 antialiased`}>
```

with:

```tsx
      <body className={`${outfit.variable} ${fraunces.variable} bg-[#f8fafc] font-sans text-slate-900 antialiased`}>
```

- [ ] **Step 3: Update `tailwind.config.ts`**

Replace:

```ts
      fontFamily: { sans: ["Plus Jakarta Sans", "sans-serif"] },
```

with:

```ts
      fontFamily: { sans: ["Outfit", "sans-serif"] },
```

- [ ] **Step 4: Fix the two hardcoded-dark route-group layout wrappers**

In `apps/web/src/app/(dashboard)/layout.tsx`, replace:

```tsx
      <div className="flex h-screen overflow-hidden bg-[#070d1a]">
```

with:

```tsx
      <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
```

In `apps/web/src/app/(admin)/layout.tsx`, replace:

```tsx
  return <div className="flex h-screen overflow-hidden bg-[#020617]"><Sidebar /><div className="flex flex-col flex-1 overflow-hidden"><main className="flex-1 overflow-y-auto">{children}</main></div></div>;
```

with:

```tsx
  return <div className="flex h-screen overflow-hidden bg-[#f8fafc]"><Sidebar /><div className="flex flex-col flex-1 overflow-hidden"><main className="flex-1 overflow-y-auto">{children}</main></div></div>;
```

- [ ] **Step 5: Verify — no stale dark tokens, no stale font name**

Run:

```bash
grep -n "070d1a\|020617" apps/web/src/app/layout.tsx apps/web/src/app/\(dashboard\)/layout.tsx apps/web/src/app/\(admin\)/layout.tsx
```

Expected: no output (empty match). (`AuthShell.tsx` still legitimately contains `#020617` — do not touch it, it's out of scope.)

Run:

```bash
grep -n "Plus Jakarta Sans\|Plus_Jakarta_Sans" apps/web/tailwind.config.ts apps/web/src/app/layout.tsx
```

Expected: no output.

- [ ] **Step 6: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds (no TypeScript/import errors from the renamed `outfit` binding or removed `plusJakarta` references).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/layout.tsx apps/web/tailwind.config.ts "apps/web/src/app/(dashboard)/layout.tsx" "apps/web/src/app/(admin)/layout.tsx"
git commit -m "feat(web): light-theme design tokens and Outfit font for backoffice shell"
```

---

### Task 2: Sidebar and topbar shell chrome

**Files:**
- Modify: `apps/web/src/app/globals.css` (`.nav-item*`, `.tag-*`... no — tags are Task 7; here: `.app-shell-topbar`, `.brand-*`, `.sidebar-brand*`, `.dashboard-topbar*`, `.nav-item*`)
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `var(--c-*)` tokens from Task 1.
- Produces: no new interfaces; this is a leaf visual change.

- [ ] **Step 1: Restyle `.nav-item*` in `globals.css`**

Replace:

```css
  .nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 450;
    color: var(--c-muted);
    text-decoration: none;
    transition: color 140ms, background 140ms;
    white-space: nowrap;
    cursor: pointer;
  }
  .nav-item:hover { color: var(--c-text); background: rgba(255,255,255,0.05); }
  .nav-item.active {
    color: #f1f5f9;
    background: rgba(255,255,255,0.07);
    box-shadow: inset 2px 0 0 var(--c-green);
  }
  .nav-item.active svg { color: var(--c-green); }
  .nav-item-admin {
    border: 1px solid rgba(249, 115, 22, 0.15);
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.06), rgba(99, 102, 241, 0.04));
  }
  .nav-item-admin:hover {
    border-color: rgba(249, 115, 22, 0.28);
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(99, 102, 241, 0.08));
  }
  .nav-item-admin.active {
    box-shadow: inset 2px 0 0 #f97316;
  }
  .nav-item-admin.active svg { color: #fb923c; }
```

with:

```css
  .nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 450;
    color: var(--c-muted);
    text-decoration: none;
    transition: color 140ms, background 140ms;
    white-space: nowrap;
    cursor: pointer;
  }
  .nav-item:hover { color: var(--c-text); background: rgba(15,23,42,0.04); }
  .nav-item.active {
    color: #0f172a;
    background: rgba(99,102,241,0.08);
    box-shadow: inset 2px 0 0 var(--c-green);
  }
  .nav-item.active svg { color: var(--c-green); }
  .nav-item-admin {
    border: 1px solid rgba(249, 115, 22, 0.2);
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.08), rgba(99, 102, 241, 0.05));
  }
  .nav-item-admin:hover {
    border-color: rgba(249, 115, 22, 0.35);
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(99, 102, 241, 0.08));
  }
  .nav-item-admin.active {
    box-shadow: inset 2px 0 0 #f97316;
  }
  .nav-item-admin.active svg { color: #ea580c; }
```

Note: `.section-title` and `.hr` need no edit here — they already reference `var(--c-subtle)` / `var(--c-border)`, which Task 1 already remapped to light values.

- [ ] **Step 2: Restyle brand/topbar block in `globals.css`**

Replace:

```css
  /* ── App shell (sidebar + topbar) ─────────────────────────── */
  .app-shell-topbar {
    height: 52px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--c-border);
    background: rgba(7, 13, 26, 0.98);
  }

  /* ── Brand logo (setup + sidebar) ─────────────────────────── */
  .brand-logo {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }
  .brand-logo svg {
    width: 14px;
    height: 14px;
  }
  .brand-name {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: #ffffff;
    white-space: nowrap;
    text-decoration: none;
  }
  .brand-name-accent {
    color: #22c55e;
  }
  .brand-link {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
  }
  .brand-link:hover {
    text-decoration: none;
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 52px;
    padding: 0 14px;
    border-bottom: 1px solid var(--c-border);
    background: rgba(7, 13, 26, 0.98);
    flex-shrink: 0;
    text-decoration: none;
    color: inherit;
    transition: background 140ms ease;
  }
  .sidebar-brand:hover {
    text-decoration: none;
    background: rgba(12, 21, 38, 0.98);
  }
  .sidebar-brand-collapsed {
    justify-content: center;
    padding: 0;
  }

  .dashboard-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    height: 52px;
    padding: 0 20px;
    position: sticky;
    top: 0;
    z-index: 30;
    border-bottom: 1px solid var(--c-border);
    background: rgba(7, 13, 26, 0.95);
    backdrop-filter: blur(8px);
    flex-shrink: 0;
  }
  .dashboard-topbar-start {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }
  .dashboard-topbar-title {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .dashboard-topbar-heading {
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }
  .dashboard-topbar-subtitle {
    font-size: 11px;
    color: #64748b;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @media (min-width: 640px) {
    .dashboard-topbar-subtitle { display: block; }
  }
```

with:

```css
  /* ── App shell (sidebar + topbar) ─────────────────────────── */
  .app-shell-topbar {
    height: 52px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--c-border);
    background: rgba(255, 255, 255, 0.98);
  }

  /* ── Brand logo (setup + sidebar) ─────────────────────────── */
  .brand-logo {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }
  .brand-logo svg {
    width: 14px;
    height: 14px;
  }
  .brand-name {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: #0f172a;
    white-space: nowrap;
    text-decoration: none;
  }
  .brand-name-accent {
    color: #22c55e;
  }
  .brand-link {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
  }
  .brand-link:hover {
    text-decoration: none;
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 52px;
    padding: 0 14px;
    border-bottom: 1px solid var(--c-border);
    background: #ffffff;
    flex-shrink: 0;
    text-decoration: none;
    color: inherit;
    transition: background 140ms ease;
  }
  .sidebar-brand:hover {
    text-decoration: none;
    background: #f8fafc;
  }
  .sidebar-brand-collapsed {
    justify-content: center;
    padding: 0;
  }

  .dashboard-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    height: 52px;
    padding: 0 20px;
    position: sticky;
    top: 0;
    z-index: 30;
    border-bottom: 1px solid var(--c-border);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(8px);
    flex-shrink: 0;
  }
  .dashboard-topbar-start {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }
  .dashboard-topbar-title {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .dashboard-topbar-heading {
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }
  .dashboard-topbar-subtitle {
    font-size: 11px;
    color: #64748b;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @media (min-width: 640px) {
    .dashboard-topbar-subtitle { display: block; }
  }
```

- [ ] **Step 3: Fix hardcoded hex classes in `Sidebar.tsx`**

In `apps/web/src/components/layout/Sidebar.tsx`, replace:

```tsx
      className="relative flex flex-col h-screen shrink-0 bg-[#070d1a] border-r border-[#1a2d47] transition-[width] duration-200 overflow-hidden"
```

with:

```tsx
      className="relative flex flex-col h-screen shrink-0 bg-white border-r border-slate-200 transition-[width] duration-200 overflow-hidden"
```

Replace:

```tsx
      <div className={cn("border-t border-[#1a2d47] py-3 shrink-0", collapsed ? "px-0 flex justify-center" : "px-3")}>
```

with:

```tsx
      <div className={cn("border-t border-slate-200 py-3 shrink-0", collapsed ? "px-0 flex justify-center" : "px-3")}>
```

Replace:

```tsx
              <p className="text-[11px] text-[#94a3b8] font-medium leading-none truncate">WhatsApp conectado</p>
```

with:

```tsx
              <p className="text-[11px] text-slate-500 font-medium leading-none truncate">WhatsApp conectado</p>
```

Replace:

```tsx
              <p className="text-[10px] text-[#334155] mt-0.5 leading-none">Meta Cloud API</p>
```

with:

```tsx
              <p className="text-[10px] text-slate-400 mt-0.5 leading-none">Meta Cloud API</p>
```

Replace:

```tsx
              <p className="text-[10px] text-[#334155] mt-1.5 leading-none truncate">
```

with:

```tsx
              <p className="text-[10px] text-slate-400 mt-1.5 leading-none truncate">
```

- [ ] **Step 4: Verify no hardcoded hex remain in `Sidebar.tsx`**

Run:

```bash
grep -n "#070d1a\|#1a2d47\|#94a3b8\|#334155" apps/web/src/components/layout/Sidebar.tsx
```

Expected: no output.

- [ ] **Step 5: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat(web): light-theme Sidebar and topbar chrome"
```

---

### Task 3: Header widgets (icon buttons, user menu, search)

**Files:**
- Modify: `apps/web/src/app/globals.css` (`.header-user-dropdown*` block only — `.header-icon-btn*` and `.header-search-*` are already token-driven from Task 1)
- Modify: `apps/web/src/components/layout/Header.tsx`

**Interfaces:**
- Consumes: `var(--c-*)` tokens from Task 1.

- [ ] **Step 1: Restyle the user dropdown menu in `globals.css`**

Replace:

```css
  .header-user-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 200px;
    background: #111827;
    border: 1px solid rgba(99,102,241,0.18);
    border-radius: 10px;
    padding: 6px;
    z-index: 100;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  .header-user-dropdown-info {
    padding: 6px 8px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .header-user-dropdown-name {
    font-size: 12px;
    font-weight: 600;
    color: #e2e8f0;
  }
  .header-user-dropdown-email {
    font-size: 11px;
    color: #64748b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .header-user-dropdown-divider {
    height: 1px;
    background: rgba(99,102,241,0.1);
    margin: 4px 0;
  }
  .header-user-dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 8px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    background: transparent;
    border: none;
    color: #94a3b8;
    transition: background 120ms, color 120ms;
    text-align: left;
  }
  .header-user-dropdown-item:hover { background: rgba(255,255,255,0.05); color: #e2e8f0; }
  .header-user-dropdown-item-danger:hover { background: rgba(239,68,68,0.08); color: #f87171; }
```

with:

```css
  .header-user-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 200px;
    background: #ffffff;
    border: 1px solid var(--c-border);
    border-radius: 10px;
    padding: 6px;
    z-index: 100;
    box-shadow: 0 12px 32px rgba(15,23,42,0.16);
  }
  .header-user-dropdown-info {
    padding: 6px 8px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .header-user-dropdown-name {
    font-size: 12px;
    font-weight: 600;
    color: #0f172a;
  }
  .header-user-dropdown-email {
    font-size: 11px;
    color: #64748b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .header-user-dropdown-divider {
    height: 1px;
    background: var(--c-border);
    margin: 4px 0;
  }
  .header-user-dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 8px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    background: transparent;
    border: none;
    color: #64748b;
    transition: background 120ms, color 120ms;
    text-align: left;
  }
  .header-user-dropdown-item:hover { background: rgba(15,23,42,0.05); color: #0f172a; }
  .header-user-dropdown-item-danger:hover { background: rgba(239,68,68,0.08); color: #dc2626; }
```

- [ ] **Step 2: Fix the notification-dot ring color in `Header.tsx`**

Replace:

```tsx
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-[#0c1526]" />
```

with:

```tsx
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-white" />
```

- [ ] **Step 3: Verify**

Run:

```bash
grep -n "#111827\|#0c1526" apps/web/src/app/globals.css apps/web/src/components/layout/Header.tsx
```

Expected: no output.

- [ ] **Step 4: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/layout/Header.tsx
git commit -m "feat(web): light-theme header user menu and notification dot"
```

---

### Task 4: Generic modal system

**Files:**
- Modify: `apps/web/src/app/globals.css` (`.modal-*` block)

**Interfaces:**
- Consumes: `var(--c-border)` from Task 1. No code changes needed in `Modal.tsx` itself — it only emits these class names.

- [ ] **Step 1: Restyle `.modal-*` in `globals.css`**

Replace:

```css
  /* ── Modal ────────────────────────────────────────────────── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(7,13,26,0.75);
    backdrop-filter: blur(8px);
    animation: modal-fade-in 200ms ease-out;
  }
  @keyframes modal-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .modal-panel {
    width: 100%;
    background: rgba(12,21,38,0.95);
    border: 1px solid rgba(99,102,241,0.15);
    border-radius: 14px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset;
    animation: modal-slide-up 240ms ease-out;
    max-height: calc(100vh - 32px);
    display: flex;
    flex-direction: column;
  }
  .modal-panel-sm { max-width: 400px; }
  .modal-panel-md { max-width: 520px; }
  .modal-panel-lg { max-width: 720px; }
  .modal-panel-xl { max-width: 1040px; }
  @keyframes modal-slide-up {
    from { opacity: 0; transform: translateY(12px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 20px 16px;
    border-bottom: 1px solid rgba(51, 65, 85, 0.35);
  }
  .modal-header-main {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }
  .modal-header-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--c-border);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .modal-header-text {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-width: 0;
  }
  .modal-title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }
  .modal-subtitle {
    margin: 0;
    font-size: 11px;
    color: #64748b;
    line-height: 1.35;
  }
  .modal-close {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--c-border);
    cursor: pointer;
    transition: color 160ms ease, background 160ms ease;
    flex-shrink: 0;
  }
  .modal-close:hover { color: #e2e8f0; background: rgba(255,255,255,0.08); }
  .modal-body {
    padding: 16px 20px;
    overflow-x: hidden;
    overflow-y: auto;
    flex: 1;
    min-width: 0;
  }
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px 20px;
    border-top: 1px solid var(--c-border);
  }
```

with:

```css
  /* ── Modal ────────────────────────────────────────────────── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(15,23,42,0.4);
    backdrop-filter: blur(2px);
    animation: modal-fade-in 200ms ease-out;
  }
  @keyframes modal-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .modal-panel {
    width: 100%;
    background: #ffffff;
    border: 1px solid var(--c-border);
    border-radius: 14px;
    box-shadow: 0 24px 64px rgba(15,23,42,0.18);
    animation: modal-slide-up 240ms ease-out;
    max-height: calc(100vh - 32px);
    display: flex;
    flex-direction: column;
  }
  .modal-panel-sm { max-width: 400px; }
  .modal-panel-md { max-width: 520px; }
  .modal-panel-lg { max-width: 720px; }
  .modal-panel-xl { max-width: 1040px; }
  @keyframes modal-slide-up {
    from { opacity: 0; transform: translateY(12px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 20px 16px;
    border-bottom: 1px solid var(--c-border);
  }
  .modal-header-main {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }
  .modal-header-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: #f8fafc;
    border: 1px solid var(--c-border);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .modal-header-text {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-width: 0;
  }
  .modal-title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }
  .modal-subtitle {
    margin: 0;
    font-size: 11px;
    color: #64748b;
    line-height: 1.35;
  }
  .modal-close {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    background: #f8fafc;
    border: 1px solid var(--c-border);
    cursor: pointer;
    transition: color 160ms ease, background 160ms ease;
    flex-shrink: 0;
  }
  .modal-close:hover { color: #0f172a; background: #f1f5f9; }
  .modal-body {
    padding: 16px 20px;
    overflow-x: hidden;
    overflow-y: auto;
    flex: 1;
    min-width: 0;
  }
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px 20px;
    border-top: 1px solid var(--c-border);
  }
```

- [ ] **Step 2: Verify**

Run:

```bash
grep -n "rgba(7,13,26\|rgba(12,21,38,0.95)" apps/web/src/app/globals.css
```

Expected: no output (the remaining `rgba(7, 13, 26, ...)` occurrences elsewhere in the file, if any, belong to out-of-scope sections and are not part of this grep pattern's exact match — this pattern targets only the modal's old values).

- [ ] **Step 3: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): light-theme generic modal system"
```

---

### Task 5: Buttons

**Files:**
- Modify: `apps/web/src/app/globals.css` (`.btn-primary`, `.btn-ghost`)

- [ ] **Step 1: Restyle buttons**

Replace:

```css
  /* ── Buttons ──────────────────────────────────────────────── */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    border: 1px solid rgba(99,102,241,0.4);
    cursor: pointer;
    transition: background 180ms ease, transform 120ms ease, box-shadow 180ms ease;
    box-shadow: 0 2px 8px rgba(99,102,241,0.25);
  }
  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
    box-shadow: 0 4px 16px rgba(99,102,241,0.35);
  }
  .btn-primary:active:not(:disabled) { transform: scale(0.98); }
  .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

  .btn-ghost {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    color: #94a3b8;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    transition: color 160ms ease, background 160ms ease;
  }
  .btn-ghost:hover { color: #e2e8f0; background: rgba(255,255,255,0.04); }
```

with:

```css
  /* ── Buttons ──────────────────────────────────────────────── */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    border: 1px solid rgba(99,102,241,0.4);
    cursor: pointer;
    transition: background 180ms ease, transform 120ms ease, box-shadow 180ms ease;
    box-shadow: 0 2px 8px rgba(99,102,241,0.2);
  }
  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
    box-shadow: 0 4px 16px rgba(99,102,241,0.3);
  }
  .btn-primary:active:not(:disabled) { transform: scale(0.98); }
  .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

  .btn-ghost {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    color: #64748b;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    transition: color 160ms ease, background 160ms ease;
  }
  .btn-ghost:hover { color: #0f172a; background: rgba(15,23,42,0.04); }
```

- [ ] **Step 2: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): light-theme buttons"
```

---

### Task 6: Form primitives (input, select, time picker)

**Files:**
- Modify: `apps/web/src/app/globals.css` (`.form-field` through `.form-grid-2`)

**Interfaces:**
- Consumes: `var(--c-border)` from Task 1. No changes needed in `FormSelect.tsx`, `TimeInput.tsx`, `NumericInput.tsx`, `DecimalInput.tsx` — confirmed they contain zero hardcoded hex/rgba colors and rely entirely on these classes.

- [ ] **Step 1: Restyle form primitives**

Replace:

```css
  /* ── Form fields ──────────────────────────────────────────── */
  .form-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .form-label {
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    letter-spacing: 0.02em;
  }
  .form-label-hint { font-weight: 400; color: #475569; }
  .form-input {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 13px;
    color: #e2e8f0;
    background: rgba(17,30,50,0.8);
    border: 1px solid var(--c-border);
    outline: none;
    transition: border-color 160ms ease, box-shadow 160ms ease;
    resize: vertical;
  }
  .form-input:focus {
    border-color: rgba(99,102,241,0.5);
    box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
  }
  .form-input-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .form-error { font-size: 11px; color: #f87171; }

  /* ── Custom form select ───────────────────────────────────── */
  .form-select {
    position: relative;
    min-width: 0;
  }
  .form-select-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 13px;
    color: #e2e8f0;
    background: rgba(17, 30, 50, 0.8);
    border: 1px solid var(--c-border);
    cursor: pointer;
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }
  .form-select-trigger:hover:not(:disabled) {
    border-color: rgba(99, 102, 241, 0.35);
    background: rgba(20, 34, 56, 0.9);
  }
  .form-select--open .form-select-trigger,
  .form-select-trigger:focus-visible {
    border-color: rgba(99, 102, 241, 0.5);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
    outline: none;
  }
  .form-select-trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .form-select-value {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .form-select-placeholder { color: #64748b; }
  .form-select-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .form-select-chevron {
    width: 14px;
    height: 14px;
    color: #64748b;
    flex-shrink: 0;
    transition: transform 160ms ease, color 160ms ease;
  }
  .form-select--open .form-select-chevron {
    transform: rotate(180deg);
    color: #94a3b8;
  }
  .form-select-menu {
    position: absolute;
    z-index: 60;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 4px;
    list-style: none;
    border-radius: 10px;
    background: rgba(12, 21, 38, 0.98);
    border: 1px solid rgba(99, 102, 241, 0.2);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
    backdrop-filter: blur(12px);
    animation: form-select-in 140ms ease-out;
  }
  @keyframes form-select-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .form-select-option {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: #cbd5e1;
    font-size: 13px;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }
  .form-select-option:hover {
    background: rgba(99, 102, 241, 0.1);
    color: #f1f5f9;
  }
  .form-select-option--active {
    background: rgba(99, 102, 241, 0.14);
    color: #f8fafc;
  }
  .form-select-option-label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .form-select-check {
    width: 14px;
    height: 14px;
    color: #818cf8;
    flex-shrink: 0;
  }

  /* ── Custom time input ─────────────────────────────────────── */
  .form-time {
    position: relative;
    width: 96px;
    flex-shrink: 0;
  }
  .form-time-trigger {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px 10px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: #e2e8f0;
    background: rgba(17, 30, 50, 0.85);
    border: 1px solid var(--c-border);
    cursor: pointer;
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease, opacity 160ms ease;
  }
  .form-time-trigger:hover:not(:disabled) {
    border-color: rgba(6, 182, 212, 0.35);
    background: rgba(20, 34, 56, 0.95);
  }
  .form-time--open .form-time-trigger,
  .form-time-trigger:focus-visible {
    border-color: rgba(6, 182, 212, 0.5);
    box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.12);
    outline: none;
  }
  .form-time-trigger:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .form-time-icon {
    width: 13px;
    height: 13px;
    color: #22d3ee;
    flex-shrink: 0;
    opacity: 0.85;
  }
  .form-time-value { line-height: 1; }
  .form-time-menu-anchor {
    position: fixed;
    z-index: 9999;
  }
  .form-time-menu {
    min-width: 148px;
    padding: 8px;
    border-radius: 12px;
    background: rgba(10, 18, 34, 0.98);
    border: 1px solid rgba(6, 182, 212, 0.22);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
    backdrop-filter: blur(12px);
    animation: form-time-in 140ms ease-out;
  }
  @keyframes form-time-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .form-time-columns {
    display: flex;
    align-items: stretch;
    gap: 0;
  }
  .form-time-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 64px;
    max-height: 168px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(6, 182, 212, 0.25) transparent;
  }
  .form-time-col-label {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 2px 0 6px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: center;
    color: #64748b;
    background: rgba(10, 18, 34, 0.98);
  }
  .form-time-col-divider {
    width: 1px;
    margin: 0 6px;
    background: rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  }
  .form-time-option {
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }
  .form-time-option:hover {
    background: rgba(6, 182, 212, 0.1);
    color: #e2e8f0;
  }
  .form-time-option--active {
    background: rgba(6, 182, 212, 0.16);
    color: #67e8f9;
    box-shadow: inset 0 0 0 1px rgba(6, 182, 212, 0.28);
  }

  .form-hint { font-size: 10px; color: #475569; }
  .form-grid-2 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    min-width: 0;
  }
  @media (min-width: 480px) {
    .form-grid-2 { grid-template-columns: 1fr 1fr; }
  }
```

with:

```css
  /* ── Form fields ──────────────────────────────────────────── */
  .form-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .form-label {
    font-size: 11px;
    font-weight: 600;
    color: #475569;
    letter-spacing: 0.02em;
  }
  .form-label-hint { font-weight: 400; color: #94a3b8; }
  .form-input {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 13px;
    color: #0f172a;
    background: #ffffff;
    border: 1px solid var(--c-border);
    outline: none;
    transition: border-color 160ms ease, box-shadow 160ms ease;
    resize: vertical;
  }
  .form-input:focus {
    border-color: rgba(99,102,241,0.5);
    box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
  }
  .form-input-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .form-error { font-size: 11px; color: #dc2626; }

  /* ── Custom form select ───────────────────────────────────── */
  .form-select {
    position: relative;
    min-width: 0;
  }
  .form-select-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 13px;
    color: #0f172a;
    background: #ffffff;
    border: 1px solid var(--c-border);
    cursor: pointer;
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }
  .form-select-trigger:hover:not(:disabled) {
    border-color: rgba(99, 102, 241, 0.35);
    background: #f8fafc;
  }
  .form-select--open .form-select-trigger,
  .form-select-trigger:focus-visible {
    border-color: rgba(99, 102, 241, 0.5);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
    outline: none;
  }
  .form-select-trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .form-select-value {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .form-select-placeholder { color: #94a3b8; }
  .form-select-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .form-select-chevron {
    width: 14px;
    height: 14px;
    color: #64748b;
    flex-shrink: 0;
    transition: transform 160ms ease, color 160ms ease;
  }
  .form-select--open .form-select-chevron {
    transform: rotate(180deg);
    color: #475569;
  }
  .form-select-menu {
    position: absolute;
    z-index: 60;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 4px;
    list-style: none;
    border-radius: 10px;
    background: #ffffff;
    border: 1px solid var(--c-border);
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16);
    animation: form-select-in 140ms ease-out;
  }
  @keyframes form-select-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .form-select-option {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: #334155;
    font-size: 13px;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }
  .form-select-option:hover {
    background: rgba(99, 102, 241, 0.08);
    color: #0f172a;
  }
  .form-select-option--active {
    background: rgba(99, 102, 241, 0.12);
    color: #0f172a;
  }
  .form-select-option-label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .form-select-check {
    width: 14px;
    height: 14px;
    color: #6366f1;
    flex-shrink: 0;
  }

  /* ── Custom time input ─────────────────────────────────────── */
  .form-time {
    position: relative;
    width: 96px;
    flex-shrink: 0;
  }
  .form-time-trigger {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px 10px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: #0f172a;
    background: #ffffff;
    border: 1px solid var(--c-border);
    cursor: pointer;
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease, opacity 160ms ease;
  }
  .form-time-trigger:hover:not(:disabled) {
    border-color: rgba(6, 182, 212, 0.35);
    background: #f8fafc;
  }
  .form-time--open .form-time-trigger,
  .form-time-trigger:focus-visible {
    border-color: rgba(6, 182, 212, 0.5);
    box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.12);
    outline: none;
  }
  .form-time-trigger:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .form-time-icon {
    width: 13px;
    height: 13px;
    color: #0891b2;
    flex-shrink: 0;
    opacity: 0.85;
  }
  .form-time-value { line-height: 1; }
  .form-time-menu-anchor {
    position: fixed;
    z-index: 9999;
  }
  .form-time-menu {
    min-width: 148px;
    padding: 8px;
    border-radius: 12px;
    background: #ffffff;
    border: 1px solid rgba(6, 182, 212, 0.25);
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
    animation: form-time-in 140ms ease-out;
  }
  @keyframes form-time-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .form-time-columns {
    display: flex;
    align-items: stretch;
    gap: 0;
  }
  .form-time-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 64px;
    max-height: 168px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(6, 182, 212, 0.25) transparent;
  }
  .form-time-col-label {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 2px 0 6px;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: center;
    color: #64748b;
    background: #ffffff;
  }
  .form-time-col-divider {
    width: 1px;
    margin: 0 6px;
    background: var(--c-border);
    flex-shrink: 0;
  }
  .form-time-option {
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #475569;
    font-size: 12px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }
  .form-time-option:hover {
    background: rgba(6, 182, 212, 0.1);
    color: #0f172a;
  }
  .form-time-option--active {
    background: rgba(6, 182, 212, 0.14);
    color: #0e7490;
    box-shadow: inset 0 0 0 1px rgba(6, 182, 212, 0.28);
  }

  .form-hint { font-size: 10px; color: #94a3b8; }
  .form-grid-2 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    min-width: 0;
  }
  @media (min-width: 480px) {
    .form-grid-2 { grid-template-columns: 1fr 1fr; }
  }
```

- [ ] **Step 2: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): light-theme form primitives (input, select, time picker)"
```

---

### Task 7: Tags/badges

**Files:**
- Modify: `apps/web/src/app/globals.css` (`.tag-*`)

- [ ] **Step 1: Darken tag text colors for legibility on white**

Replace:

```css
  .tag-green  { color: #4ade80; background: rgba(34,197,94,0.12); }
  .tag-red    { color: #f87171; background: rgba(239,68,68,0.12); }
  .tag-slate  { color: var(--c-muted); background: rgba(100,116,139,0.10); }
  .tag-yellow { color: #fbbf24; background: rgba(251,191,36,0.10); }
  .tag-amber  { color: #fbbf24; background: rgba(251,191,36,0.12); }
  .tag-purple { color: #a78bfa; background: rgba(167,139,250,0.12); }
```

with:

```css
  .tag-green  { color: #15803d; background: rgba(34,197,94,0.12); }
  .tag-red    { color: #b91c1c; background: rgba(239,68,68,0.12); }
  .tag-slate  { color: var(--c-muted); background: rgba(100,116,139,0.10); }
  .tag-yellow { color: #a16207; background: rgba(251,191,36,0.14); }
  .tag-amber  { color: #a16207; background: rgba(251,191,36,0.16); }
  .tag-purple { color: #6d28d9; background: rgba(167,139,250,0.14); }
```

- [ ] **Step 2: Build check**

Run: `pnpm --filter @whatsagent/web build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(web): light-theme tag/badge colors"
```

---

### Task 8: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full lint + build**

Run:

```bash
pnpm --filter @whatsagent/web lint
pnpm --filter @whatsagent/web build
```

Expected: both succeed with no new errors.

- [ ] **Step 2: Grep sweep for any remaining shell-scope dark literals**

Run:

```bash
grep -n "#070d1a\|#020617\|#0c1526\|#111827\|#1a2d47" apps/web/src/app/globals.css | grep -v "lp-\|onboarding\|rules-hero\|publish-modal\|catalog\|product-\|import-\|filter-panel"
```

Expected: no output, or only matches inside sections explicitly marked out-of-scope (landing page, agent rules hero, catalog/product/import/filter — verify any hit belongs to one of those before treating it as a failure).

- [ ] **Step 3: Manual visual QA in the browser**

Run: `pnpm --filter @whatsagent/web dev`

Log in and check:
1. Sidebar is white with a `slate-200` right border, nav items readable in slate/indigo, active item has a light indigo tint + green left bar.
2. Topbar is white, title text is dark, search/notification icon buttons are visible against white.
3. Open the user-menu dropdown (top-right avatar) — panel is white with visible shadow, text legible.
4. Open any modal that uses the shared `Modal` component (e.g. a settings or CRM modal) — panel is white, header/footer dividers visible, close button legible.
5. Open a form with a `FormSelect` or `TimeInput` (e.g. Settings or Agent Rules pages) — dropdown menus are white, options legible, focus ring shows indigo.
6. Confirm the page loads with the `Outfit` font (check DevTools → computed `font-family` on `body`, or visually compare letterforms to PrevConsulta).
7. Confirm the public landing page (`/`) and `/login` are unaffected — still dark.

Fix anything visually broken by re-checking the relevant task's diff before proceeding; do not silently patch with new ad-hoc colors outside the token palette established in Task 1.

- [ ] **Step 4: Final commit (only if Step 3 required fixes)**

```bash
git add -A
git commit -m "fix(web): address visual QA findings from light-theme phase 1"
```
