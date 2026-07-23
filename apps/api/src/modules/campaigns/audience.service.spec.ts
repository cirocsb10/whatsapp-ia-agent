import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { AudienceService } from "./audience.service";
import { PrismaService } from "../../common/prisma/prisma.service";

const mockPrisma = {
  contact: { findMany: jest.fn() },
  deal: { findMany: jest.fn() },
  funnelStage: { findFirst: jest.fn() },
};

describe("AudienceService", () => {
  let service: AudienceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AudienceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(AudienceService);
  });

  it("type=all exclui isOptedOut=true", async () => {
    mockPrisma.contact.findMany.mockResolvedValue([{ id: "c1", phone: "5511", name: "A" }]);

    await service.buildAudience("tenant-1", { type: "all" });

    expect(mockPrisma.contact.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", isOptedOut: false },
      select: { id: true, phone: true, name: true },
    });
  });

  it("type=crm_stage exclui opted-out e filtra por deals do estágio", async () => {
    mockPrisma.funnelStage.findFirst.mockResolvedValue({ id: "stage-1" });
    mockPrisma.deal.findMany.mockResolvedValue([
      { contactId: "c1" },
      { contactId: "c2" },
      { contactId: "c1" },
    ]);
    mockPrisma.contact.findMany.mockResolvedValue([
      { id: "c1", phone: "5511", name: "A" },
    ]);

    const result = await service.buildAudience("tenant-1", {
      type: "crm_stage",
      stageId: "stage-1",
    });

    expect(mockPrisma.deal.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", stageId: "stage-1" },
      select: { contactId: true },
    });
    expect(mockPrisma.contact.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        isOptedOut: false,
        id: { in: ["c1", "c2"] },
      },
      select: { id: true, phone: true, name: true },
    });
    expect(result).toHaveLength(1);
  });

  it("crm_stage sem stageId lança BadRequest", async () => {
    await expect(
      service.buildAudience("tenant-1", { type: "crm_stage", stageId: "" as string }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
