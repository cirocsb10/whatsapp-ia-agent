import { Test } from "@nestjs/testing";
import { WebhookService } from "./webhook.service";
import { InboundProducer } from "../queue/inbound.producer";
import { SessionService } from "../session/session.service";
import { AudioService } from "../audio/audio.service";
import { ConfigService } from "@nestjs/config";

const mockProducer = { publishInbound: jest.fn() };
const mockSession = { isDuplicate: jest.fn().mockResolvedValue(false), get: jest.fn().mockResolvedValue(null), set: jest.fn() };
const mockAudio = { downloadAndTranscribe: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue("test_token") };

function makeTextPayload(text: string) {
  return {
    object: "whatsapp_business_account" as const,
    entry: [{
      id: "waba",
      changes: [{
        field: "messages" as const,
        value: {
          messaging_product: "whatsapp" as const,
          metadata: { display_phone_number: "11999", phone_number_id: "pid" },
          messages: [{
            from: "5511999", id: "wamid.1", timestamp: "1700000000", type: "text" as const,
            text: { body: text },
          }],
        },
      }],
    }],
  };
}

describe("WebhookService", () => {
  let service: WebhookService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: InboundProducer, useValue: mockProducer },
        { provide: SessionService, useValue: mockSession },
        { provide: AudioService, useValue: mockAudio },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(WebhookService);
    jest.clearAllMocks();
    // Reset mock implementations to defaults after clearAllMocks
    mockSession.isDuplicate.mockResolvedValue(false);
    mockSession.get.mockResolvedValue(null);
  });

  it("publishes inbound event for text message", async () => {
    await service.processWebhook(makeTextPayload("Quero comprar"));
    expect(mockProducer.publishInbound).toHaveBeenCalledWith(
      expect.objectContaining({ type: "text", text: "Quero comprar" }),
    );
  });

  it("skips duplicate messages", async () => {
    mockSession.isDuplicate.mockResolvedValue(true);
    await service.processWebhook(makeTextPayload("dup"));
    expect(mockProducer.publishInbound).not.toHaveBeenCalled();
  });

  it("skips opt-out messages", async () => {
    await service.processWebhook(makeTextPayload("parar"));
    expect(mockProducer.publishInbound).not.toHaveBeenCalled();
  });

  it("transcribes audio before publishing", async () => {
    mockAudio.downloadAndTranscribe.mockResolvedValue({ audioUrl: "http://s3/a.ogg", transcript: "camiseta" });
    const payload = {
      object: "whatsapp_business_account" as const,
      entry: [{
        id: "waba",
        changes: [{
          field: "messages" as const,
          value: {
            messaging_product: "whatsapp" as const,
            metadata: { display_phone_number: "11999", phone_number_id: "pid" },
            messages: [{
              from: "5511999", id: "wamid.2", timestamp: "1700000000", type: "audio" as const,
              audio: { id: "media_id", mime_type: "audio/ogg" },
            }],
          },
        }],
      }],
    };
    await service.processWebhook(payload);
    expect(mockAudio.downloadAndTranscribe).toHaveBeenCalledWith("media_id", "pid");
    expect(mockProducer.publishInbound).toHaveBeenCalledWith(
      expect.objectContaining({ audioTranscript: "camiseta" }),
    );
  });
});
