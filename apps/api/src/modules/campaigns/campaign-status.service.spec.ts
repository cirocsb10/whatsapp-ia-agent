import { Test } from "@nestjs/testing";
import { CampaignStatusService } from "./campaign-status.service";
import { PrismaService } from "../../common/prisma/prisma.service";

const mockPrisma = {
  campaignRecipient: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

describe("CampaignStatusService", () => {
  let service: CampaignStatusService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CampaignStatusService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(CampaignStatusService);
  });

  describe("mapMetaStatus", () => {
    it("mapeia sent → SENT", () => {
      expect(service.mapMetaStatus("sent")).toBe("SENT");
    });
    it("mapeia delivered → DELIVERED", () => {
      expect(service.mapMetaStatus("delivered")).toBe("DELIVERED");
    });
    it("mapeia read → READ", () => {
      expect(service.mapMetaStatus("read")).toBe("READ");
    });
    it("mapeia failed → FAILED", () => {
      expect(service.mapMetaStatus("failed")).toBe("FAILED");
    });
  });

  describe("applyStatusUpdate", () => {
    it("no-op quando waMessageId desconhecido", async () => {
      mockPrisma.campaignRecipient.findFirst.mockResolvedValue(null);
      const ok = await service.applyStatusUpdate({
        tenantId: "t1",
        waMessageId: "wamid.unknown",
        status: "delivered",
        timestamp: 1700000000,
      });
      expect(ok).toBe(false);
      expect(mockPrisma.campaignRecipient.update).not.toHaveBeenCalled();
    });

    it("atualiza para DELIVERED com deliveredAt", async () => {
      mockPrisma.campaignRecipient.findFirst.mockResolvedValue({
        id: "r1",
        status: "SENT",
      });
      mockPrisma.campaignRecipient.update.mockResolvedValue({});

      const ok = await service.applyStatusUpdate({
        tenantId: "t1",
        waMessageId: "wamid.1",
        status: "delivered",
        timestamp: 1700000000,
      });

      expect(ok).toBe(true);
      expect(mockPrisma.campaignRecipient.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(1700000000 * 1000),
        },
      });
    });

    it("não regride READ → SENT", async () => {
      mockPrisma.campaignRecipient.findFirst.mockResolvedValue({
        id: "r1",
        status: "READ",
      });

      await service.applyStatusUpdate({
        tenantId: "t1",
        waMessageId: "wamid.1",
        status: "sent",
        timestamp: 1700000000,
      });

      expect(mockPrisma.campaignRecipient.update).not.toHaveBeenCalled();
    });

    it("FAILED sobrescreve DELIVERED", async () => {
      mockPrisma.campaignRecipient.findFirst.mockResolvedValue({
        id: "r1",
        status: "DELIVERED",
      });
      mockPrisma.campaignRecipient.update.mockResolvedValue({});

      await service.applyStatusUpdate({
        tenantId: "t1",
        waMessageId: "wamid.1",
        status: "failed",
        timestamp: 1700000001,
        failureReason: "undeliverable",
      });

      expect(mockPrisma.campaignRecipient.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: {
          status: "FAILED",
          failedAt: new Date(1700000001 * 1000),
          failureReason: "undeliverable",
        },
      });
    });
  });
});
