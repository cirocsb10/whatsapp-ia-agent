import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_URL } from "@/lib/auth/api-url";
import { REFRESH_COOKIE, setAuthCookies } from "@/lib/auth/cookies";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ message: "Sessão expirada" }, { status: 401 });
  }

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  const text = await res.text();
  if (!res.ok) {
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  }

  const data = JSON.parse(text) as { accessToken: string; refreshToken: string };
  const response = NextResponse.json({ success: true });
  setAuthCookies(response, data);
  return response;
}
