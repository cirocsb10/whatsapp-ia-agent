import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export function useApi() {
  const { getToken } = useAuth();

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}): Promise<Response> => {
      const token = await getToken();
      return fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [getToken],
  );

  return { apiFetch, API_URL };
}
