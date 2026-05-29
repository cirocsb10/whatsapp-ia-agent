import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const port = config.get<number>("port") ?? 3001;

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableCors({ origin: process.env["BACKOFFICE_API_URL"] ?? "http://localhost:3002" });

  await app.listen(port);
  Logger.log(`🚀 Channel Service on http://localhost:${port}`, "Bootstrap");
}

bootstrap();
