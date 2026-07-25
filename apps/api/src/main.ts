import "./instrument";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SentryGlobalFilter } from "@sentry/nestjs/setup";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { PrismaExceptionFilter } from "./common/filters/prisma-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    throw new Error("FRONTEND_URL env var is required");
  }

  app.use(helmet());

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  // Ordem importa: PrismaExceptionFilter (específico) primeiro, SentryGlobalFilter
  // (catch-all, reporta ao Sentry e delega formatação padrão) por último.
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaExceptionFilter(), new SentryGlobalFilter(httpAdapter));

  await app.listen(process.env.PORT ?? 3002);
}

bootstrap();
