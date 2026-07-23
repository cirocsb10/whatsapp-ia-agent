import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { OutboundConsumer } from "./outbound.consumer";
import { MessagingService } from "../messaging/messaging.service";
import { PrismaService } from "../prisma/prisma.service";
import { InboundProducer } from "./inbound.producer";
import { InactivitySchedulerService } from "./inactivity-scheduler.service";

const mockMessaging = { sendMessage: jest.fn().mockResolvedValue("wa-msg-id") };
const mockConfig = { get: jest.fn().mockReturnValue("amqp://localhost") };
const mockPrisma = {
  message: { create: jest.fn().mockResolvedValue({ id: "msg-1" }) },
  whatsappChannel: { findUnique: jest.fn().mockResolvedValue(null) },
  tenant: { findFirst: jest.fn().mockResolvedValue(null) },
};
const mockInbound = { publishOutbound: jest.fn().mockResolvedValue(undefined) };
const mockInactivityScheduler = { schedule: jest.fn().mockResolvedValue(undefined) };

describe("OutboundConsumer.handleOutboundMessage", () => {
  let consumer: OutboundConsumer;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OutboundConsumer,
        { provide: MessagingService, useValue: mockMessaging },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InboundProducer, useValue: mockInbound },
        { provide: InactivitySchedulerService, useValue: mockInactivityScheduler },
      ],
    }).compile();
    consumer = module.get(OutboundConsumer);
    jest.clearAllMocks();
    mockMessaging.sendMessage.mockResolvedValue("wa-msg-id");
    mockPrisma.message.create.mockResolvedValue({ id: "msg-1" });
    mockPrisma.whatsappChannel.findUnique.mockResolvedValue(null);
    mockPrisma.tenant.findFirst.mockResolvedValue(null);
    mockInbound.publishOutbound.mockResolvedValue(undefined);
    jest.useFakeTimers();
  });

  afterEach(() => jest.useRealTimers());

  it("calls sendMessage for each outbound message", async () => {
    const promise = consumer.handleOutboundMessage({
      waPhoneId: "phone-001",
      toPhone: "5511999990000",
      messages: [
        { type: "text", text: "Msg 1" },
        { type: "text", text: "Msg 2" },
      ],
    });

    await jest.runAllTimersAsync();
    await promise;

    expect(mockMessaging.sendMessage).toHaveBeenCalledTimes(2);
    expect(mockMessaging.sendMessage).toHaveBeenNthCalledWith(
      1,
      "phone-001",
      "5511999990000",
      { type: "text", text: "Msg 1" },
      undefined,
    );
  });

  it("forwards imageUrl for image messages", async () => {
    const promise = consumer.handleOutboundMessage({
      waPhoneId: "phone-001",
      toPhone: "5511999990000",
      messages: [{ type: "image", imageUrl: "https://img.test/a.png" }],
    });

    await jest.runAllTimersAsync();
    await promise;

    expect(mockMessaging.sendMessage).toHaveBeenCalledWith(
      "phone-001",
      "5511999990000",
      { type: "image", imageUrl: "https://img.test/a.png" },
      undefined,
    );
  });

  it("loads token by channelId and passes it to sendMessage", async () => {
    mockPrisma.whatsappChannel.findUnique.mockResolvedValue({ metaAccessToken: "ch-token" });

    const promise = consumer.handleOutboundMessage({
      channelId: "ch-1",
      waPhoneId: "phone-001",
      toPhone: "5511999990000",
      messages: [{ type: "text", text: "Hi" }],
    });

    await jest.runAllTimersAsync();
    await promise;

    expect(mockPrisma.whatsappChannel.findUnique).toHaveBeenCalledWith({
      where: { id: "ch-1" },
      select: { metaAccessToken: true },
    });
    expect(mockMessaging.sendMessage).toHaveBeenCalledWith(
      "phone-001",
      "5511999990000",
      { type: "text", text: "Hi" },
      "ch-token",
    );
  });

  it("loads token by waPhoneId when channelId missing", async () => {
    mockPrisma.whatsappChannel.findUnique.mockResolvedValue({ metaAccessToken: "phone-token" });

    const promise = consumer.handleOutboundMessage({
      waPhoneId: "phone-001",
      toPhone: "5511999990000",
      messages: [{ type: "text", text: "Hi" }],
    });

    await jest.runAllTimersAsync();
    await promise;

    expect(mockPrisma.whatsappChannel.findUnique).toHaveBeenCalledWith({
      where: { whatsappPhoneId: "phone-001" },
      select: { metaAccessToken: true },
    });
    expect(mockMessaging.sendMessage).toHaveBeenCalledWith(
      "phone-001",
      "5511999990000",
      { type: "text", text: "Hi" },
      "phone-token",
    );
  });
});
