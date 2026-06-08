import { Module } from "@nestjs/common";
import { MetaApiClient } from "./meta-api.client";
import { MessagingService } from "./messaging.service";

@Module({
  providers: [MetaApiClient, MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
