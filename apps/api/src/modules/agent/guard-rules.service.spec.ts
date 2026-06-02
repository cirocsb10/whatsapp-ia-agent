import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../../common/prisma/prisma.service";
import { GuardRulesService } from "./guard-rules.service";

const mockPrisma = {
  guardRule: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe("GuardRulesService", () => {
  let service: GuardRulesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [GuardRulesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(GuardRulesService);
    jest.clearAllMocks();
  });

  it("creates active rule with default priority", async () => {
    mockPrisma.guardRule.create.mockResolvedValue({ id: "r-1" });

    await service.create("t-1", {
      name: "Bloqueia desconto",
      type: "TEXT_BLOCK",
      action: "BLOCK",
      config: { term: "desconto" },
    });

    expect(mockPrisma.guardRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "t-1", priority: 100 }),
    });
  });

  it("throws before updating rule outside tenant", async () => {
    mockPrisma.guardRule.findFirst.mockResolvedValue(null);

    await expect(service.update("t-1", "r-1", { isActive: false })).rejects.toThrow(NotFoundException);
  });
});
