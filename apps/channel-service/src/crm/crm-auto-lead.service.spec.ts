import { Test } from "@nestjs/testing";
import { CrmAutoLeadService } from "./crm-auto-lead.service";
import { PrismaService } from "../prisma/prisma.service";

const mockFirstStage = { id: "stage-0", name: "Novo Lead", position: 0 };
const mockLostStage  = { id: "stage-lost", name: "Perdido", isLost: true };
const mockDeal       = { id: "deal-1", title: "5511999", stageId: "stage-0" };

const mockPrisma = {
  funnelStage: { findFirst: jest.fn() },
  deal: { count: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
};

describe("CrmAutoLeadService", () => {
  let service: CrmAutoLeadService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CrmAutoLeadService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(CrmAutoLeadService);
  });

  describe("maybeCreateLead", () => {
    it("cria deal em Novo Lead quando contato é novo e stage existe", async () => {
      mockPrisma.deal.count.mockResolvedValue(0);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(mockFirstStage);
      mockPrisma.deal.create.mockResolvedValue(mockDeal);

      await service.maybeCreateLead("tenant-1", "contact-1", "5511999");

      expect(mockPrisma.deal.create).toHaveBeenCalledWith({
        data: { tenantId: "tenant-1", stageId: "stage-0", contactId: "contact-1", title: "5511999", valueCents: 0 },
      });
    });

    it("usa nome do contato como título quando disponível", async () => {
      mockPrisma.deal.count.mockResolvedValue(0);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(mockFirstStage);
      mockPrisma.deal.create.mockResolvedValue(mockDeal);

      await service.maybeCreateLead("tenant-1", "contact-1", "5511999", "João Silva");

      expect(mockPrisma.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: "João Silva" }) }),
      );
    });

    it("não cria deal quando contato já tem deals", async () => {
      mockPrisma.deal.count.mockResolvedValue(2);
      await service.maybeCreateLead("tenant-1", "contact-1", "5511999");
      expect(mockPrisma.deal.create).not.toHaveBeenCalled();
    });

    it("não cria deal quando não existem stages", async () => {
      mockPrisma.deal.count.mockResolvedValue(0);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(null);
      await service.maybeCreateLead("tenant-1", "contact-1", "5511999");
      expect(mockPrisma.deal.create).not.toHaveBeenCalled();
    });
  });

  describe("advanceToLost", () => {
    it("move deal para stage isLost quando opt-out", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(mockLostStage);
      mockPrisma.deal.update.mockResolvedValue({});

      await service.advanceToLost("tenant-1", "contact-1");

      expect(mockPrisma.deal.update).toHaveBeenCalledWith({
        where: { id: "deal-1" },
        data: { stageId: "stage-lost", closedAt: expect.any(Date) },
      });
    });

    it("não faz nada quando contato não tem deal", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(null);
      await service.advanceToLost("tenant-1", "contact-1");
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });

    it("não faz nada quando não existe stage isLost configurado", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(mockDeal);
      mockPrisma.funnelStage.findFirst.mockResolvedValue(null);
      await service.advanceToLost("tenant-1", "contact-1");
      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });
  });
});
