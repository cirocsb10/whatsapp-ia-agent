import { CallHandler, ExecutionContext } from "@nestjs/common";
import { of, throwError, lastValueFrom } from "rxjs";
import { SystemLogInterceptor } from "./system-log.interceptor";
import { SystemLogService } from "./system-log.service";

function buildHttpContext(opts: {
  path?: string;
  url?: string;
  method?: string;
  body?: unknown;
  statusCode?: number;
  user?: { id?: string; email?: string; tenantId?: string };
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  type?: string;
}): ExecutionContext {
  const req = {
    path: opts.path,
    url: opts.url ?? opts.path,
    method: opts.method ?? "GET",
    body: opts.body,
    user: opts.user,
    headers: opts.headers ?? {},
    ip: opts.ip,
  };
  const res = { statusCode: opts.statusCode ?? 200 };

  return {
    getType: () => opts.type ?? "http",
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

describe("SystemLogInterceptor", () => {
  let interceptor: SystemLogInterceptor;
  let record: jest.Mock;

  beforeEach(() => {
    record = jest.fn();
    interceptor = new SystemLogInterceptor({
      record,
    } as unknown as SystemLogService);
  });

  it("não grava paths na skip-list", async () => {
    const next: CallHandler = { handle: () => of({ ok: true }) };

    for (const path of ["/health", "/webhooks/meta", "/socket.io", "/auth/me"]) {
      await lastValueFrom(
        interceptor.intercept(buildHttpContext({ path }), next),
      );
    }

    expect(record).not.toHaveBeenCalled();
  });

  it("grava request autenticada com payload sanitizado", async () => {
    const next: CallHandler = { handle: () => of({ ok: true }) };

    await lastValueFrom(
      interceptor.intercept(
        buildHttpContext({
          path: "/super-admin/settings",
          method: "PUT",
          statusCode: 200,
          user: { id: "u1", email: "admin@x.com", tenantId: "t1" },
          body: { password: "secret", host: "smtp.x.com" },
          headers: {
            "user-agent": "jest",
            "x-forwarded-for": "203.0.113.9, 10.0.0.1",
          },
        }),
        next,
      ),
    );

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        userEmail: "admin@x.com",
        tenantId: "t1",
        method: "PUT",
        endpoint: "/super-admin/settings",
        statusCode: 200,
        ip: "203.0.113.9",
        userAgent: "jest",
        payload: { password: "[REDACTED]", host: "smtp.x.com" },
      }),
    );
    expect(record.mock.calls[0][0].duration).toBeGreaterThanOrEqual(0);
  });

  it("grava também quando o handler falha", async () => {
    const next: CallHandler = {
      handle: () => throwError(() => new Error("boom")),
    };

    await expect(
      lastValueFrom(
        interceptor.intercept(
          buildHttpContext({ path: "/auth/login", method: "POST", statusCode: 500 }),
          next,
        ),
      ),
    ).rejects.toThrow("boom");

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/auth/login",
        method: "POST",
        statusCode: 500,
      }),
    );
  });

  it("ignora contextos não-HTTP", async () => {
    const next: CallHandler = { handle: () => of(null) };

    await lastValueFrom(
      interceptor.intercept(buildHttpContext({ path: "/x", type: "rpc" }), next),
    );

    expect(record).not.toHaveBeenCalled();
  });

  it("trunca payloads muito grandes", async () => {
    const next: CallHandler = { handle: () => of(null) };
    const huge = "x".repeat(10_000);

    await lastValueFrom(
      interceptor.intercept(
        buildHttpContext({
          path: "/products",
          method: "POST",
          body: { note: huge },
        }),
        next,
      ),
    );

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ _truncated: true }),
      }),
    );
  });
});
