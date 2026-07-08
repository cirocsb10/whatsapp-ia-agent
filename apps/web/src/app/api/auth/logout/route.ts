import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_URL } from "@/lib/auth/api-url";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
} from "@/lib/auth/cookies";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

  if (refreshToken) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Limpa cookies mesmo se upstream falhar.
    }
  }

  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}
