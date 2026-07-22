// Precisa ser importado antes de qualquer outro módulo (inclusive @nestjs/core) para
// que a instrumentação automática do Sentry (HTTP, Prisma etc.) consiga interceptar.
import * as Sentry from "@sentry/nestjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
