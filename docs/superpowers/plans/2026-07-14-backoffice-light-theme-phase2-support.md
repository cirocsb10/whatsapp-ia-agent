# Backoffice Light Theme — Phase 2.4 Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retheme the Support page and its entire `.support-*` CSS block from dark to light, completing Phase 2.4 of the backoffice light-theme migration.

**Architecture:** Value-only color swaps in existing CSS rules and Tailwind classes — no structural changes, no new classes, no refactor into `.form-*` primitives. Every change is confirmed against the design spec at `docs/superpowers/specs/2026-07-14-backoffice-light-theme-phase2-support-design.md`.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS v4, hand-written CSS in `apps/web/src/app/globals.css`.

## Global Constraints

- Value-only swaps only — never refactor inline styles or CSS rules into new classes or restructure selectors.
- Established color mappings (copy exactly):
  - Green accent/success text: `#4ade80`/`#86efac` → `#15803d`
  - Indigo accent text: `#818cf8`/`#a5b4fc` → `#4f46e5`
  - Amber/warning text: `#fbbf24`/`#f59e0b` → `#a16207`; Tailwind `text-amber-400` → `text-amber-700`
  - Muted body text: `#94a3b8` → `#64748b`
  - Near-white heading/value text: `#e2e8f0`/`#f1f5f9`/`#cbd5e1` → `#0f172a`
  - Dark surfaces: `rgba(0,0,0,X)`/`rgba(12,21,38,X)` → light equivalents (white or light rgba tint per context)
  - Dark borders: `rgba(26,45,71,X)` → `var(--c-border)`-equivalent
  - Dark-theme hover overlays (`rgba(255,255,255,X)` lighten-on-dark) → `rgba(15,23,42,X)` darken-on-light equivalent
  - Tailwind `text-green-400` → `text-green-600`
- Decision: dark text (`#052e16`) on solid bright-green buttons (`.support-alert-cta`, `.support-attend-btn`) stays **unchanged** — matches the accepted `.filter-badge` "dark text on solid color chip" precedent from Catalog.
- Decision: `.support-conv-accent`'s inline `style={{ background: isUrgent ? "#f59e0b" : accent }}` (page.tsx) stays **unchanged** — a saturated accent-bar color, not body text, matches the precedent of leaving per-item accent-palette values alone.
- Verify with `pnpm --filter @whatsagent/web build` and `pnpm --filter @whatsagent/web lint` after each task. If `pnpm` isn't on PATH or the build fails with a Node-version error, prefix with `export PATH="/c/Users/Login/AppData/Roaming/nvm/v20.11.1:$PATH"` and use `corepack pnpm ...` instead. If the build fails with a `.tsbuildinfo` path-separator "Debug Failure" (a stale-cache issue, unrelated to any of these changes), run `rm -rf apps/web/.next/cache` once and retry.

---

### Task 1: Hero, live pill, and refresh button CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:3765,3773,3799,3803,3832,3838`

**Interfaces:**
- Consumes: none (pure CSS value edit).
- Produces: light-themed `.support-hero-badge`, `.support-hero-title`, `.support-live-pill`, `.support-live-pill--on`, `.support-refresh-btn` rules consumed by `support/page.tsx` (already using these classes, no TSX change needed for this task).

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:3755-3845, full block for context — only the marked lines change):
```css
  .support-hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 99px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #a5b4fc;
    background: rgba(99,102,241,0.12);
    border: 1px solid rgba(99,102,241,0.2);
    margin-bottom: 10px;
  }
  .support-hero-title {
    font-size: 20px;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.025em;
    line-height: 1.2;
  }
  .support-hero-sub {
    font-size: 13px;
    color: #64748b;
    margin-top: 6px;
    line-height: 1.5;
    max-width: 520px;
  }
  .support-hero-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .support-live-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 99px;
    font-size: 11px;
    font-weight: 500;
    color: #64748b;
    background: rgba(0,0,0,0.2);
    border: 1px solid var(--c-border);
    backdrop-filter: blur(8px);
  }
  .support-live-pill--on { color: #86efac; }
  .support-live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #64748b;
    flex-shrink: 0;
    position: relative;
  }
  .support-live-pill--on .support-live-dot {
    background: #22c55e;
    box-shadow: 0 0 8px rgba(34,197,94,0.5);
  }
  .support-live-pill--on .support-live-dot::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: rgba(34,197,94,0.35);
    animation: pulse-dot 2.4s ease-in-out infinite;
  }
  .support-refresh-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    background: rgba(0,0,0,0.2);
    border: 1px solid var(--c-border);
    cursor: pointer;
    transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
  }
  .support-refresh-btn:hover {
    color: #e2e8f0;
    border-color: var(--c-s3);
    background: var(--c-s2);
  }
  .support-refresh-btn:focus-visible {
    outline: 2px solid var(--c-indigo);
    outline-offset: 2px;
  }
```

After:
```css
  .support-hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 99px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #4f46e5;
    background: rgba(99,102,241,0.12);
    border: 1px solid rgba(99,102,241,0.2);
    margin-bottom: 10px;
  }
  .support-hero-title {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.025em;
    line-height: 1.2;
  }
  .support-hero-sub {
    font-size: 13px;
    color: #64748b;
    margin-top: 6px;
    line-height: 1.5;
    max-width: 520px;
  }
  .support-hero-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .support-live-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 99px;
    font-size: 11px;
    font-weight: 500;
    color: #64748b;
    background: rgba(15,23,42,0.04);
    border: 1px solid var(--c-border);
    backdrop-filter: blur(8px);
  }
  .support-live-pill--on { color: #15803d; }
  .support-live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #64748b;
    flex-shrink: 0;
    position: relative;
  }
  .support-live-pill--on .support-live-dot {
    background: #22c55e;
    box-shadow: 0 0 8px rgba(34,197,94,0.5);
  }
  .support-live-pill--on .support-live-dot::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: rgba(34,197,94,0.35);
    animation: pulse-dot 2.4s ease-in-out infinite;
  }
  .support-refresh-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    background: rgba(15,23,42,0.04);
    border: 1px solid var(--c-border);
    cursor: pointer;
    transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
  }
  .support-refresh-btn:hover {
    color: #0f172a;
    border-color: var(--c-s3);
    background: var(--c-s2);
  }
  .support-refresh-btn:focus-visible {
    outline: 2px solid var(--c-indigo);
    outline-offset: 2px;
  }
```

- [ ] **Step 2: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme support hero, live pill, and refresh button for light theme"
```

---

### Task 2: Alert banner CSS + amber icons in page.tsx

**Files:**
- Modify: `apps/web/src/app/globals.css:3881-3886`
- Modify: `apps/web/src/app/(dashboard)/support/page.tsx:155-156`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.support-alert-title`; corrected amber icon classes.

- [ ] **Step 1: Apply the CSS edit**

Before (globals.css:3881-3886):
```css
  .support-alert-title {
    font-size: 13px;
    font-weight: 600;
    color: #f1f5f9;
    line-height: 1.3;
  }
```

After:
```css
  .support-alert-title {
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
    line-height: 1.3;
  }
```

- [ ] **Step 2: Apply the page.tsx edit**

Before (page.tsx:150-158):
```tsx
        {pendingHandoffs.length > 0 && (
          <div className={`support-alert ${hasUrgent ? "support-alert--urgent" : ""}`}>
            <div className="support-alert-icon">
              {hasUrgent
                ? <Zap className="w-4 h-4 text-amber-400" strokeWidth={2} />
                : <AlertCircle className="w-4 h-4 text-amber-400" strokeWidth={2} />
              }
            </div>
```

After:
```tsx
        {pendingHandoffs.length > 0 && (
          <div className={`support-alert ${hasUrgent ? "support-alert--urgent" : ""}`}>
            <div className="support-alert-icon">
              {hasUrgent
                ? <Zap className="w-4 h-4 text-amber-700" strokeWidth={2} />
                : <AlertCircle className="w-4 h-4 text-amber-700" strokeWidth={2} />
              }
            </div>
```

- [ ] **Step 3: Confirm no change needed for `.support-alert-cta`**

`.support-alert-cta` color `#052e16` (globals.css:3901) stays unchanged — dark text on the solid `var(--c-green)` button background, matching the accepted "dark text on solid color chip" precedent. Do not edit it.

- [ ] **Step 4: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css "apps/web/src/app/(dashboard)/support/page.tsx"
git commit -m "fix(web): retheme support alert banner for light theme"
```

---

### Task 3: Queue panel shell CSS + amber icon in page.tsx

**Files:**
- Modify: `apps/web/src/app/globals.css:4001-4044`
- Modify: `apps/web/src/app/(dashboard)/support/page.tsx:213`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.support-panel`, `.support-panel-header`, `.support-panel-title-text` rules; corrected `LifeBuoy` icon class.

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:4001-4044):
```css
  .support-panel {
    background: rgba(12,21,38,0.7);
    backdrop-filter: blur(16px);
    border: 1px solid var(--c-border);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  }
  .support-panel-header {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px 18px;
    border-bottom: 1px solid rgba(26,45,71,0.8);
    background: linear-gradient(180deg, rgba(245,158,11,0.05) 0%, transparent 100%);
  }
  @media (min-width: 768px) {
    .support-panel-header {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }
  .support-panel-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .support-panel-title-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: rgba(245,158,11,0.1);
    border: 1px solid rgba(245,158,11,0.2);
  }
  .support-panel-title-text {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
    letter-spacing: -0.01em;
  }
  .support-panel-title-meta {
    display: block;
    font-size: 11px;
    color: #64748b;
    margin-top: 2px;
  }
```

After:
```css
  .support-panel {
    background: #ffffff;
    backdrop-filter: blur(16px);
    border: 1px solid var(--c-border);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(15,23,42,0.08);
  }
  .support-panel-header {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px 18px;
    border-bottom: 1px solid var(--c-border);
    background: linear-gradient(180deg, rgba(245,158,11,0.05) 0%, transparent 100%);
  }
  @media (min-width: 768px) {
    .support-panel-header {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }
  .support-panel-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .support-panel-title-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: rgba(245,158,11,0.1);
    border: 1px solid rgba(245,158,11,0.2);
  }
  .support-panel-title-text {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
    letter-spacing: -0.01em;
  }
  .support-panel-title-meta {
    display: block;
    font-size: 11px;
    color: #64748b;
    margin-top: 2px;
  }
```

- [ ] **Step 2: Apply the page.tsx edit**

Before (page.tsx:211-214):
```tsx
            <div className="support-panel-title">
              <div className="support-panel-title-icon">
                <LifeBuoy className="w-4 h-4 text-amber-400" strokeWidth={1.8} />
              </div>
```

After:
```tsx
            <div className="support-panel-title">
              <div className="support-panel-title-icon">
                <LifeBuoy className="w-4 h-4 text-amber-700" strokeWidth={1.8} />
              </div>
```

- [ ] **Step 3: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css "apps/web/src/app/(dashboard)/support/page.tsx"
git commit -m "fix(web): retheme support queue panel shell for light theme"
```

---

### Task 4: Search + tabs CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:4083-4152`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.support-search-input`, `.support-tabs`, `.support-tab*` rules.

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:4083-4152):
```css
  .support-search-input {
    width: 100%;
    padding: 7px 12px 7px 32px;
    border-radius: 8px;
    font-size: 12px;
    color: #e2e8f0;
    background: rgba(0,0,0,0.25);
    border: 1px solid var(--c-border);
    outline: none;
    transition: border-color 160ms ease, background 160ms ease;
  }
  .support-search-input::placeholder { color: #475569; }
  .support-search-input:hover { border-color: var(--c-s3); }
  .support-search-input:focus {
    border-color: rgba(99,102,241,0.45);
    background: rgba(0,0,0,0.35);
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
  }

  .support-tabs {
    display: flex;
    gap: 4px;
    padding: 3px;
    border-radius: 10px;
    background: rgba(0,0,0,0.25);
    border: 1px solid var(--c-border);
  }
  .support-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 7px;
    font-size: 11px;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    transition: color 160ms ease, background 160ms ease, box-shadow 160ms ease;
    background: transparent;
    border: none;
    white-space: nowrap;
  }
  .support-tab:hover { color: #cbd5e1; background: rgba(255,255,255,0.04); }
  .support-tab:focus-visible {
    outline: 2px solid var(--c-indigo);
    outline-offset: 1px;
  }
  .support-tab-active {
    color: #f1f5f9;
    background: var(--c-s2);
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  }
  .support-tab-count {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 99px;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255,255,255,0.06);
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
  }
  .support-tab-count-active {
    background: rgba(245,158,11,0.2);
    color: #fbbf24;
  }
```

After:
```css
  .support-search-input {
    width: 100%;
    padding: 7px 12px 7px 32px;
    border-radius: 8px;
    font-size: 12px;
    color: #0f172a;
    background: rgba(15,23,42,0.04);
    border: 1px solid var(--c-border);
    outline: none;
    transition: border-color 160ms ease, background 160ms ease;
  }
  .support-search-input::placeholder { color: #475569; }
  .support-search-input:hover { border-color: var(--c-s3); }
  .support-search-input:focus {
    border-color: rgba(99,102,241,0.45);
    background: rgba(15,23,42,0.06);
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
  }

  .support-tabs {
    display: flex;
    gap: 4px;
    padding: 3px;
    border-radius: 10px;
    background: rgba(15,23,42,0.04);
    border: 1px solid var(--c-border);
  }
  .support-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 7px;
    font-size: 11px;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    transition: color 160ms ease, background 160ms ease, box-shadow 160ms ease;
    background: transparent;
    border: none;
    white-space: nowrap;
  }
  .support-tab:hover { color: #0f172a; background: rgba(15,23,42,0.04); }
  .support-tab:focus-visible {
    outline: 2px solid var(--c-indigo);
    outline-offset: 1px;
  }
  .support-tab-active {
    color: #0f172a;
    background: var(--c-s2);
    box-shadow: 0 1px 4px rgba(15,23,42,0.12);
  }
  .support-tab-count {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 99px;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15,23,42,0.06);
    color: #64748b;
    font-variant-numeric: tabular-nums;
  }
  .support-tab-count-active {
    background: rgba(245,158,11,0.2);
    color: #a16207;
  }
```

- [ ] **Step 2: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme support search and tabs CSS for light theme"
```

---

### Task 5: Empty state CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:4173-4212`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.support-empty-icon`, `.support-empty-title`, `.support-empty-link` rules.

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:4173-4212):
```css
  .support-empty-icon {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: var(--c-s2);
    border: 1px solid var(--c-border);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  }
  .support-empty-title {
    font-size: 15px;
    font-weight: 600;
    color: #e2e8f0;
    position: relative;
  }
  .support-empty-desc {
    font-size: 12px;
    color: #64748b;
    line-height: 1.6;
    max-width: 340px;
    text-align: center;
    position: relative;
  }
  .support-empty-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 12px;
    font-weight: 500;
    color: #818cf8;
    text-decoration: none;
    cursor: pointer;
    transition: color 160ms ease;
    position: relative;
  }
  .support-empty-link:hover { color: #a5b4fc; }
```

After:
```css
  .support-empty-icon {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: var(--c-s2);
    border: 1px solid var(--c-border);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(15,23,42,0.1);
  }
  .support-empty-title {
    font-size: 15px;
    font-weight: 600;
    color: #0f172a;
    position: relative;
  }
  .support-empty-desc {
    font-size: 12px;
    color: #64748b;
    line-height: 1.6;
    max-width: 340px;
    text-align: center;
    position: relative;
  }
  .support-empty-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 12px;
    font-weight: 500;
    color: #4f46e5;
    text-decoration: none;
    cursor: pointer;
    transition: color 160ms ease;
    position: relative;
  }
  .support-empty-link:hover { color: #4f46e5; }
```

- [ ] **Step 2: Confirm no change needed in page.tsx**

`text-slate-500` at page.tsx:274, 276, 277 (`PhoneCall`/`CheckCircle2`/`MessageSquare` icons) is already the correct muted value on light — do not edit.

- [ ] **Step 3: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme support empty state CSS for light theme"
```

---

### Task 6: Skeleton + conversation rows CSS

**Files:**
- Modify: `apps/web/src/app/globals.css:4220-4225,4241-4243,4257-4258,4263-4265,4270-4273,4277-4279,4315-4320,4321-4334,4356-4361`

**Interfaces:**
- Consumes: none.
- Produces: light-themed `.support-skeleton-row`, `.support-conv-row*`, `.support-conv-name`, `.support-urgency-tag`, `.support-conv-aside--action` rules.

- [ ] **Step 1: Apply the CSS edits**

Before (globals.css:4220-4225):
```css
  .support-skeleton-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    border-bottom: 1px solid rgba(26,45,71,0.5);
  }
```

After:
```css
  .support-skeleton-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    border-bottom: 1px solid var(--c-border);
  }
```

Before (globals.css:4233-4243):
```css
  .support-conv-row {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto;
    align-items: center;
    gap: 14px;
    padding: 14px 18px 14px 22px;
    border-bottom: 1px solid rgba(26,45,71,0.55);
    transition: background 180ms ease;
  }
```

After:
```css
  .support-conv-row {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto;
    align-items: center;
    gap: 14px;
    padding: 14px 18px 14px 22px;
    border-bottom: 1px solid var(--c-border);
    transition: background 180ms ease;
  }
```

Before (globals.css:4257-4279):
```css
  .support-conv-row:last-child { border-bottom: none; }
  .support-conv-row:hover { background: rgba(255,255,255,0.025); }
  .support-conv-row--clickable {
    cursor: pointer;
    transition: background 180ms ease, border-color 180ms ease;
  }
  .support-conv-row--clickable:hover {
    background: rgba(99,102,241,0.04);
  }
  .support-conv-row--clickable:focus-visible {
    outline: 2px solid rgba(99,102,241,0.45);
    outline-offset: -2px;
  }
  .support-conv-row--clickable:hover .support-conv-chevron {
    color: #a5b4fc;
    transform: translateX(2px);
  }
  .support-conv-row--urgent {
    background: linear-gradient(90deg, rgba(245,158,11,0.04) 0%, transparent 40%);
  }
  .support-conv-row--urgent:hover {
    background: linear-gradient(90deg, rgba(245,158,11,0.07) 0%, rgba(255,255,255,0.02) 40%);
  }
```

After:
```css
  .support-conv-row:last-child { border-bottom: none; }
  .support-conv-row:hover { background: rgba(15,23,42,0.025); }
  .support-conv-row--clickable {
    cursor: pointer;
    transition: background 180ms ease, border-color 180ms ease;
  }
  .support-conv-row--clickable:hover {
    background: rgba(99,102,241,0.04);
  }
  .support-conv-row--clickable:focus-visible {
    outline: 2px solid rgba(99,102,241,0.45);
    outline-offset: -2px;
  }
  .support-conv-row--clickable:hover .support-conv-chevron {
    color: #4f46e5;
    transform: translateX(2px);
  }
  .support-conv-row--urgent {
    background: linear-gradient(90deg, rgba(245,158,11,0.04) 0%, transparent 40%);
  }
  .support-conv-row--urgent:hover {
    background: linear-gradient(90deg, rgba(245,158,11,0.07) 0%, rgba(15,23,42,0.02) 40%);
  }
```

Before (globals.css:4315-4334):
```css
  .support-conv-name {
    font-size: 13px;
    font-weight: 600;
    color: #f1f5f9;
    letter-spacing: -0.01em;
  }
  .support-urgency-tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    border-radius: 99px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #fbbf24;
    background: rgba(245,158,11,0.12);
    border: 1px solid rgba(245,158,11,0.25);
  }
```

After:
```css
  .support-conv-name {
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
    letter-spacing: -0.01em;
  }
  .support-urgency-tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    border-radius: 99px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #a16207;
    background: rgba(245,158,11,0.12);
    border: 1px solid rgba(245,158,11,0.25);
  }
```

Before (globals.css:4356-4361):
```css
  @media (min-width: 641px) {
    .support-conv-aside--action {
      border-left: 1px solid rgba(26,45,71,0.65);
      padding-left: 16px;
      margin-left: 4px;
    }
  }
```

After:
```css
  @media (min-width: 641px) {
    .support-conv-aside--action {
      border-left: 1px solid var(--c-border);
      padding-left: 16px;
      margin-left: 4px;
    }
  }
```

- [ ] **Step 2: Confirm no change needed in page.tsx**

`style={{ background: isUrgent ? "#f59e0b" : accent }}` on `.support-conv-accent` (page.tsx:328) stays unchanged — `accent` is a per-conversation hash-based accent color, and `#f59e0b` is a saturated accent-bar color, not body text. Do not edit it.

- [ ] **Step 3: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix(web): retheme support skeleton and conversation row CSS for light theme"
```

---

### Task 7: Info card green icon in page.tsx

**Files:**
- Modify: `apps/web/src/app/(dashboard)/support/page.tsx:417`

**Interfaces:**
- Consumes: `.support-info-card*` CSS (already light from the Orders shared-prep, no change here).
- Produces: no new interfaces.

- [ ] **Step 1: Apply the edit**

Before (page.tsx:412-419):
```tsx
          <div className="support-info-card">
            <div className="support-info-card-glow support-info-card-glow--green" aria-hidden="true" />
            <div className="support-info-card-header">
              <div className="support-info-step">2</div>
              <div className="support-info-icon" style={{ background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.25)" }}>
                <User className="w-4 h-4 text-green-400" strokeWidth={1.8} />
              </div>
              <span className="support-info-title">Retomada pela IA</span>
```

After:
```tsx
          <div className="support-info-card">
            <div className="support-info-card-glow support-info-card-glow--green" aria-hidden="true" />
            <div className="support-info-card-header">
              <div className="support-info-step">2</div>
              <div className="support-info-icon" style={{ background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.25)" }}>
                <User className="w-4 h-4 text-green-600" strokeWidth={1.8} />
              </div>
              <span className="support-info-title">Retomada pela IA</span>
```

- [ ] **Step 2: Build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed with no new errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(dashboard)/support/page.tsx"
git commit -m "fix(web): retheme support info card icon for light theme"
```

---

### Task 8: Verification sweep

**Files:** none modified — read-only verification task.

- [ ] **Step 1: Grep for remaining dark literals in the Support scope**

Run:
```bash
grep -n "rgba(0,0,0\|rgba(12,21,38\|rgba(26,45,71\|#e2e8f0\|#f1f5f9\|#cbd5e1\|#a5b4fc\|#818cf8\|#86efac\|#fbbf24\|text-amber-400\|text-green-400\|text-indigo-400" apps/web/src/app/globals.css | awk -F: '$1 >= 3734 && $1 <= 4489'
```
Expected: no matches within the `.support-*` block (3734-4489). Matches outside this range (other still-dark pages) are expected and fine.

Run:
```bash
grep -n "text-amber-400\|text-green-400\|text-indigo-400\|#e2e8f0\|#f1f5f9" "apps/web/src/app/(dashboard)/support/page.tsx"
```
Expected: no matches.

- [ ] **Step 2: Full build and lint**

Run: `pnpm --filter @whatsagent/web build`
Run: `pnpm --filter @whatsagent/web lint`
Expected: both succeed cleanly.

- [ ] **Step 3: Update the progress ledger**

Append to `.superpowers/sdd/progress.md`:
```
Phase 2.4 (Support): Tasks 1-7 complete, verification sweep clean (grep + build + lint).
```

- [ ] **Step 4: No commit for this task**

This is a verification-only task; nothing to commit unless Step 1 finds a gap, in which case fix it under the relevant earlier task's commit message pattern before re-running Steps 1-2.
