import { Test } from "@nestjs/testing";
import { PaymentsService } from "./payments.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

const mockPrisma = {
  payment: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
  order: { update: jest.fn(), findFirst: jest.fn() },
};
const mockConfig = { get: (key: string) => "test_mp_token" };

jest.mock("mercadopago", () => ({
  MercadoPagoConfig: jest.fn(),
  Payment: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({
      id: "mp_payment_id_123",
      status: "pending",
      point_of_interaction: { transaction_data: { qr_code: "00020101...", qr_code_base64: "abc" } },
    }),
    get: jest.fn().mockResolvedValue({ id: "mp_payment_id_123", status: "approved", external_reference: "order-uuid" }),
  })),
}), { virtual: true });

describe("PaymentsService", () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  it("deve gerar pagamento Pix e persistir no banco", async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: "order-uuid", totalCents: 9990, orderNumber: "ORD-001",
      contact: { phone: "5511999999999", name: "João", email: null, cpf: null },
      items: [],
    });
    mockPrisma.payment.create.mockResolvedValue({ id: "pay-uuid", pixCopyPaste: "00020101..." });
    mockPrisma.order.update.mockResolvedValue({});

    const result = await service.generatePix("tenant-123", "order-uuid");

    expect(result.pixCopyPaste).toBeDefined();
    expect(mockPrisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ method: "PIX", status: "PENDING" }) }),
    );
  });

  it("deve processar webhook de confirmação e atualizar pedido", async () => {
    mockPrisma.payment.findFirst.mockResolvedValue({ id: "pay-uuid", orderId: "order-uuid", tenantId: "tenant-123" });
    mockPrisma.payment.update.mockResolvedValue({ id: "pay-uuid" });
    mockPrisma.order.update.mockResolvedValue({ id: "order-uuid", status: "PAYMENT_CONFIRMED" });

    await service.handleWebhook({ type: "payment", data: { id: "mp_payment_id_123" } });

    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PAYMENT_CONFIRMED" }) }),
    );
  });
});
