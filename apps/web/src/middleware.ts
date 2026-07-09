import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { API_URL } from "@/lib/auth/api-url";
import { REFRESH_COOKIE, setAuthCookies } from "@/lib/auth/cookies";

const ACCESS_COOKIE = "access_token";

const PROTECTED_PREFIXES = [
  "/setup",
  "/overview",
  "/analytics",
  "/catalog",
  "/inbox",
  "/orders",
  "/agent",
  "/settings",
  "/support",
  "/tenants",
  "/email",
];

const AUTH_PAGES = ["/login", "/register"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthPage(pathname: string) {
  return AUTH_PAGES.includes(pathname);
}

async function hasValidAccessToken(token: string | undefined) {
  if (!token) return false;
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

async function tryRefresh(
  refreshToken: string | undefined,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { accessToken: string; refreshToken: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rotas /api/* fazem sua própria autenticação/refresh (ver app/api/proxy e
  // app/api/auth) — o refresh token tem uso único (rotação via Redis), então
  // não pode ser consumido aqui também sob risco de corrida com essas rotas.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  let authenticated = await hasValidAccessToken(token);
  let refreshed: { accessToken: string; refreshToken: string } | null = null;

  // Access token expirado (15min) mas ainda dentro da sessão de 7 dias:
  // renova silenciosamente em vez de derrubar o usuário para /login.
  if (!authenticated) {
    refreshed = await tryRefresh(req.cookies.get(REFRESH_COOKIE)?.value);
    if (refreshed) authenticated = true;
  }

  if (isProtected(pathname) && !authenticated) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage(pathname) && authenticated) {
    const overviewUrl = req.nextUrl.clone();
    overviewUrl.pathname = "/overview";
    overviewUrl.search = "";
    const response = NextResponse.redirect(overviewUrl);
    if (refreshed) setAuthCookies(response, refreshed);
    return response;
  }

  const response = NextResponse.next();
  if (refreshed) setAuthCookies(response, refreshed);
  return response;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
