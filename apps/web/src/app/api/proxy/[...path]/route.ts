import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_URL } from "@/lib/auth/api-url";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  setAuthCookies,
} from "@/lib/auth/cookies";

type RouteContext = { params: Promise<{ path: string[] }> };

async function tryRefreshTokens(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) return null;
  return res.json() as Promise<{ accessToken: string; refreshToken: string }>;
}

async function proxyRequest(
  req: NextRequest,
  params: { path: string[] },
  accessToken: string,
  retried = false,
): Promise<NextResponse> {
  const path = params.path.join("/");
  const url = new URL(req.url);
  const targetUrl = `${API_URL}/${path}${url.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };

  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  const body =
    req.method !== "GET" && req.method !== "HEAD"
      ? await req.text().catch(() => undefined)
      : undefined;

  let upstream: Response;
  try {
    const init: RequestInit = { method: req.method, headers };
    if (body !== undefined) init.body = body;
    upstream = await fetch(targetUrl, init);
  } catch {
    return NextResponse.json({ message: "Serviço indisponível" }, { status: 503 });
  }

  if (upstream.status === 401 && !retried) {
    const cookieStore = await cookies();
    const refreshed = await tryRefreshTokens(cookieStore);
    if (refreshed) {
      const retryResponse = await proxyRequest(req, params, refreshed.accessToken, true);
      setAuthCookies(retryResponse, refreshed);
      return retryResponse;
    }
  }

  const responseBody = await upstream.text();
  const responseHeaders: Record<string, string> = {
    "Content-Type": upstream.headers.get("content-type") ?? "application/json",
  };
  // Repassa metadados de paginação (B2) — o proxy é opaco por padrão.
  const hasMore = upstream.headers.get("x-has-more");
  if (hasMore !== null) responseHeaders["X-Has-More"] = hasMore;
  const nextCursor = upstream.headers.get("x-next-cursor");
  if (nextCursor !== null) responseHeaders["X-Next-Cursor"] = nextCursor;

  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

async function handle(req: NextRequest, context: RouteContext) {
  const params = await context.params;
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }
  return proxyRequest(req, params, token);
}

export const GET = (req: NextRequest, context: RouteContext) => handle(req, context);
export const POST = (req: NextRequest, context: RouteContext) => handle(req, context);
export const PATCH = (req: NextRequest, context: RouteContext) => handle(req, context);
export const PUT = (req: NextRequest, context: RouteContext) => handle(req, context);
export const DELETE = (req: NextRequest, context: RouteContext) => handle(req, context);
