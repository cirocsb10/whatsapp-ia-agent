import { Test } from "@nestjs/testing";
import { BillingService } from "./billing.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

const mockStripe = {
  customers: { create: jest.fn().mockResolvedValue({ id: "cus_test" }) },
  checkout: { sessions: { create: jest.fn().mockResolvedValue({ id: "cs_test", url: "https://checkout.stripe.com/..." }) } },
  webhooks: { constructEvent: jest.fn() },
};
jest.mock("stripe", () => jest.fn().mockImplementation(() => mockStripe));

const mockPrisma = { tenant: { findUnique: jest.fn(), update: jest.fn() } };

describe("BillingService", () => {
  let service: BillingService;
  beforeEach(async () => {
    const configGetMock = jest.fn().mockImplementation((key: string) => {
      const values: Record<string, string> = {
        STRIPE_SECRET_KEY: "sk_test",
        STRIPE_WEBHOOK_SECRET: "whsec_test",
        STRIPE_PRICE_STARTER_MONTHLY: "price_starter",
        STRIPE_PRICE_GROWTH_MONTHLY: "price_growth",
        STRIPE_PRICE_SCALE_MONTHLY: "price_scale",
        FRONTEND_URL: "http://localhost:3000",
      };
      return values[key];
    });
    const module = await Test.createTestingModule({ providers: [BillingService, { provide: PrismaService, useValue: mockPrisma }, { provide: ConfigService, useValue: { get: configGetMock } }] }).compile();
    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
  });

  it("deve criar sessão Stripe Checkout", async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ id: "t-123", name: "Loja Teste" });
    const result = await service.createCheckoutSession("t-123", "GROWTH");
    expect(result.checkoutUrl).toContain("stripe.com");
  });

  it("deve processar webhook de subscription activada", async () => {
    const event = { type: "customer.subscription.updated", data: { object: { id: "sub_test", status: "active", metadata: { tenantId: "t-123" }, items: { data: [{ price: { id: "price_growth" } }] } } } };
    mockStripe.webhooks.constructEvent.mockReturnValue(event);
    await service.handleWebhook(Buffer.from("payload"), "test_sig");
    expect(mockPrisma.tenant.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "t-123" } }));
  });
});
