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

  async sendMessage(
    phoneNumberId: string,
    to: string,
    message: OutboundMessage,
    accessToken?: string,
  ): Promise<string | null> {
    switch (message.type) {
      case "text":
        if (message.text) {
          return this.metaClient.sendTextMessage(phoneNumberId, to, message.text, accessToken);
        }
        break;
      case "image":
        if (message.imageUrl) {
          return this.metaClient.sendImageMessage(
            phoneNumberId,
            to,
            message.imageUrl,
            undefined,
            accessToken,
          );
        }
        break;
      case "template":
        this.logger.warn(`Unsupported outbound type: ${message.type}`);
        break;
      default: {
        const _exhaustive: never = message.type;
        this.logger.warn(`Unsupported outbound type: ${_exhaustive}`);
      }
    }
    return null;
  }
}
