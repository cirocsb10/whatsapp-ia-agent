import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../../common/prisma/prisma.service";
import { KnowledgeService } from "./knowledge.service";

const mockPrisma = {
  knowledgeBase: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
};

describe("KnowledgeService", () => {
  let service: KnowledgeService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [KnowledgeService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(KnowledgeService);
    jest.clearAllMocks();
  });

  it("creates tenant-scoped knowledge", async () => {
    mockPrisma.knowledgeBase.create.mockResolvedValue({ id: "kb-1" });

    await service.create("t-1", { name: "FAQ", type: "TEXT", content: "Perguntas" });

    expect(mockPrisma.knowledgeBase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "t-1", name: "FAQ", isIndexed: false }),
    });
  });

  it("throws before deleting knowledge outside tenant", async () => {
    mockPrisma.knowledgeBase.findFirst.mockResolvedValue(null);

    await expect(service.remove("t-1", "kb-1")).rejects.toThrow(NotFoundException);
  });
});
