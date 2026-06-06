import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../../common/prisma/prisma.service";
import { OrdersService } from "./orders.service";

const mockContact = { id: "contact-1", phone: "5511999990000" };
const mockOrder = {
  id: "order-1",
  orderNumber: "ORD-240101-ABC12",
  subtotalCents: 4990,
  totalCents: 4990,
  status: "DRAFT",
};

const mockProducts = [
  { id: "p-1", priceCents: 1990, name: "Produto A" },
  { id: "p-2", priceCents: 1010, name: "Produto B" },
];

const mockPrisma = {
  contact: { upsert: jest.fn().mockResolvedValue(mockContact) },
  product: {
    findMany: jest.fn().mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve(mockProducts.filter((p) => where.id.in.includes(p.id))),
    ),
  },
  order: {
    create: jest.fn().mockResolvedValue(mockOrder),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
};

describe("OrdersService", () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(OrdersService);
    jest.clearAllMocks();
    mockPrisma.contact.upsert.mockResolvedValue(mockContact);
    mockPrisma.order.create.mockResolvedValue(mockOrder);
  });

  describe("createInternal", () => {
    it("calcula subtotal corretamente e cria o pedido", async () => {
      const result = await service.createInternal({
        tenantId: "t-1",
        contactPhone: "5511999990000",
        items: [
          { productId: "p-1", productName: "Produto A", priceCents: 1990, quantity: 2 },
          { productId: "p-2", productName: "Produto B", priceCents: 1010, quantity: 1 },
        ],
      });

      expect(mockPrisma.contact.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId_phone: { tenantId: "t-1", phone: "5511999990000" } } }),
      );
      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: "t-1",
            subtotalCents: 4990,
            totalCents: 4990,
            status: "DRAFT",
          }),
        }),
      );
      expect(result).toEqual(mockOrder);
    });

    it("cria itens com subtotalCents por item", async () => {
      mockPrisma.product.findMany.mockResolvedValueOnce([{ id: "p-1", priceCents: 500, name: "X" }]);
      await service.createInternal({
        tenantId: "t-1",
        contactPhone: "5511",
        items: [{ productId: "p-1", productName: "X", priceCents: 500, quantity: 3 }],
      });

      const createCall = mockPrisma.order.create.mock.calls[0][0];
      const item = createCall.data.items.create[0];
      expect(item.subtotalCents).toBe(1500);
      expect(item.variationSelected).toEqual({});
    });
  });

  describe("findAll", () => {
    it("retorna paginacao correta", async () => {
      mockPrisma.order.findMany.mockResolvedValue([mockOrder]);
      mockPrisma.order.count.mockResolvedValue(42);

      const result = await service.findAll("t-1", 2, 10);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10, where: { tenantId: "t-1" } }),
      );
      expect(result).toEqual({ items: [mockOrder], total: 42, page: 2, totalPages: 5 });
    });

    it("usa page=1 e limit=20 como padrao", async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.findAll("t-1");

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  describe("findOne", () => {
    it("retorna pedido existente", async () => {
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.findOne("t-1", "order-1");

      expect(result).toEqual(mockOrder);
      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "order-1", tenantId: "t-1" } }),
      );
    });

    it("lanca NotFoundException para pedido inexistente", async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(service.findOne("t-1", "bad-id")).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateStatus", () => {
    it("updates status to PROCESSING", async () => {
      jest.spyOn(mockPrisma.order, "findFirst").mockResolvedValue({ id: "o1", tenantId: "t1" } as any);
      jest.spyOn(mockPrisma.order, "update").mockResolvedValue({ id: "o1", status: "PROCESSING" } as any);
      const result = await service.updateStatus("t1", "o1", "PROCESSING");
      expect(result.status).toBe("PROCESSING");
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: "o1" },
        data: { status: "PROCESSING" },
      });
    });

    it("throws BadRequestException for invalid status", async () => {
      await expect(service.updateStatus("t1", "o1", "INVALID")).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException when order not found", async () => {
      jest.spyOn(mockPrisma.order, "findFirst").mockResolvedValue(null);
      await expect(service.updateStatus("t1", "missing", "PROCESSING")).rejects.toThrow(NotFoundException);
    });

    it("preenche deliveredAt quando status é DELIVERED", async () => {
      jest.spyOn(mockPrisma.order, "findFirst").mockResolvedValue({ id: "o1", tenantId: "t1" } as any);
      jest.spyOn(mockPrisma.order, "update").mockResolvedValue({ id: "o1", status: "DELIVERED" } as any);
      await service.updateStatus("t1", "o1", "DELIVERED");
      const call = mockPrisma.order.update.mock.calls[0][0];
      expect(call.data.deliveredAt).toBeInstanceOf(Date);
    });

    it("preenche cancelledAt quando status é CANCELLED", async () => {
      jest.spyOn(mockPrisma.order, "findFirst").mockResolvedValue({ id: "o1", tenantId: "t1" } as any);
      jest.spyOn(mockPrisma.order, "update").mockResolvedValue({ id: "o1", status: "CANCELLED" } as any);
      await service.updateStatus("t1", "o1", "CANCELLED");
      const call = mockPrisma.order.update.mock.calls[0][0];
      expect(call.data.cancelledAt).toBeInstanceOf(Date);
    });
  });

  describe("cancelOrder", () => {
    it("delega para updateStatus com CANCELLED", async () => {
      jest.spyOn(service, "updateStatus").mockResolvedValue({ id: "o1", status: "CANCELLED" } as any);
      await service.cancelOrder("t1", "o1");
      expect(service.updateStatus).toHaveBeenCalledWith("t1", "o1", "CANCELLED");
    });
  });

  describe("createFromUi", () => {
    it("calcula subtotal e cria pedido com dados do DB", async () => {
      mockPrisma.product.findMany.mockResolvedValueOnce([
        { id: "p-1", priceCents: 2000, name: "Produto DB" },
      ]);
      await service.createFromUi("t-1", {
        contactPhone: "5511",
        items: [{ productId: "p-1", quantity: 3 }],
      });
      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subtotalCents: 6000, totalCents: 6000, status: "DRAFT" }),
        }),
      );
      const item = mockPrisma.order.create.mock.calls[0][0].data.items.create[0];
      expect(item.productName).toBe("Produto DB");
      expect(item.subtotalCents).toBe(6000);
    });

    it("lança NotFoundException para produto inexistente", async () => {
      mockPrisma.product.findMany.mockResolvedValueOnce([]);
      await expect(
        service.createFromUi("t-1", { contactPhone: "5511", items: [{ productId: "p-missing", quantity: 1 }] }),
      ).rejects.toThrow(NotFoundException);
    });

    it("persiste notes quando fornecido", async () => {
      mockPrisma.product.findMany.mockResolvedValueOnce([{ id: "p-1", priceCents: 100, name: "X" }]);
      await service.createFromUi("t-1", {
        contactPhone: "5511",
        items: [{ productId: "p-1", quantity: 1 }],
        notes: "entrega expressa",
      });
      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notes: "entrega expressa" }),
        }),
      );
    });
  });
});
