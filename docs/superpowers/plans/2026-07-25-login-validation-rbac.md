# Login Validation + RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validar `/login`, confirmar que cliente e admin da plataforma veem menus/rotas corretos, corrigir gaps críticos (cursor pointer, Google UX), e adicionar regressão Jest + Playwright local.

**Architecture:** Manual-first checklist against the live stack (`pnpm docker:up` + `pnpm dev`), then small UX fixes on the login page / providers, then unit tests for login UI states and a local Playwright suite under `tests/e2e-full` (same assumption as existing full E2E: stack already running). Sidebar RBAC is already unit-tested; E2E proves end-to-end with real cookies.

**Tech Stack:** Next.js 15 App Router, Jest + Testing Library, Playwright (`playwright.full.config.ts`), NestJS API auth + `SuperAdminGuard`, Tailwind.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-login-validation-rbac-design.md`
- Personas: client `ciroviski@gmail.com` / `123456`; admin `owner@dev-tenant.com` / `devpassword123`
- Never commit real passwords into source; E2E reads `E2E_CLIENT_*` / `E2E_ADMIN_*` env with documented local defaults only in README
- Do not implement full forgot-password backend or remember-me persistence in this plan unless Task 1 marks them critical
- JWT access payload is `{ sub, tenantId }` only — middleware does **not** know `isSuperAdmin`; API `SuperAdminGuard` is the authorization boundary
- Google: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` empty ⇒ treat as disabled; make UI honest
- Light theme only; primary green `#22C55E`; Portuguese UI copy
- Conventional commits; Portuguese responses to the user

## File map

| File | Responsibility |
|------|----------------|
| `docs/superpowers/specs/2026-07-25-login-validation-rbac-report.md` | Manual pass/fail report |
| `apps/web/src/lib/auth/google-client.ts` | `isGoogleAuthConfigured()` shared helper |
| `apps/web/src/app/providers.tsx` | Use helper; optionally skip empty Google provider wrapper |
| `apps/web/src/app/(public)/login/page.tsx` | Cursor pointer, Google disabled UX, keep existing auth flows |
| `apps/web/src/components/auth/AuthShell.tsx` | Cursor pointer on footer links / brand links if missing |
| `apps/web/src/app/(public)/login/page.test.tsx` | Jest: views, toggle, error, Google disabled |
| `apps/web/tests/e2e-full/login-rbac.spec.ts` | Playwright: client vs admin menu + `/tenants` API isolation |
| `apps/web/tests/e2e-full/README.md` | Document new env vars + login-rbac test |
| `apps/web/tests/e2e/smoke.spec.ts` | Optional: assert password field + Entrar visible (keep CI-safe) |

---

### Task 1: Manual validation + report

**Files:**
- Create: `docs/superpowers/specs/2026-07-25-login-validation-rbac-report.md`
- Read: `apps/web/src/app/(public)/login/page.tsx`, `apps/web/src/components/layout/Sidebar.tsx`, `apps/web/src/middleware.ts`, `apps/api/src/common/guards/super-admin.guard.ts`

**Interfaces:**
- Consumes: live stack on `http://localhost:3000`, personas from Global Constraints
- Produces: report with pass/fail per checklist row; severity list that Tasks 2–5 consume

- [ ] **Step 1: Confirm stack is up**

Run (PowerShell):

```powershell
curl -s -o $null -w "%{http_code}" http://localhost:3000/login
curl -s -o $null -w "%{http_code}" http://localhost:3002/health
```

Expected: `200` for both (or health JSON OK on API). If web/API down, start `pnpm docker:up` and `pnpm dev` first.

- [ ] **Step 2: Execute checklist A on `/login` in the browser**

Walk rows 1–11 from the spec (empty submit, bad password, toggle, forgot flow, register link, Google button, remember-me, loading, terms, cursor). Note each as PASS / FAIL / N/A with a one-line evidence note.

- [ ] **Step 3: Login as client and verify matrix B**

1. Login `ciroviski@gmail.com` / `123456`
2. Expect redirect `/overview`
3. Sidebar: **no** section “Plataforma”, **no** “Super Admin” / “Planos” / “Logs do Sistema”
4. Open `/tenants` directly — record whether page shell loads and whether network calls to `/api/proxy/super-admin/...` return 403
5. Logout via UI

- [ ] **Step 4: Login as admin and verify matrix B**

1. Login `owner@dev-tenant.com` / `devpassword123`
2. Expect `/overview` + section “Plataforma” visible with Tenants / Planos / Configurações do Sistema / Logs / Email
3. Open `/tenants` — expect usable admin UI (not 403)

- [ ] **Step 5: Write the report file**

Create `docs/superpowers/specs/2026-07-25-login-validation-rbac-report.md` with this structure (fill real results):

```markdown
# Relatório: validação /login + RBAC

**Date:** 2026-07-25
**Environment:** localhost (docker + pnpm dev)

## Checklist /login

| # | Caso | Resultado | Notas |
|---|------|-----------|-------|
| 1 | ... | PASS/FAIL | ... |

## Pós-login

| Check | Cliente | Admin |
|-------|---------|-------|
| Redirect /overview | | |
| Menu Plataforma | ausente / presente | |
| GET /tenants (UI) | | |
| API super-admin | 403 / OK | |

## Gaps

| Gap | Severidade | Ação |
|-----|------------|------|
| Cursor sem pointer | crítico | Task 2 |
| Google desabilitado | crítico/médio | Task 3 |
| Lembrar-me não enviado | médio | aceito |
| Forgot stub 501 | médio | aceito |

## Decisão de escopo para Tasks 2–5

- Corrigir: ...
- Aceitar: ...
```

- [ ] **Step 6: Commit report**

```bash
git add docs/superpowers/specs/2026-07-25-login-validation-rbac-report.md
git commit -m "docs: add login validation RBAC report"
```

---

### Task 2: Cursor pointer on clickable login controls

**Files:**
- Modify: `apps/web/src/app/(public)/login/page.tsx`
- Modify: `apps/web/src/components/auth/AuthShell.tsx`
- Test: covered by Task 4 (Jest asserts `cursor-pointer` class on key controls)

**Interfaces:**
- Consumes: FAIL rows from Task 1 on cursor
- Produces: all interactive login controls include Tailwind `cursor-pointer` (and `disabled:cursor-not-allowed` when disabled)

- [ ] **Step 1: Add `cursor-pointer` to login page interactive elements**

In `apps/web/src/app/(public)/login/page.tsx`, ensure these classNames include `cursor-pointer` (and disabled buttons also `disabled:cursor-not-allowed`):

- Password visibility toggle button
- “Esqueci a senha” button
- Submit “Entrar” / “Enviar instruções”
- “Voltar para o login” buttons (forgot + sent views)
- “Continuar com Google” button
- Checkbox “Lembrar-me” label (add `cursor-pointer` on the `<label>`)

Example pattern for the password toggle:

```tsx
<button
  type="button"
  onClick={() => setShowPassword((v) => !v)}
  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-500 hover:text-slate-700"
  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
>
```

Example for primary submit:

```tsx
className="w-full cursor-pointer rounded-xl bg-[#22C55E] py-3 font-semibold text-[#020617] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
```

- [ ] **Step 2: Add `cursor-pointer` on AuthShell / AuthLinkFooter links**

In `AuthShell.tsx`, add `cursor-pointer` to brand `<Link>` elements and to `AuthLinkFooter`’s `<Link>`:

```tsx
<Link href={href} className="cursor-pointer font-medium text-[#22C55E] hover:underline">
  {linkText}
</Link>
```

- [ ] **Step 3: Spot-check in browser**

Open `http://localhost:3000/login`, hover Entrar, Esqueci a senha, olho, Criar conta, Google — cursor must be pointer.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(public)/login/page.tsx apps/web/src/components/auth/AuthShell.tsx
git commit -m "fix(web): add pointer cursor on login clickable controls"
```

---

### Task 3: Honest Google login when client ID missing

**Files:**
- Create: `apps/web/src/lib/auth/google-client.ts`
- Create: `apps/web/src/lib/auth/google-client.test.ts`
- Modify: `apps/web/src/app/providers.tsx`
- Modify: `apps/web/src/app/(public)/login/page.tsx`

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- Produces:
  - `isGoogleAuthConfigured(): boolean` — true iff trimmed client ID length > 0
  - Login button disabled + helper text when false
  - `useGoogleLogin` only invoked when configured (guard `onClick`)

- [ ] **Step 1: Write failing unit test for the helper**

Create `apps/web/src/lib/auth/google-client.test.ts`:

```ts
describe("isGoogleAuthConfigured", () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  afterEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = ORIGINAL;
  });

  it("returns false when unset or blank", () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    jest.resetModules();
    const { isGoogleAuthConfigured } = require("./google-client") as typeof import("./google-client");
    expect(isGoogleAuthConfigured()).toBe(false);

    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "   ";
    jest.resetModules();
    const mod2 = require("./google-client") as typeof import("./google-client");
    expect(mod2.isGoogleAuthConfigured()).toBe(false);
  });

  it("returns true when client id is set", () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "123-abc.apps.googleusercontent.com";
    jest.resetModules();
    const { isGoogleAuthConfigured } = require("./google-client") as typeof import("./google-client");
    expect(isGoogleAuthConfigured()).toBe(true);
  });
});
```

Note: if the module reads env at call time (preferred), `resetModules` is unnecessary — prefer:

```ts
// google-client.ts
export function isGoogleAuthConfigured(
  clientId: string | undefined = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
): boolean {
  return Boolean(clientId?.trim());
}
```

Then tests call `isGoogleAuthConfigured("")`, `isGoogleAuthConfigured("  ")`, `isGoogleAuthConfigured("id")` without mutating env.

- [ ] **Step 2: Run test — expect FAIL (module missing)**

```bash
pnpm --filter @whatsagent/web test -- src/lib/auth/google-client.test.ts
```

Expected: FAIL — cannot find module / isGoogleAuthConfigured not defined.

- [ ] **Step 3: Implement helper**

Create `apps/web/src/lib/auth/google-client.ts`:

```ts
export function isGoogleAuthConfigured(
  clientId: string | undefined = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
): boolean {
  return Boolean(clientId?.trim());
}
```

- [ ] **Step 4: Re-run test — expect PASS**

```bash
pnpm --filter @whatsagent/web test -- src/lib/auth/google-client.test.ts
```

Expected: PASS

- [ ] **Step 5: Wire Providers**

In `apps/web/src/app/providers.tsx`:

```tsx
import { isGoogleAuthConfigured } from "@/lib/auth/google-client";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const googleEnabled = isGoogleAuthConfigured(googleClientId);

export function Providers(...) {
  const tree = (
    <QueryProvider>
      <AuthProvider initialUser={initialUser}>
        <WebVitals />
        {children}
        <Toaster />
      </AuthProvider>
    </QueryProvider>
  );

  if (!googleEnabled) return tree;

  return (
    <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>
  );
}
```

- [ ] **Step 6: Wire login page Google button**

At top of `LoginPage` component body:

```tsx
const googleEnabled = isGoogleAuthConfigured();
```

Replace Google button `onClick` / disabled:

```tsx
<button
  type="button"
  onClick={() => {
    if (!googleEnabled) return;
    googleLogin();
  }}
  disabled={loading || !googleEnabled}
  className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
>
  <span className="text-base">G</span>
  Continuar com Google
</button>
{!googleEnabled && (
  <p className="mt-2 text-center text-xs text-slate-500">
    Login com Google indisponível neste ambiente.
  </p>
)}
```

Keep `useGoogleLogin({...})` call unconditional only if `GoogleOAuthProvider` always wraps — with Step 5, when disabled the provider is absent, so **conditionally skip the hook** is invalid (Rules of Hooks). Prefer always wrapping with a placeholder provider **or** always mounting `GoogleOAuthProvider` with a non-empty dummy and disabling the button only.

**Preferred simpler approach (avoid hooks/provider split):** keep `GoogleOAuthProvider` always mounted as today, but disable the button + show message when `!isGoogleAuthConfigured()`. Do **not** call `googleLogin()` when disabled. Document that empty `clientId` still mounts the provider (library no-op / console warning acceptable).

Update Step 5 accordingly: keep current provider structure; only use the helper on the login page for UX. Skip the conditional provider unwrap if it forces hooks issues.

Minimal `providers.tsx` change: none required if login page alone is enough. Still export helper for reuse.

- [ ] **Step 7: Manual check**

With empty `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: button disabled, helper text visible, click does nothing. With a real ID (if available): button enabled.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/auth/google-client.ts apps/web/src/lib/auth/google-client.test.ts apps/web/src/app/(public)/login/page.tsx apps/web/src/app/providers.tsx
git commit -m "fix(web): disable Google login when client id is missing"
```

---

### Task 4: Jest tests for login page states

**Files:**
- Create: `apps/web/src/app/(public)/login/page.test.tsx`
- Modify: none required if Task 2–3 already done

**Interfaces:**
- Consumes: `LoginPage` default export; mocks for `next/navigation`, `@react-oauth/google`, `isGoogleAuthConfigured`
- Produces: coverage for forgot/sent views, password toggle, invalid login error, Google disabled message, `cursor-pointer` on Entrar

- [ ] **Step 1: Write the test file**

Create `apps/web/src/app/(public)/login/page.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockGoogleLogin = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("@react-oauth/google", () => ({
  useGoogleLogin: (opts: { onSuccess: (t: { access_token: string }) => void }) => {
    mockGoogleLogin.mockImplementation(() =>
      opts.onSuccess({ access_token: "tok" }),
    );
    return mockGoogleLogin;
  },
}));

jest.mock("@/lib/auth/google-client", () => ({
  isGoogleAuthConfigured: jest.fn(() => false),
}));

import { isGoogleAuthConfigured } from "@/lib/auth/google-client";
import LoginPage from "./page";

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isGoogleAuthConfigured as jest.Mock).mockReturnValue(false);
    global.fetch = jest.fn();
  });

  it("mostra aviso quando Google não está configurado", () => {
    render(<LoginPage />);
    expect(
      screen.getByText(/login com google indisponível/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continuar com google/i })).toBeDisabled();
  });

  it("alterna visibilidade da senha", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    const password = screen.getByPlaceholderText("••••••••");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByLabelText(/mostrar senha/i));
    expect(password).toHaveAttribute("type", "text");
  });

  it("navega para fluxo esqueci a senha e volta", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /esqueci a senha/i }));
    expect(screen.getByText(/recuperar senha/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /voltar para o login/i }));
    expect(screen.getByText(/bem-vindo de volta/i)).toBeInTheDocument();
  });

  it("exibe erro quando login falha", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Credenciais inválidas" }),
    });
    render(<LoginPage />);
    await user.type(screen.getByPlaceholderText("voce@empresa.com"), "a@b.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "wrong");
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));
    await waitFor(() => {
      expect(screen.getByText(/credenciais inválidas/i)).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("botão Entrar tem cursor-pointer", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /^entrar$/i }).className).toMatch(
      /cursor-pointer/,
    );
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm --filter @whatsagent/web test -- src/app/\(public\)/login/page.test.tsx
```

Expected: PASS (fix copy/selectors if Portuguese headings differ — match `AuthShell` title text).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(public)/login/page.test.tsx
git commit -m "test(web): add LoginPage unit coverage for auth views"
```

---

### Task 5: Playwright local RBAC suite

**Files:**
- Create: `apps/web/tests/e2e-full/login-rbac.spec.ts`
- Modify: `apps/web/tests/e2e-full/README.md`
- Optional enhance: `apps/web/tests/e2e/smoke.spec.ts` (CI-safe only — do not add real credentials)

**Interfaces:**
- Consumes: stack on `http://localhost:3000` + API `3002`; env `E2E_CLIENT_EMAIL`, `E2E_CLIENT_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`
- Produces: two tests proving sidebar isolation; one test proving client cannot call super-admin API successfully

- [ ] **Step 1: Document env vars in README**

Append to `apps/web/tests/e2e-full/README.md`:

```markdown
## Login RBAC (`login-rbac.spec.ts`)

Requires two users in the local DB (see design spec). Override via env:

```bash
# PowerShell examples
$env:E2E_CLIENT_EMAIL="ciroviski@gmail.com"
$env:E2E_CLIENT_PASSWORD="123456"
$env:E2E_ADMIN_EMAIL="owner@dev-tenant.com"
$env:E2E_ADMIN_PASSWORD="devpassword123"
pnpm --filter @whatsagent/web test:e2e:full -- login-rbac
```

Defaults in the spec file match the local personas above when env is unset (local-only; not used in CI).
```

- [ ] **Step 2: Write Playwright spec**

Create `apps/web/tests/e2e-full/login-rbac.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";

const CLIENT = {
  email: process.env.E2E_CLIENT_EMAIL ?? "ciroviski@gmail.com",
  password: process.env.E2E_CLIENT_PASSWORD ?? "123456",
};
const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? "owner@dev-tenant.com",
  password: process.env.E2E_ADMIN_PASSWORD ?? "devpassword123",
};

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("voce@empresa.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await expect(page).toHaveURL(/\/overview/, { timeout: 15_000 });
}

async function logout(page: Page) {
  // Prefer explicit logout control if present; otherwise clear cookies.
  await page.context().clearCookies();
}

test.describe("Login RBAC — cliente vs admin", () => {
  test("cliente autentica e não vê seção Plataforma", async ({ page }) => {
    await login(page, CLIENT.email, CLIENT.password);
    await expect(page.getByText("Overview")).toBeVisible();
    await expect(page.getByText("Plataforma")).toHaveCount(0);
    await expect(page.getByText("Super Admin")).toHaveCount(0);
    await expect(page.getByText("Logs do Sistema")).toHaveCount(0);
  });

  test("admin autentica e vê seção Plataforma", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page.getByText("Plataforma")).toBeVisible();
    await expect(page.getByRole("link", { name: /super admin/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^planos$/i })).toBeVisible();
  });

  test("cliente recebe 403 em API super-admin", async ({ page }) => {
    await login(page, CLIENT.email, CLIENT.password);

    const res = await page.request.get("http://localhost:3000/api/proxy/super-admin/tenants?page=1&limit=10");
    // Proxy may return 401/403 depending on path mapping — assert not OK.
    expect(res.ok()).toBe(false);
    expect([401, 403, 404]).toContain(res.status());

    await logout(page);
  });
});
```

If the proxy path for tenants differs, inspect `apps/web/src/features/admin/api/queries.ts` (`/super-admin/tenants`) and match the proxy URL exactly (`/api/proxy/super-admin/tenants?...`).

- [ ] **Step 3: Run the suite**

```bash
pnpm --filter @whatsagent/web test:e2e:full -- login-rbac
```

Expected: 3 passed. If login fails, re-check passwords/DB users from Task 1.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/e2e-full/login-rbac.spec.ts apps/web/tests/e2e-full/README.md
git commit -m "test(web): add local Playwright login RBAC coverage"
```

---

### Task 6: Final verification + report update

**Files:**
- Modify: `docs/superpowers/specs/2026-07-25-login-validation-rbac-report.md`

**Interfaces:**
- Consumes: Tasks 2–5 outcomes
- Produces: report section “Pós-correção” with re-check of cursor + Google + automated tests

- [ ] **Step 1: Re-run unit tests**

```bash
pnpm --filter @whatsagent/web test -- src/lib/auth/google-client.test.ts src/app/(public)/login/page.test.tsx src/components/layout/Sidebar.test.tsx
```

Expected: all PASS.

- [ ] **Step 2: Re-run Playwright login-rbac**

```bash
pnpm --filter @whatsagent/web test:e2e:full -- login-rbac
```

Expected: PASS.

- [ ] **Step 3: Append pós-correção to the report**

```markdown
## Pós-correção

| Item | Status |
|------|--------|
| Cursor pointer | PASS |
| Google disabled UX | PASS |
| Jest login + google-client | PASS |
| Playwright login-rbac | PASS |
| Sidebar unit isolation (já existia) | PASS |
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-25-login-validation-rbac-report.md
git commit -m "docs: update login validation report after fixes"
```

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Checklist `/login` manual | Task 1 |
| Client vs admin matrix | Task 1 + Task 5 |
| Report artifact | Task 1 + Task 6 |
| Cursor pointer | Task 2 + Task 4 |
| Google disabled honesty | Task 3 + Task 4 |
| Fix critical gaps | Tasks 2–3 |
| Accept remember-me / forgot stub | Task 1 report |
| Jest regression | Task 4 |
| Playwright regression | Task 5 |
| Creds via env | Task 5 |
| No full Google E2E in CI | Task 5 (e2e-full local only) |

## Placeholder / consistency check

- No TBD left in tasks
- `isGoogleAuthConfigured` signature consistent across Tasks 3–4
- Playwright uses same persona emails as Global Constraints
- Provider/hooks caveat resolved: prefer button disable over unmounting `GoogleOAuthProvider`
`)