import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { PlansService } from "./plans.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PlatformSettingsService } from "../platform-settings/platform-settings.service";

const mockPrisma = {
  tenant: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  platformBilling: {
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockSettings = {
  getSettings: jest.fn(),
};

describe("PlansService", () => {
  let service: PlansService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlatformSettingsService, useValue: mockSettings },
      ],
    }).compile();

    service = module.get(PlansService);
    jest.clearAllMocks();
    mockSettings.getSettings.mockResolvedValue({
      defaultConversationsLimit: 100,
      planConversationLimits: {
        STARTER: 100,
        GROWTH: 1000,
        SCALE: 5000,
        ENTERPRISE: 20000,
      },
    });
  });

  it("overview trata billing nulo", async () => {
    mockPrisma.tenant.findMany.mockResolvedValue([
      {
        id: "t1",
        name: "Acme",
        slug: "acme",
        status: "ACTIVE",
        planType: "STARTER",
        stripeSubId: null,
        stripeCustomerId: null,
        createdAt: new Date(),
        billing: null,
      },
    ]);
    mockPrisma.tenant.count.mockResolvedValue(1);

    const result = await service.getOverview(1, 25);
    const first = result.items[0];

    expect(first).toBeDefined();
    expect(first!.billing).toBeNull();
    expect(first!.usage.conversationsLimit).toBe(100);
    expect(first!.hasStripeSubscription).toBe(false);
  });

  it("override atualiza tenant e billing sem tocar Stripe", async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: "t1",
      planType: "STARTER",
      billing: {
        currentPlan: "STARTER",
        conversationsLimit: 100,
        conversationsThisMonth: 10,
      },
    });

    mockPrisma.$transaction.mockImplementation(async (fn) =>
      fn({
        tenant: {
          update: jest.fn().mockResolvedValue({ id: "t1", planType: "GROWTH" }),
        },
        platformBilling: {
          update: jest.fn().mockResolvedValue({
            currentPlan: "GROWTH",
            conversationsLimit: 1000,
            conversationsThisMonth: 10,
          }),
        },
      }),
    );

    const result = await service.overridePlan("t1", { planType: "GROWTH" });

    expect(result.planType).toBe("GROWTH");
    expect(result.warning).toContain("Stripe");
    expect(result.billing?.conversationsLimit).toBe(1000);
  });

  it("override lança NotFound quando tenant não existe", async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    await expect(
      service.overridePlan("missing", { planType: "GROWTH" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
