import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { EventsGateway } from "../gateways/events.gateway";
import { InboxEventsConsumer } from "./inbox-events.consumer";

const mockConfig = { get: jest.fn().mockReturnValue("amqp://localhost") };
const mockGateway = { emitToTenant: jest.fn() };

function makeMsg(payload: Record<string, unknown>) {
  return {
    content: Buffer.from(JSON.stringify(payload)),
  } as any;
}

describe("InboxEventsConsumer", () => {
  let consumer: InboxEventsConsumer;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InboxEventsConsumer,
        { provide: ConfigService, useValue: mockConfig },
        { provide: EventsGateway, useValue: mockGateway },
      ],
    }).compile();
    consumer = module.get(InboxEventsConsumer);
    jest.clearAllMocks();

    // Inject a mock channel so private methods can run
    (consumer as any).channel = { ack: jest.fn(), nack: jest.fn() };
  });

  describe("handleInbound (private)", () => {
    it("emite new_message ao gateway para mensagem de texto", () => {
      const msg = makeMsg({
        tenantId: "t-1",
        conversationId: "c-1",
        waMessageId: "wa-1",
        type: "text",
        text: "Olá",
        timestamp: 1700000000,
      });

      (consumer as any).handleInbound(msg);

      expect(mockGateway.emitToTenant).toHaveBeenCalledWith(
        "t-1",
        expect.objectContaining({
          type: "new_message",
          payload: expect.objectContaining({
            conversationId: "c-1",
            direction: "inbound",
            text: "Olá",
          }),
        }),
      );
    });

    it("usa audioTranscript como texto quando text e undefined", () => {
      const msg = makeMsg({
        tenantId: "t-1",
        conversationId: "c-1",
        type: "audio",
        audioTranscript: "transcrição de audio",
      });

      (consumer as any).handleInbound(msg);

      const call = mockGateway.emitToTenant.mock.calls[0];
      expect(call[1].payload.text).toBe("transcrição de audio");
    });

    it("nao emite quando tenantId esta ausente", () => {
      const msg = makeMsg({ conversationId: "c-1", text: "Oi" });

      (consumer as any).handleInbound(msg);

      expect(mockGateway.emitToTenant).not.toHaveBeenCalled();
    });

    it("ignora msg null", () => {
      expect(() => (consumer as any).handleInbound(null)).not.toThrow();
      expect(mockGateway.emitToTenant).not.toHaveBeenCalled();
    });
  });

  describe("handleStatus (private)", () => {
    it("emite message_status_changed com campos corretos", () => {
      const msg = makeMsg({
        tenantId: "t-1",
        conversationId: "c-1",
        waMessageId: "wa-99",
        status: "delivered",
      });

      (consumer as any).handleStatus(msg);

      expect(mockGateway.emitToTenant).toHaveBeenCalledWith(
        "t-1",
        expect.objectContaining({
          type: "message_status_changed",
          payload: { conversationId: "c-1", waMessageId: "wa-99", status: "delivered" },
        }),
      );
    });

    it("nao emite quando faltam campos obrigatorios", () => {
      const msg = makeMsg({ tenantId: "t-1" });

      (consumer as any).handleStatus(msg);

      expect(mockGateway.emitToTenant).not.toHaveBeenCalled();
    });
  });

  describe("handleOutbound (private)", () => {
    it("emite new_message de saida ao gateway", () => {
      const msg = makeMsg({
        tenantId: "t-1",
        conversationId: "c-1",
        messageId: "msg-1",
        type: "TEXT",
        text: "Resposta do AI",
        sentAt: new Date().toISOString(),
        isFromAi: true,
      });

      (consumer as any).handleOutbound(msg);

      expect(mockGateway.emitToTenant).toHaveBeenCalledWith(
        "t-1",
        expect.objectContaining({
          type: "new_message",
          payload: expect.objectContaining({
            direction: "outbound",
            text: "Resposta do AI",
            messageStatus: "sent",
          }),
        }),
      );
    });

    it("nao emite quando tenantId ou conversationId estao ausentes", () => {
      const msg = makeMsg({ messageId: "msg-1", text: "x" });

      (consumer as any).handleOutbound(msg);

      expect(mockGateway.emitToTenant).not.toHaveBeenCalled();
    });
  });
});
