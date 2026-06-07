import { Test, TestingModule } from "@nestjs/testing";
import { CrmService } from "./crm.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";

const mockPrisma = {
  funnelStage: {
    count:      jest.fn(),
    createMany: jest.fn(),
    findMany:   jest.fn(),
    findFirst:  jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
  },
  deal: {
    findMany:  jest.fn(),
    findFirst: jest.fn(),
    create:    jest.fn(),
    update:    jest.fn(),
    delete:    jest.fn(),
    count:     jest.fn(),
    aggregate: jest.fn(),
    groupBy:   jest.fn(),
  },
  contact: { findMany: jest.fn() },
};

describe("CrmService", () => {
  let service: CrmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrmService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CrmService>(CrmService);
    jest.clearAllMocks();
  });

  describe("findAllStages", () => {
    it("deve semear os 7 estágios padrão quando o tenant não tem etapas", async () => {
      mockPrisma.funnelStage.count.mockResolvedValue(0);
      mockPrisma.funnelStage.createMany.mockResolvedValue({ count: 7 });
      mockPrisma.funnelStage.findMany.mockResolvedValue([]);

      await service.findAllStages("tenant-123");

      expect(mockPrisma.funnelStage.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ name: "Novo Lead", tenantId: "tenant-123" }),
            expect.objectContaining({ name: "Ganho", isWon: true }),
            expect.objectContaining({ name: "Perdido", isLost: true }),
          ]),
        }),
      );
      expect(mockPrisma.funnelStage.createMany.mock.calls[0][0].data).toHaveLength(7);
    });

    it("não deve semear se já existem etapas", async () => {
      mockPrisma.funnelStage.count.mockResolvedValue(3);
      mockPrisma.funnelStage.findMany.mockResolvedValue([]);

      await service.findAllStages("tenant-123");

      expect(mockPrisma.funnelStage.createMany).not.toHaveBeenCalled();
    });

    it("deve ordenar etapas por position", async () => {
      mockPrisma.funnelStage.count.mockResolvedValue(2);
      mockPrisma.funnelStage.findMany.mockResolvedValue([]);

      await service.findAllStages("tenant-123");

      expect(mockPrisma.funnelStage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { position: "asc" } }),
      );
    });
  });

  describe("createStage", () => {
    it("deve criar etapa com cor padrão quando color não é informada", async () => {
      const mockStage = { id: "stage-new", tenantId: "tenant-123", name: "Nova Etapa", color: "#6366F1", position: 5 };
      mockPrisma.funnelStage.create.mockResolvedValue(mockStage);

      const result = await service.createStage("tenant-123", { name: "Nova Etapa", position: 5 });

      expect(mockPrisma.funnelStage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: "tenant-123", name: "Nova Etapa", color: "#6366F1", position: 5, isWon: false, isLost: false }),
        }),
      );
      expect(result.id).toBe("stage-new");
    });

    it("deve criar etapa com cor e flags personalizadas", async () => {
      const mockStage = { id: "stage-won", name: "Fechado", color: "#22C55E", isWon: true, isLost: false };
      mockPrisma.funnelStage.create.mockResolvedValue(mockStage);

      await service.createStage("tenant-123", { name: "Fechado", color: "#22C55E", position: 8, isWon: true });

      expect(mockPrisma.funnelStage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ color: "#22C55E", isWon: true, isLost: false }),
        }),
      );
    });
  });

  describe("updateStage", () => {
    it("deve atualizar apenas os campos fornecidos", async () => {
      mockPrisma.funnelStage.findFirst.mockResolvedValue({ id: "stage-1", tenantId: "tenant-123" });
      mockPrisma.funnelStage.update.mockResolvedValue({ id: "stage-1", name: "Atualizado" });

      await service.updateStage("tenant-123", "stage-1", { name: "Atualizado" });

      expect(mockPrisma.funnelStage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "stage-1" },
          data: { name: "Atualizado" },
        }),
      );
    });

    it("deve lançar NotFoundException para etapa de outro tenant", async () => {
      mockPrisma.funnelStage.findFirst.mockResolvedValue(null);

      await expect(service.updateStage("tenant-123", "stage-outro", { name: "X" })).rejects.toThrow(NotFoundException);
      expect(mockPrisma.funnelStage.update).not.toHaveBeenCalled();
    });

    it("não deve incluir no data campos que não foram fornecidos", async () => {
      mockPrisma.funnelStage.findFirst.mockResolvedValue({ id: "stage-1", tenantId: "tenant-123" });
      mockPrisma.funnelStage.update.mockResolvedValue({ id: "stage-1" });

      await service.updateStage("tenant-123", "stage-1", { position: 3 });

      const updateCall = mockPrisma.funnelStage.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty("name");
      expect(updateCall.data).not.toHaveProperty("color");
      expect(updateCall.data).toMatchObject({ position: 3 });
    });
  });

  describe("removeStage", () => {
    it("deve lançar BadRequestException se a etapa tiver negócios", async () => {
      mockPrisma.funnelStage.findFirst.mockResolvedValue({ id: "stage-1", tenantId: "tenant-123" });
      mockPrisma.deal.count.mockResolvedValue(3);

      await expect(service.removeStage("tenant-123", "stage-1")).rejects.toThrow(BadRequestException);
      expect(mockPrisma.funnelStage.delete).not.toHaveBeenCalled();
    });

    it("deve excluir etapa vazia sem erro", async () => {
      mockPrisma.funnelStage.findFirst.mockResolvedValue({ id: "stage-1", tenantId: "tenant-123" });
      mockPrisma.deal.count.mockResolvedValue(0);
      mockPrisma.funnelStage.delete.mockResolvedValue({});

      await service.removeStage("tenant-123", "stage-1");

      expect(mockPrisma.funnelStage.delete).toHaveBeenCalledWith({ where: { id: "stage-1" } });
    });

    it("deve lançar NotFoundException para etapa de outro tenant", async () => {
      mockPrisma.funnelStage.findFirst.mockResolvedValue(null);

      await expect(service.removeStage("tenant-123", "stage-outro")).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAllDeals", () => {
    it("deve retornar todos os deals do tenant sem filtro de etapa", async () => {
      const mockDeals = [
        { id: "deal-1", tenantId: "tenant-123", stageId: "s1" },
        { id: "deal-2", tenantId: "tenant-123", stageId: "s2" },
      ];
      mockPrisma.deal.findMany.mockResolvedValue(mockDeals);

      const result = await service.findAllDeals("tenant-123", {});

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: "tenant-123" } }),
      );
      expect(result).toHaveLength(2);
    });

    it("deve filtrar deals por stageId quando fornecido", async () => {
      mockPrisma.deal.findMany.mockResolvedValue([{ id: "deal-1", stageId: "s1" }]);

      await service.findAllDeals("tenant-123", { stageId: "s1" });

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: "tenant-123", stageId: "s1" } }),
      );
    });

    it("deve ordenar por createdAt asc", async () => {
      mockPrisma.deal.findMany.mockResolvedValue([]);

      await service.findAllDeals("tenant-123", {});

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "asc" } }),
      );
    });
  });

  describe("createDeal", () => {
    it("deve criar negócio com stageId válido do tenant", async () => {
      mockPrisma.funnelStage.findFirst.mockResolvedValue({ id: "stage-1", tenantId: "tenant-123" });
      mockPrisma.deal.create.mockResolvedValue({ id: "deal-1", title: "Venda X", stageId: "stage-1" });

      const result = await service.createDeal("tenant-123", {
        title: "Venda X",
        stageId: "stage-1",
        valueCents: 50000,
      });

      expect(result.title).toBe("Venda X");
      expect(mockPrisma.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: "tenant-123", stageId: "stage-1" }),
        }),
      );
    });

    it("deve rejeitar criação com stageId de outro tenant", async () => {
      mockPrisma.funnelStage.findFirst.mockResolvedValue(null);

      await expect(
        service.createDeal("tenant-123", { title: "Deal", stageId: "stage-outro" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateDeal", () => {
    it("deve atualizar campos do deal e verificar tenancy", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({ id: "deal-1", tenantId: "tenant-123" });
      mockPrisma.deal.update.mockResolvedValue({ id: "deal-1", title: "Novo título", valueCents: 75000 });

      const result = await service.updateDeal("tenant-123", "deal-1", { title: "Novo título", valueCents: 75000 });

      expect(mockPrisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "deal-1" },
          data: expect.objectContaining({ title: "Novo título", valueCents: 75000 }),
        }),
      );
      expect(result.title).toBe("Novo título");
    });

    it("deve validar o novo stageId quando fornecido", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({ id: "deal-1", tenantId: "tenant-123" });
      mockPrisma.funnelStage.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDeal("tenant-123", "deal-1", { stageId: "stage-invalido" }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.deal.update).not.toHaveBeenCalled();
    });

    it("deve lançar NotFoundException para deal de outro tenant", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(null);

      await expect(service.updateDeal("tenant-123", "deal-outro", { title: "X" })).rejects.toThrow(NotFoundException);
    });

    it("não deve incluir no data campos que não foram fornecidos", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({ id: "deal-1", tenantId: "tenant-123" });
      mockPrisma.deal.update.mockResolvedValue({ id: "deal-1" });

      await service.updateDeal("tenant-123", "deal-1", { title: "Só título" });

      const updateCall = mockPrisma.deal.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty("valueCents");
      expect(updateCall.data).not.toHaveProperty("notes");
      expect(updateCall.data).toMatchObject({ title: "Só título" });
    });
  });

  describe("removeDeal", () => {
    it("deve excluir deal existente do tenant", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({ id: "deal-1", tenantId: "tenant-123" });
      mockPrisma.deal.delete.mockResolvedValue({});

      await service.removeDeal("tenant-123", "deal-1");

      expect(mockPrisma.deal.delete).toHaveBeenCalledWith({ where: { id: "deal-1" } });
    });

    it("deve lançar NotFoundException para deal de outro tenant", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(null);

      await expect(service.removeDeal("tenant-123", "deal-outro")).rejects.toThrow(NotFoundException);
      expect(mockPrisma.deal.delete).not.toHaveBeenCalled();
    });
  });

  describe("moveDeal", () => {
    it("deve mover deal para nova etapa do mesmo tenant", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({ id: "deal-1", tenantId: "tenant-123" });
      mockPrisma.funnelStage.findFirst.mockResolvedValue({ id: "stage-2", tenantId: "tenant-123" });
      mockPrisma.deal.update.mockResolvedValue({ id: "deal-1", stageId: "stage-2" });

      await service.moveDeal("tenant-123", "deal-1", { stageId: "stage-2" });

      expect(mockPrisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "deal-1" }, data: { stageId: "stage-2" } }),
      );
    });

    it("deve lançar NotFoundException para deal inexistente", async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(null);

      await expect(service.moveDeal("tenant-123", "nao-existe", { stageId: "stage-1" })).rejects.toThrow(NotFoundException);
    });
  });

  describe("getStats", () => {
    it("deve retornar pipelineValueCents, openCount e byStage", async () => {
      mockPrisma.funnelStage.findMany
        .mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }])
        .mockResolvedValueOnce([
          { id: "s1", name: "Novo Lead", color: "#6366F1" },
          { id: "s2", name: "Qualificado", color: "#F59E0B" },
        ]);
      mockPrisma.deal.aggregate.mockResolvedValue({ _sum: { valueCents: 150000 } });
      mockPrisma.deal.count.mockResolvedValue(3);
      mockPrisma.deal.groupBy.mockResolvedValue([
        { stageId: "s1", _count: { _all: 2 }, _sum: { valueCents: 100000 } },
        { stageId: "s2", _count: { _all: 1 }, _sum: { valueCents: 50000 } },
      ]);

      const result = await service.getStats("tenant-123");

      expect(result.pipelineValueCents).toBe(150000);
      expect(result.openCount).toBe(3);
      expect(result.byStage[0]).toMatchObject({ stageId: "s1", stageName: "Novo Lead", count: 2 });
    });

    it("deve retornar zeros quando não há negócios", async () => {
      mockPrisma.funnelStage.findMany.mockResolvedValue([]);
      mockPrisma.deal.aggregate.mockResolvedValue({ _sum: { valueCents: null } });
      mockPrisma.deal.count.mockResolvedValue(0);
      mockPrisma.deal.groupBy.mockResolvedValue([]);

      const result = await service.getStats("tenant-vazio");

      expect(result.pipelineValueCents).toBe(0);
      expect(result.openCount).toBe(0);
      expect(result.byStage).toHaveLength(0);
    });
  });

  describe("searchContacts", () => {
    it("deve filtrar contatos por nome e limitar a 20 resultados", async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        { id: "c1", name: "João Silva", phone: "11999991111" },
      ]);

      const result = await service.searchContacts("tenant-123", "João");

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-123" }), take: 20 }),
      );
      expect(result[0]?.name).toBe("João Silva");
    });

    it("deve retornar todos os contatos quando q está vazio", async () => {
      mockPrisma.contact.findMany.mockResolvedValue([]);

      await service.searchContacts("tenant-123", "");

      const call = mockPrisma.contact.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty("OR");
    });
  });
});
