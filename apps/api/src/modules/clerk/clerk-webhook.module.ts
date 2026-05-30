import { Module } from "@nestjs/common";
import { ClerkWebhookController } from "./clerk-webhook.controller";
import { ClerkWebhookService } from "./clerk-webhook.service";
import { PrismaModule } from "../../common/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [ClerkWebhookController],
  providers: [ClerkWebhookService],
})
export class ClerkWebhookModule {}
