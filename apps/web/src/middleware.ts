import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  const authenticated = await hasValidAccessToken(token);

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
    return NextResponse.redirect(overviewUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
