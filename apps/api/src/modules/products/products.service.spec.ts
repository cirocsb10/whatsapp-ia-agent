import { Test, TestingModule } from "@nestjs/testing";
import { ProductsService } from "./products.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";

const mockPrisma = {
  product: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

describe("ProductsService", () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  it("deve criar produto com campos obrigatórios", async () => {
    const mockProduct = { id: "prod-uuid", tenantId: "tenant-123", name: "Camiseta Preta", priceCents: 5990, stockQty: 10 };
    mockPrisma.product.create.mockResolvedValue(mockProduct);
    const result = await service.create("tenant-123", { name: "Camiseta Preta", priceCents: 5990, stockQty: 10 });
    expect(result.name).toBe("Camiseta Preta");
    expect(mockPrisma.product.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: "tenant-123", name: "Camiseta Preta" }),
    }));
  });

  it("deve filtrar produtos apenas do tenant correto", async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);
    await service.findAll("tenant-123", { page: 1, limit: 20 });
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: "tenant-123" }),
    }));
  });

  it("deve rejeitar acesso a produto de outro tenant", async () => {
    mockPrisma.product.findFirst.mockResolvedValue(null);
    await expect(service.findOne("tenant-123", "prod-de-outro-tenant")).rejects.toThrow(NotFoundException);
  });

  describe("getStats", () => {
    it("deve retornar contagens corretas por status", async () => {
      mockPrisma.product.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7)  // active
        .mockResolvedValueOnce(2)  // inactive
        .mockResolvedValueOnce(1); // out_of_stock

      const result = await service.getStats("tenant-123");

      expect(result).toEqual({ total: 10, active: 7, inactive: 2, outOfStock: 1 });
      expect(mockPrisma.product.count).toHaveBeenCalledTimes(4);
      expect(mockPrisma.product.count).toHaveBeenCalledWith({ where: { tenantId: "tenant-123" } });
      expect(mockPrisma.product.count).toHaveBeenCalledWith({ where: { tenantId: "tenant-123", status: "ACTIVE" } });
      expect(mockPrisma.product.count).toHaveBeenCalledWith({ where: { tenantId: "tenant-123", status: "INACTIVE" } });
      expect(mockPrisma.product.count).toHaveBeenCalledWith({ where: { tenantId: "tenant-123", status: "OUT_OF_STOCK" } });
    });

    it("deve retornar zeros quando não há produtos", async () => {
      mockPrisma.product.count.mockResolvedValue(0);
      const result = await service.getStats("tenant-vazio");
      expect(result).toEqual({ total: 0, active: 0, inactive: 0, outOfStock: 0 });
    });
  });

  describe("bulkImport", () => {
    const items = [
      { name: "Produto A", priceCents: 1000, stockQty: 5 },
      { name: "Produto B", priceCents: 2000, stockQty: 10, description: "Desc", sku: "SKU-B", tags: ["tag1"] },
    ];

    it("deve importar todos os itens com sucesso", async () => {
      mockPrisma.product.create.mockResolvedValue({});

      const result = await service.bulkImport("tenant-123", items as any);

      expect(result.imported).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockPrisma.product.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: "tenant-123", name: "Produto A", status: "ACTIVE" }),
        }),
      );
    });

    it("deve registrar erro por linha e continuar importando as restantes", async () => {
      mockPrisma.product.create
        .mockRejectedValueOnce(new Error("Unique constraint failed on sku"))
        .mockResolvedValueOnce({});

      const result = await service.bulkImport("tenant-123", items as any);

      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({ row: 2, message: "Unique constraint failed on sku" });
    });

    it("deve usar reservedQty=0 e lowStockThreshold=5 como padrão", async () => {
      mockPrisma.product.create.mockResolvedValue({});
      await service.bulkImport("tenant-123", [items[0]] as any);
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reservedQty: 0, lowStockThreshold: 5 }),
        }),
      );
    });
  });

  describe("update (PartialType)", () => {
    const existingProduct = { id: "prod-1", tenantId: "tenant-123", name: "Original", priceCents: 1000 };

    it("deve atualizar apenas o campo nome sem exigir os demais", async () => {
      mockPrisma.product.findFirst.mockResolvedValue(existingProduct);
      mockPrisma.product.update.mockResolvedValue({ ...existingProduct, name: "Atualizado" });

      const result = await service.update("tenant-123", "prod-1", { name: "Atualizado" });

      expect(result.name).toBe("Atualizado");
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "prod-1" },
          data: expect.objectContaining({ name: "Atualizado" }),
        }),
      );
      // campos não enviados não devem aparecer no data
      const callData = mockPrisma.product.update.mock.calls[0][0].data;
      expect(callData.priceCents).toBeUndefined();
      expect(callData.stockQty).toBeUndefined();
    });

    it("deve lançar NotFoundException ao atualizar produto inexistente", async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      await expect(service.update("tenant-123", "nao-existe", { name: "X" })).rejects.toThrow(NotFoundException);
    });
  });
});
