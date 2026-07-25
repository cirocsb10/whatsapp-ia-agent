# Next.js 15 + React 19 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `apps/web` from Next.js 14.2.35/React 18.3 to Next.js 15/React 19 with zero behavior regressions, in two isolated, revertible commits.

**Architecture:** Two sequential tasks against a single package (`apps/web`). Task 1 bumps dependencies and fixes the two known breaking changes (async route params, renamed config key). Task 2 verifies the Turbopack+Sentry incompatibility warning is gone and there's no leftover version-specific cruft. No other service in the monorepo is touched.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.6, Jest, Playwright, pnpm workspaces.

## Global Constraints

- Scope is strictly `apps/web` — do not touch `apps/api`, `apps/channel-service`, `apps/ai-orchestrator`, or `packages/*`.
- No behavior change to `fetch()` caching intent anywhere — the spec found no call site relying on the Next 14 default cache, so don't add explicit `cache:` options defensively; let the new `no-store` default apply.
- Each task is its own commit, revertible in isolation via `git revert`.
- Validate with local commands only (`pnpm --filter @whatsagent/web build/lint/test/test:e2e`) — do not start docker/other services, per design spec (`docs/superpowers/specs/2026-07-24-nextjs-15-migration-design.md`).
- Do not use `--turbo` compatibility as a blocker: it's already enabled in `apps/web/package.json:6` (`"dev": "next dev --port 3000 --turbo"`); this migration just removes the version-mismatch warning, it isn't introducing Turbopack.

---

### Task 1: Bump dependencies, fix async route params, fix next.config.mjs

**Files:**
- Modify: `apps/web/package.json:34,37-38,57-58,60` (dependency versions)
- Modify: `apps/web/next.config.mjs:15-19` (config key rename)
- Modify: `apps/web/src/app/api/proxy/[...path]/route.ts:10,30-34,63,85-98` (async params)
- Test: existing suites under `apps/web/src/**/*.test.ts(x)` and `apps/web/tests/e2e/**` (no new test files — this task is a version bump, verified by the existing suite plus a manual build/lint pass)

**Interfaces:**
- Consumes: nothing from prior tasks (first task in this plan).
- Produces: `apps/web` running on Next 15/React 19, with `proxyRequest(req: NextRequest, params: { path: string[] }, accessToken: string, retried?: boolean)` unchanged in signature (still receives the *resolved* `{ path: string[] }` object — only the route handler's `context.params` becomes a `Promise` upstream of it). Task 2 depends on the app building and running cleanly under Next 15 with `--turbo`.

- [ ] **Step 1: Bump `next`, `react`, `react-dom` in `apps/web/package.json`**

Edit `apps/web/package.json`:

```json
    "next": "^15.0.0",
```
(line 34, was `"next": "^14.2.0"`)

```json
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
```
(lines 37-38, was `"react": "^18.3.0"`, `"react-dom": "^18.3.0"`)

- [ ] **Step 2: Bump `@types/react`, `@types/react-dom`, `eslint-config-next` in `apps/web/package.json` devDependencies**

```json
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
```
(lines 57-58, was `^18.3.0` each)

```json
    "eslint-config-next": "15.0.0",
```
(line 60, was `"eslint-config-next": "14.2.0"` — keep it pinned without `^` to match the existing convention of pinning this specific package)

- [ ] **Step 3: Install to regenerate the lockfile**

Run: `pnpm install`
Expected: resolves cleanly, `pnpm-lock.yaml` updates. If any peer dependency warning appears for a package not already covered in the design spec's risk table, stop and report it before continuing — it means the read-only research missed something.

- [ ] **Step 4: Fix `next.config.mjs` — rename `serverComponentsExternalPackages`**

In `apps/web/next.config.mjs`, replace:

```js
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [],
    // Tree-shake lucide/recharts no bundle (F5 §3.9).
    optimizePackageImports: ["lucide-react", "recharts"],
  },
```

with:

```js
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [],
  experimental: {
    // Tree-shake lucide/recharts no bundle (F5 §3.9).
    optimizePackageImports: ["lucide-react", "recharts"],
  },
```

- [ ] **Step 5: Fix `app/api/proxy/[...path]/route.ts` — async `params`**

In `apps/web/src/app/api/proxy/[...path]/route.ts`, replace:

```ts
type RouteContext = { params: { path: string[] } };
```

with:

```ts
type RouteContext = { params: Promise<{ path: string[] }> };
```

Replace the `handle` function (currently lines 85-92):

```ts
async function handle(req: NextRequest, context: RouteContext) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }
  return proxyRequest(req, context.params, token);
}
```

with:

```ts
async function handle(req: NextRequest, context: RouteContext) {
  const params = await context.params;
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }
  return proxyRequest(req, params, token);
}
```

Leave `proxyRequest`'s signature (line 28-34) and the retry call at line 63 (`proxyRequest(req, params, refreshed.accessToken, true)`) untouched — they already take the resolved `{ path: string[] }` object, not the promise, so no change needed there. The exported `GET`/`POST`/`PATCH`/`PUT`/`DELETE` (lines 94-98) also stay unchanged — they just forward `context` to `handle`, which now does the `await`.

- [ ] **Step 6: Build to catch any remaining type errors**

Run: `pnpm --filter @whatsagent/web build`
Expected: PASS. If TypeScript flags other `params`/`searchParams` usages not caught by the design spec's grep, fix them the same way (wrap the type in `Promise<...>`, `await` before use) and re-run.

- [ ] **Step 7: Lint**

Run: `pnpm --filter @whatsagent/web lint`
Expected: PASS with no new errors. `eslint-config-next` version bump may surface new rule violations — fix any that appear (do not disable rules to silence them).

- [ ] **Step 8: Unit/component tests**

Run: `pnpm --filter @whatsagent/web test`
Expected: PASS, same test count as before the bump. `@testing-library/react@16.x` and `jest-environment-jsdom@30.x` already declare React 19 support per the design spec's dependency table, so no config change is expected here.

- [ ] **Step 9: Playwright smoke**

Run: `pnpm --filter @whatsagent/web test:e2e`
Expected: PASS. This spins up `next dev` itself per `playwright.config.ts`; a failure here would indicate a routing/middleware regression from the Next 15 upgrade specifically (login page, protected-route redirect, landing page).

- [ ] **Step 10: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/next.config.mjs "apps/web/src/app/api/proxy/[...path]/route.ts"
git commit -m "chore(web): upgrade to Next.js 15 and React 19"
```

---

### Task 2: Confirm Turbopack/Sentry compatibility and clean up residual version references

**Files:**
- Modify: none expected (verification task) — if the Sentry warning persists or any stray Next-14-specific comment/config is found, fix inline in the same files touched by Task 1.
- Test: manual dev-server run (see Step 1 below); no automated test added.

**Interfaces:**
- Consumes: the Next 15/React 19 environment produced by Task 1 (must run Task 1 first).
- Produces: a confirmed-clean dev environment; nothing downstream depends on this task.

- [ ] **Step 1: Start the dev server and check for the Sentry/Turbopack warning**

Run: `pnpm --filter @whatsagent/web dev` (background it or run with a short timeout — it's a long-running dev server, not a one-shot command)
Expected: Next.js banner shows `▲ Next.js 15.x.x (turbo)` with **no** `[@sentry/nextjs] WARNING: ... compatible with Turbopack on Next.js version 15.4.1 or later` line. If the warning is still present, check that `next` resolved to `>=15.4.1` (run `pnpm --filter @whatsagent/web ls next` to confirm the installed version); if it resolved lower, bump the `next` version range in `apps/web/package.json` from Task 1 Step 1 to `^15.4.1` and re-run `pnpm install`.

Stop the dev server once confirmed (it's just a manual check, not something to leave running).

- [ ] **Step 2: Grep for leftover Next-14-specific references**

Run: `grep -rn "serverComponentsExternalPackages\|instrumentationHook" apps/web/next.config.mjs apps/web/src`
Expected: no matches. `serverComponentsExternalPackages` should no longer appear anywhere (Task 1 renamed it); `instrumentationHook` was already confirmed absent by the design-spec research, this is a final sanity check.

- [ ] **Step 3: Full verification sweep**

Run in sequence:
```bash
pnpm --filter @whatsagent/web build
pnpm --filter @whatsagent/web lint
pnpm --filter @whatsagent/web test
pnpm --filter @whatsagent/web test:e2e
```
Expected: all PASS (same as Task 1 Steps 6-9 — this is a final confirmation after Step 1's manual dev-server check, in case that step required a version bump).

- [ ] **Step 4: Commit (only if Step 1 required a version-range change; otherwise skip — nothing to commit)**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "chore(web): pin next to >=15.4.1 for Turbopack/Sentry compatibility"
```

If Step 1 found no warning and no version bump was needed, this task ends with no commit — Task 1's commit already fully delivers the migration.

---

## Rollback

Each task's commit is independently revertible: `git revert <sha>` for Task 1's commit undoes the entire dependency bump and code fixes; Task 2's commit (if it exists) is a no-op to revert since it's just a version-range tightening.
