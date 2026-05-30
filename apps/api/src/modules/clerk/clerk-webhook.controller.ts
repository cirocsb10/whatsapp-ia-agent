import {
  Controller, Post, Headers, Req, HttpCode,
  BadRequestException, Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Webhook } from "svix";
import { ClerkWebhookService } from "./clerk-webhook.service";
import { Request } from "express";

@Controller("webhooks")
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(
    private readonly service: ClerkWebhookService,
    private readonly config: ConfigService,
  ) {}

  @Post("clerk")
  @HttpCode(200)
  async receive(
    @Req() req: Request,
    @Headers("svix-id") svixId: string,
    @Headers("svix-timestamp") svixTimestamp: string,
    @Headers("svix-signature") svixSignature: string,
  ) {
    const secret = this.config.get<string>("CLERK_WEBHOOK_SECRET") ?? "";
    const wh = new Webhook(secret);

    let event: { type: string; data: Record<string, unknown> };
    try {
      event = wh.verify(req.rawBody as Buffer, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as typeof event;
    } catch {
      throw new BadRequestException("Invalid webhook signature");
    }

    this.logger.log(`Clerk event: ${event.type}`);

    switch (event.type) {
      case "user.created":
        await this.service.handleUserCreated(event.data as Parameters<ClerkWebhookService["handleUserCreated"]>[0]);
        break;
      case "user.updated":
        await this.service.handleUserUpdated(event.data as Parameters<ClerkWebhookService["handleUserUpdated"]>[0]);
        break;
      case "user.deleted":
        await this.service.handleUserDeleted(event.data.id as string);
        break;
      default:
        this.logger.debug(`Evento ignorado: ${event.type}`);
    }

    return { received: true };
  }
}
