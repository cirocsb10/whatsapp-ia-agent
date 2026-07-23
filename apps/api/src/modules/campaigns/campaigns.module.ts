import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsService } from "./campaigns.service";
import { TemplatesService } from "./templates.service";
import { AudienceService } from "./audience.service";
import { CampaignStatusService } from "./campaign-status.service";
import { CampaignDispatchProcessor } from "./campaign-dispatch.processor";
import { CampaignStatusConsumer } from "./campaign-status.consumer";
import { CAMPAIGN_DISPATCH_QUEUE } from "./campaign.constants";

@Module({
  imports: [BullModule.registerQueue({ name: CAMPAIGN_DISPATCH_QUEUE })],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    TemplatesService,
    AudienceService,
    CampaignStatusService,
    CampaignDispatchProcessor,
    CampaignStatusConsumer,
  ],
  exports: [CampaignStatusService, AudienceService],
})
export class CampaignsModule {}
