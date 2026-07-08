import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_URL } from "@/lib/auth/api-url";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/auth/cookies";

async function authProxy(
  path: string,
  body: unknown,
): Promise<NextResponse> {
  const res = await fetch(`${API_URL}/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  }

  const data = JSON.parse(text) as {
    accessToken: string;
    refreshToken: string;
    user?: unknown;
  };

  const response = NextResponse.json({
    user: data.user,
    success: true,
  });
  setAuthCookies(response, data);
  return response;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return authProxy("login", body);
}
