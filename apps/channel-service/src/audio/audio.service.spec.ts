import { Test } from "@nestjs/testing";
import { AudioService } from "./audio.service";
import { WhisperClient } from "./whisper.client";
import { ConfigService } from "@nestjs/config";

const mockWhisper = {
  transcribe: jest.fn().mockResolvedValue("Quero comprar uma camiseta preta tamanho M"),
};
const mockConfig = {
  get: jest.fn((key: string) => {
    const cfg: Record<string, unknown> = {
      "meta.graphApiBaseUrl": "https://graph.facebook.com",
      "meta.graphApiVersion": "v21.0",
      "storage.endpoint": "localhost",
      "storage.port": 9000,
      "storage.useSSL": false,
      "storage.accessKey": "key",
      "storage.secretKey": "secret",
      "storage.bucket": "test-bucket",
    };
    return cfg[key];
  }),
};

describe("AudioService", () => {
  let service: AudioService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AudioService,
        { provide: WhisperClient, useValue: mockWhisper },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<AudioService>(AudioService);
    jest.clearAllMocks();
  });

  it("transcribes audio and returns URL and transcript", async () => {
    jest.spyOn(service as any, "downloadFromMeta").mockResolvedValue(Buffer.from("fake"));
    jest.spyOn(service as any, "uploadToStorage").mockResolvedValue("https://s3.example.com/audio.ogg");

    const result = await service.downloadAndTranscribe("media_id", "phone_id");

    expect(result.audioUrl).toBe("https://s3.example.com/audio.ogg");
    expect(result.transcript).toBe("Quero comprar uma camiseta preta tamanho M");
    expect(mockWhisper.transcribe).toHaveBeenCalledTimes(1);
  });
});
