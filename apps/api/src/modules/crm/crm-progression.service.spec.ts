import { Test } from "@nestjs/testing";
import { CrmProgressionService } from "./crm-progression.service";
import { PrismaService } from "../../common/prisma/prisma.service";

const mockDeal     = { id: "deal-1", stageId: "stage-0", stage: { position: 0, isWon: false } };
const mockStage1   = { id: "stage-1", position: 1, isWon: false };
const mockWonStage = { id: "stage-won", position: 5, isWon: true };

const mockPrisma = {
  deal: { findFirst: jest.fn(), update: jest.fn() },
  funnelStage: { findFirst: jest.fn() },
  agentConfig: { findUnique: jest.fn() },
};

describe("CrmProgressionService", () => {
  let service: CrmProgressionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.agentConfig.findUnique.mockResolvedValue({ crmProgressionEnabled: true });
    const module = await Test.createTestingModule({
      providers: [
        CrmProgressionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(CrmProgressionService);
  });

  describe("advanceToPosition", () => {
    it("avança deal quando position atual é menor que alvo", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(mockStage1);
      mockPrisma.deal.update.mockResolvedValue({});

      await service.advanceToPosition("tenant-1", "contact-1", 1);

      expect(mockPrisma.deal.update).toHaveBeenCalledWith({
        where: { id: "deal-1" },
        data: { stageId: "stage-1" },
      });
    });

    it("não avança quando deal já está em position igual ou maior", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({ ...mockDeal, stage: { position: 2, isWon: false } });
      await service.advanceToPosition("tenant-1", "contact-1", 1);
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });

    it("não faz nada quando contato não tem deal", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(null);
      await service.advanceToPosition("tenant-1", "contact-1", 1);
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });

    it("não faz nada quando stage alvo não existe", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(null);
      await service.advanceToPosition("tenant-1", "contact-1", 1);
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });

    it("não avança quando crmProgressionEnabled está desabilitado", async () => {
      mockPrisma.agentConfig.findUnique.mockResolvedValue({ crmProgressionEnabled: false });
      await service.advanceToPosition("tenant-1", "contact-1", 1);
      expect(mockPrisma.deal.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });

    it("avança quando tenant não tem AgentConfig (default true)", async () => {
      mockPrisma.agentConfig.findUnique.mockResolvedValue(null);
      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(mockStage1);
      mockPrisma.deal.update.mockResolvedValue({});

      await service.advanceToPosition("tenant-1", "contact-1", 1);

      expect(mockPrisma.deal.update).toHaveBeenCalled();
    });
  });

  describe("advanceToWon", () => {
    it("move deal para stage isWon e seta closedAt", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(mockWonStage);
      mockPrisma.deal.update.mockResolvedValue({});

      await service.advanceToWon("tenant-1", "contact-1");

      expect(mockPrisma.deal.update).toHaveBeenCalledWith({
        where: { id: "deal-1" },
        data: { stageId: "stage-won", closedAt: expect.any(Date) },
      });
    });

    it("não avança quando deal já está em isWon", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({ ...mockDeal, stage: { position: 5, isWon: true } });
      await service.advanceToWon("tenant-1", "contact-1");
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });

    it("não faz nada quando não existe stage isWon configurado", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(null);
      await service.advanceToWon("tenant-1", "contact-1");
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });

    it("não avança quando crmProgressionEnabled está desabilitado", async () => {
      mockPrisma.agentConfig.findUnique.mockResolvedValue({ crmProgressionEnabled: false });
      await service.advanceToWon("tenant-1", "contact-1");
      expect(mockPrisma.deal.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });
  });
});
