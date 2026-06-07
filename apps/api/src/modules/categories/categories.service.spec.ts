import { Test, TestingModule } from "@nestjs/testing";
import { CategoriesService } from "./categories.service";
import { PrismaService } from "../../common/prisma/prisma.service";

const mockPrisma = {
  category: {
    findMany: jest.fn(),
  },
};

describe("CategoriesService", () => {
  let service: CategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CategoriesService>(CategoriesService);
    jest.clearAllMocks();
  });

  it("deve retornar categorias do tenant ordenadas por nome", async () => {
    const cats = [
      { id: "c1", name: "Camisetas", slug: "camisetas", parentId: null },
      { id: "c2", name: "Calças", slug: "calcas", parentId: null },
    ];
    mockPrisma.category.findMany.mockResolvedValue(cats);

    const result = await service.findAll("tenant-123");

    expect(result).toEqual(cats);
    expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-123" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, parentId: true },
    });
  });

  it("deve retornar array vazio quando tenant não possui categorias", async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);

    const result = await service.findAll("tenant-sem-cats");

    expect(result).toEqual([]);
    expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-sem-cats" } }),
    );
  });

  it("deve isolar categorias por tenant — não retorna de outro tenant", async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);

    await service.findAll("tenant-A");

    const call = mockPrisma.category.findMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe("tenant-A");
  });

  it("deve selecionar apenas os campos id, name, slug, parentId", async () => {
    mockPrisma.category.findMany.mockResolvedValue([]);

    await service.findAll("tenant-123");

    const call = mockPrisma.category.findMany.mock.calls[0][0];
    expect(call.select).toEqual({ id: true, name: true, slug: true, parentId: true });
  });
});
