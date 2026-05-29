import { Injectable, Logger } from "@nestjs/common";
import { MetaApiClient } from "./meta-api.client";

export interface OutboundMessage {
  type: "text" | "image" | "template";
  text?: string;
  imageUrl?: string;
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(private readonly metaClient: MetaApiClient) {}

  async sendMessage(phoneNumberId: string, to: string, message: OutboundMessage): Promise<void> {
    switch (message.type) {
      case "text":
        if (message.text) await this.metaClient.sendTextMessage(phoneNumberId, to, message.text);
        break;
      case "image":
        if (message.imageUrl) await this.metaClient.sendImageMessage(phoneNumberId, to, message.imageUrl);
        break;
      default:
        this.logger.warn(`Unsupported outbound type: ${message.type}`);
    }
  }
}
