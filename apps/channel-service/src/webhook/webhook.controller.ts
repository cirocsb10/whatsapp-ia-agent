import {
  Controller, Post, Get, Body, Query, HttpCode,
  UseGuards, HttpException, HttpStatus, Logger,
} from "@nestjs/common";
import { HmacGuard } from "../common/guards/hmac.guard";
import { WebhookService } from "./webhook.service";
import { MetaWebhookBody } from "./dto/meta-webhook.dto";

@Controller("webhooks")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly service: WebhookService) {}

  @Get("meta")
  verify(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
  ): string {
    const result = this.service.verifyWebhook(mode, token, challenge);
    if (!result) throw new HttpException("Forbidden", HttpStatus.FORBIDDEN);
    this.logger.log("✅ Webhook verified");
    return result;
  }

  @Post("meta")
  @HttpCode(200)
  @UseGuards(HmacGuard)
  receive(@Body() body: MetaWebhookBody): { received: boolean } {
    this.service.processWebhook(body).catch((e) => this.logger.error("Webhook error:", e));
    return { received: true };
  }
}
