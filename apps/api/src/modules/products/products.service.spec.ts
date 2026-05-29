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
});
