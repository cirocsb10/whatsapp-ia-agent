import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe, Logger } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const port = config.get<number>("port") ?? 3001;
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    throw new Error("FRONTEND_URL env var is required");
  }

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableCors({ origin: frontendUrl, credentials: true });

  await app.listen(port);
  Logger.log(`🚀 Channel Service on http://localhost:${port}`, "Bootstrap");
}

bootstrap();
