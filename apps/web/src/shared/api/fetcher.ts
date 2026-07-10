/**
 * Fetcher único do frontend (F0 §3.4).
 *
 * Sempre vai ao proxy BFF (`/api/proxy/*`, cookie-aware) — elimina o segundo cliente
 * (`lib/api-client.ts`, `ky` direto no backend). Erros são normalizados em `ApiError`
 * para consumo padronizado por TanStack Query (`onError`, estados `isError`).
 */

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type Json = Record<string, unknown>;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  const res = await fetch(`/api/proxy${normalized}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!res.ok) {
    let parsed: Json | undefined;
    try {
      parsed = (await res.json()) as Json;
    } catch {
      parsed = undefined;
    }
    const message =
      (parsed && typeof parsed["message"] === "string" && (parsed["message"] as string)) ||
      res.statusText ||
      `HTTP ${res.status}`;
    throw new ApiError(res.status, message, parsed);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "GET" }),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "POST", ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "PATCH", ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }),
  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: "PUT", ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }),
  delete: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "DELETE" }),
};
