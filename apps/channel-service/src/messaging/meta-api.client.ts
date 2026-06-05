import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

@Injectable()
export class MetaApiClient {
  private readonly logger = new Logger(MetaApiClient.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const base = config.get<string>("meta.graphApiBaseUrl");
    const version = config.get<string>("meta.graphApiVersion");

    this.http = axios.create({
      baseURL: `${base}/${version}`,
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${process.env["META_SYSTEM_USER_TOKEN"] ?? ""}`,
        "Content-Type": "application/json",
      },
    });
  }

  async sendTextMessage(phoneNumberId: string, to: string, text: string): Promise<string | null> {
    const res = await this.http.post(`/${phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: text },
    });
    const waMessageId = (res.data as any)?.messages?.[0]?.id ?? null;
    this.logger.debug(`Sent text to ${to}, wamid: ${waMessageId}`);
    return waMessageId;
  }

  async sendImageMessage(phoneNumberId: string, to: string, imageUrl: string, caption?: string): Promise<string | null> {
    const res = await this.http.post(`/${phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl, caption },
    });
    return (res.data as any)?.messages?.[0]?.id ?? null;
  }

  async markAsRead(phoneNumberId: string, messageId: string): Promise<void> {
    await this.http.post(`/${phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    });
  }
}
