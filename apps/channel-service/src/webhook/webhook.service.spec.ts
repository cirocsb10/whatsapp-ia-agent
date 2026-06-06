import { Test } from "@nestjs/testing";
import { WebhookService } from "./webhook.service";
import { InboundProducer } from "../queue/inbound.producer";
import { SessionService } from "../session/session.service";
import { AudioService } from "../audio/audio.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

const mockProducer = { publishInbound: jest.fn() };
const mockSession = {
  isDuplicate: jest.fn().mockResolvedValue(false),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn(),
};
const mockAudio = { downloadAndTranscribe: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue("test_token") };
const mockContact = { id: "contact-1", isOptedOut: false, phone: "5511999" };
const mockConversation = { id: "conv-1", status: "ACTIVE" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: Record<string, any> = {
  $transaction: jest.fn((fn: (tx: Record<string, unknown>) => Promise<unknown>) => fn(mockPrisma)),
  tenant: {
    findFirst: jest.fn().mockResolvedValue({ id: "tenant-uuid-123" }),
  },
  contact: {
    upsert: jest.fn().mockResolvedValue(mockContact),
    update: jest.fn().mockResolvedValue({ ...mockContact, isOptedOut: true }),
  },
  conversation: {
    findFirst: jest.fn().mockResolvedValue(mockConversation),
    create: jest.fn().mockResolvedValue(mockConversation),
    update: jest.fn(),
  },
  message: {
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  agentConfig: {
    findFirst: jest.fn().mockResolvedValue({ isPublished: true }),
  },
};

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
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(WebhookService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((fn: (tx: Record<string, unknown>) => Promise<unknown>) => fn(mockPrisma));
    mockSession.isDuplicate.mockResolvedValue(false);
    mockSession.get.mockResolvedValue(null);
    mockPrisma.tenant.findFirst.mockResolvedValue({ id: "tenant-uuid-123" });
    mockPrisma.contact.upsert.mockResolvedValue(mockContact);
    mockPrisma.conversation.findFirst.mockResolvedValue(mockConversation);
    mockPrisma.conversation.create.mockResolvedValue(mockConversation);
    mockPrisma.message.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.agentConfig.findFirst.mockResolvedValue({ isPublished: true });
  });

  it("publishes inbound event for text message", async () => {
    await service.processWebhook(makeTextPayload("Quero comprar"));
    expect(mockProducer.publishInbound).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "text",
        text: "Quero comprar",
        conversationId: "conv-1",
        contactId: "contact-1",
      }),
    );
  });

  it("skips duplicate messages", async () => {
    mockSession.isDuplicate.mockResolvedValue(true);
    await service.processWebhook(makeTextPayload("dup"));
    expect(mockProducer.publishInbound).not.toHaveBeenCalled();
  });

  it("rejects webhook when no tenant found for phone number", async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue(null);
    await service.processWebhook(makeTextPayload("Quero comprar"));
    expect(mockProducer.publishInbound).not.toHaveBeenCalled();
  });

  it("uses cached tenant ID from Redis without hitting DB", async () => {
    mockSession.get.mockImplementation((key: string) => {
      if (key.startsWith("tenant:phone:")) return Promise.resolve("cached-tenant-id");
      if (key.startsWith("agent:published:")) return Promise.resolve("true");
      return Promise.resolve(null);
    });
    await service.processWebhook(makeTextPayload("Olá"));
    expect(mockPrisma.tenant.findFirst).not.toHaveBeenCalled();
    expect(mockProducer.publishInbound).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "cached-tenant-id" }),
    );
  });

  it("faz upsert de Contact antes de publicar", async () => {
    await service.processWebhook(makeTextPayload("Olá"));
    expect(mockPrisma.contact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_phone: { tenantId: "tenant-uuid-123", phone: "5511999" } },
      }),
    );
  });

  it("cria Conversation se nao existe", async () => {
    mockPrisma.conversation.findFirst.mockResolvedValue(null);
    await service.processWebhook(makeTextPayload("Olá"));
    expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-uuid-123",
          contactId: "contact-1",
          status: "ACTIVE",
        }),
      }),
    );
  });

  it("salva Message no banco antes de publicar", async () => {
    await service.processWebhook(makeTextPayload("Olá"));
    expect(mockPrisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: "INBOUND",
          type: "TEXT",
          text: "Olá",
          waMessageId: "wamid.1",
        }),
      }),
    );
    expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { lastMessageAt: expect.any(Date) },
    });
  });

  it("opt-out persiste isOptedOut no banco e nao publica", async () => {
    await service.processWebhook(makeTextPayload("parar"));
    expect(mockPrisma.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isOptedOut: true }),
      }),
    );
    expect(mockProducer.publishInbound).not.toHaveBeenCalled();
  });

  it("bloqueia contato com isOptedOut=true e nao publica", async () => {
    mockPrisma.contact.upsert.mockResolvedValue({ ...mockContact, isOptedOut: true });
    await service.processWebhook(makeTextPayload("Olá"));
    expect(mockProducer.publishInbound).not.toHaveBeenCalled();
    expect(mockPrisma.message.create).not.toHaveBeenCalled();
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
    expect(mockPrisma.message.updateMany).toHaveBeenCalledWith({
      where: { waMessageId: "wamid.2" },
      data: { audioUrl: "http://s3/a.ogg", audioTranscript: "camiseta" },
    });
    expect(mockProducer.publishInbound).toHaveBeenCalledWith(
      expect.objectContaining({ audioId: "media_id", audioTranscript: "camiseta" }),
    );
  });

  it("não publica no RabbitMQ quando agentConfig.isPublished=false", async () => {
    mockPrisma.agentConfig.findFirst.mockResolvedValue({ isPublished: false });
    await service.processWebhook(makeTextPayload("Olá"));
    expect(mockProducer.publishInbound).not.toHaveBeenCalled();
    // Mensagem ainda deve ser salva no banco
    expect(mockPrisma.message.create).toHaveBeenCalled();
  });

  it("não publica quando agentConfig não existe (findFirst retorna null)", async () => {
    mockPrisma.agentConfig.findFirst.mockResolvedValue(null);
    await service.processWebhook(makeTextPayload("Olá"));
    expect(mockProducer.publishInbound).not.toHaveBeenCalled();
    expect(mockPrisma.message.create).toHaveBeenCalled();
    expect(mockSession.set).toHaveBeenCalledWith(
      expect.stringContaining("agent:published:"), "false", 60
    );
  });

  it("usa cache Redis para isPublished e não bate no banco na segunda chamada", async () => {
    // Primeira chamada — DB hit
    await service.processWebhook(makeTextPayload("Msg 1"));
    expect(mockPrisma.agentConfig.findFirst).toHaveBeenCalledTimes(1);
    // Deve ter escrito no cache após o DB hit
    expect(mockSession.set).toHaveBeenCalledWith(
      "agent:published:tenant-uuid-123", "true", 60
    );

    // Simular cache Redis retornando "true"
    mockSession.get.mockImplementation((key: string) => {
      if (key.startsWith("agent:published:")) return Promise.resolve("true");
      return Promise.resolve(null);
    });

    // Segunda chamada — deve usar cache, não bater no DB novamente
    await service.processWebhook(makeTextPayload("Msg 2"));
    expect(mockPrisma.agentConfig.findFirst).toHaveBeenCalledTimes(1); // ainda 1
  });
});
