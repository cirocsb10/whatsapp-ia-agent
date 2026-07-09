import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { PlatformEmailController } from "./platform-email.controller";
import { PlatformSmtpSettingsService } from "./platform-smtp-settings.service";
import { PlatformEmailService } from "./platform-email.service";
import { EmailProcessor } from "./processors/email.processor";
import { EMAIL_QUEUE } from "./email-queue.constants";

@Module({
  imports: [ConfigModule, PrismaModule, BullModule.registerQueue({ name: EMAIL_QUEUE })],
  controllers: [PlatformEmailController],
  providers: [PlatformSmtpSettingsService, PlatformEmailService, EmailProcessor],
  exports: [PlatformEmailService],
})
export class PlatformEmailModule {}
