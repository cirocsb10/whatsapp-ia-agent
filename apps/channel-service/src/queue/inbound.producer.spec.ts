import { Test } from "@nestjs/testing";
import { InboundProducer } from "./inbound.producer";
import { ConfigService } from "@nestjs/config";

// Define channel and connection mocks at module level so they're available
// before jest.mock hoisting
const mockChannel = {
  assertExchange: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockReturnValue(true),
  close: jest.fn(),
};

const mockConnection = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
  close: jest.fn(),
};

// Use a factory that references module-scope vars (jest hoists mock calls but
// the variables are initialized before the first test runs due to closure)
jest.mock("amqplib", () => {
  // We can't reference outer vars here due to hoisting, so return lazy functions
  return {
    connect: jest.fn(),
  };
});

describe("InboundProducer", () => {
  let producer: InboundProducer;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const amqplib = require("amqplib") as { connect: jest.Mock };

  beforeEach(async () => {
    amqplib.connect.mockResolvedValue(mockConnection);
    mockConnection.createChannel.mockResolvedValue(mockChannel);
    mockChannel.assertExchange.mockResolvedValue(undefined);
    mockChannel.publish.mockReturnValue(true);

    const module = await Test.createTestingModule({
      providers: [
        InboundProducer,
        { provide: ConfigService, useValue: { get: () => "amqp://localhost:5672" } },
      ],
    }).compile();
    producer = module.get(InboundProducer);
    await producer.onModuleInit();
    jest.clearAllMocks();
    // Re-setup publish mock after clearAllMocks
    mockChannel.publish.mockReturnValue(true);
  });

  it("publishes event to correct exchange", async () => {
    const event = { tenantId: "t1", type: "text", text: "Olá", from: "5511999" };
    await producer.publishInbound(event);

    expect(mockChannel.publish).toHaveBeenCalledWith(
      "messages",
      "msg.inbound",
      expect.any(Buffer),
      expect.objectContaining({ persistent: true }),
    );

    const buf = mockChannel.publish.mock.calls[0][2] as Buffer;
    const parsed = JSON.parse(buf.toString());
    expect(parsed.tenantId).toBe("t1");
    expect(parsed.text).toBe("Olá");
  });
});
