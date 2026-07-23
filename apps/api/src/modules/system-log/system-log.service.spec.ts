import { Test } from "@nestjs/testing";
import { SystemLogService } from "./system-log.service";
import { PrismaService } from "../../common/prisma/prisma.service";

const mockPrisma = {
  systemAccessLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe("SystemLogService", () => {
  let service: SystemLogService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SystemLogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(SystemLogService);
    jest.clearAllMocks();
  });

  it("record não propaga erro de persistência", () => {
    mockPrisma.systemAccessLog.create.mockRejectedValue(new Error("db down"));

    expect(() =>
      service.record({
        method: "GET",
        endpoint: "/overview",
        statusCode: 200,
        duration: 12,
      }),
    ).not.toThrow();
  });

  it("query aplica filtros e paginação", async () => {
    mockPrisma.systemAccessLog.findMany.mockResolvedValue([]);
    mockPrisma.systemAccessLog.count.mockResolvedValue(0);

    const result = await service.query({
      page: 2,
      limit: 10,
      method: "post",
      endpoint: "/auth",
    });

    expect(result).toEqual({ items: [], total: 0, page: 2, limit: 10 });
    expect(mockPrisma.systemAccessLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({
          method: "POST",
          endpoint: { contains: "/auth", mode: "insensitive" },
        }),
      }),
    );
  });
});
