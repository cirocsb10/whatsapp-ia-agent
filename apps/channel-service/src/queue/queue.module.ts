import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "../prisma/prisma.module";
import { MessagingModule } from "../messaging/messaging.module";
import { SessionModule } from "../session/session.module";
import { INACTIVITY_QUEUE } from "./queue.constants";
import { InactivityProcessor } from "./inactivity.processor";
import { InactivitySchedulerService } from "./inactivity-scheduler.service";

@Module({
  imports: [
    BullModule.registerQueue({ name: INACTIVITY_QUEUE }),
    PrismaModule,
    MessagingModule,
    SessionModule,
  ],
  providers: [InactivityProcessor, InactivitySchedulerService],
  exports: [InactivitySchedulerService],
})
export class QueueModule {}
