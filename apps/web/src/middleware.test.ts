import { middleware } from "./middleware";
import { NextRequest } from "next/server";

jest.mock("jose", () => ({
  jwtVerify: jest.fn(),
}));

jest.mock("@/lib/auth/api-url", () => ({
  API_URL: "http://localhost:3002",
}));

jest.mock("@/lib/auth/cookies", () => ({
  REFRESH_COOKIE: "refresh_token",
  setAuthCookies: jest.fn(),
}));

import { jwtVerify } from "jose";

function makeRequest(pathname: string, accessToken?: string) {
  const url = `http://localhost:3000${pathname}`;
  const headers = new Headers();
  if (accessToken) {
    headers.set("cookie", `access_token=${accessToken}`);
  }
  return new NextRequest(url, { headers });
}

describe("middleware admin routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = "test-secret";
  });

  it("protege /plans, /system-settings e /system-log (redirect login sem token)", async () => {
    for (const path of ["/plans", "/system-settings", "/system-log"]) {
      const res = await middleware(makeRequest(path));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
      expect(res.headers.get("location")).toContain(`redirect=${encodeURIComponent(path)}`);
    }
  });

  it("permite acesso autenticado às rotas admin", async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({ payload: { sub: "u1" } });

    for (const path of ["/plans", "/system-settings", "/system-log", "/tenants"]) {
      const res = await middleware(makeRequest(path, "valid.jwt"));
      expect(res.status).toBe(200);
    }
  });
});
