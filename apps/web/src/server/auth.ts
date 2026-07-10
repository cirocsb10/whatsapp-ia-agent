import { cookies } from "next/headers";
import { API_URL } from "@/lib/auth/api-url";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import type { AuthUser } from "@/contexts/auth-context";

/**
 * Lê o usuário atual no servidor (RSC) a partir do cookie httpOnly (F1 §3.6).
 * Injetado no layout raiz para eliminar o `fetch /api/auth/me` bloqueante do client.
 *
 * Retorna `null` silenciosamente em qualquer falha — o AuthProvider faz fallback
 * client-side (cobre o caso em que o middleware acabou de rotacionar o token e o
 * RSC ainda lê o cookie antigo da request).
 */
export async function getServerUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthUser;
  } catch {
    return null;
  }
}
