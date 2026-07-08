import { useCallback } from "react";

export function useApi() {
  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}): Promise<Response> => {
      const normalized = path.startsWith("/") ? path : `/${path}`;
      return fetch(`/api/proxy${normalized}`, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
    },
    [],
  );

  return { apiFetch };
}
