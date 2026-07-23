import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Observable, tap } from "rxjs";
import { SystemLogService } from "./system-log.service";

const SKIP_PREFIXES = ["/health", "/webhooks", "/socket.io"];
const SKIP_EXACT = new Set(["/auth/me"]);

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "refreshToken",
  "accessToken",
  "passwordEncrypted",
]);

const MAX_PAYLOAD_CHARS = 8_000;

type AuthUser = {
  id?: string;
  email?: string;
  tenantId?: string;
};

@Injectable()
export class SystemLogInterceptor implements NestInterceptor {
  constructor(private readonly systemLog: SystemLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: AuthUser }>();
    const res = http.getResponse<Response>();
    const path = req.path || req.url?.split("?")[0] || "";

    if (shouldSkip(path)) {
      return next.handle();
    }

    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.persist(req, res, path, started),
        error: () => this.persist(req, res, path, started),
      }),
    );
  }

  private persist(
    req: Request & { user?: AuthUser },
    res: Response,
    path: string,
    started: number,
  ): void {
    const user = req.user;
    this.systemLog.record({
      tenantId: user?.tenantId ?? null,
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      method: (req.method ?? "GET").toUpperCase(),
      endpoint: path,
      statusCode: res.statusCode || 500,
      payload: sanitizePayload(req.body),
      ip: extractIp(req),
      userAgent: req.headers["user-agent"] ?? null,
      duration: Date.now() - started,
    });
  }
}

function shouldSkip(path: string): boolean {
  if (SKIP_EXACT.has(path)) return true;
  return SKIP_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function extractIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(",")[0]?.trim() || null;
  }
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

function sanitizePayload(body: unknown): unknown {
  if (body === undefined || body === null) return undefined;
  if (typeof body !== "object") return body;

  const sanitized = redactDeep(body);
  const serialized = JSON.stringify(sanitized);
  if (serialized.length <= MAX_PAYLOAD_CHARS) return sanitized;

  return {
    _truncated: true,
    preview: serialized.slice(0, MAX_PAYLOAD_CHARS),
  };
}

function redactDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactDeep);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = redactDeep(child);
      }
    }
    return out;
  }
  return value;
}
