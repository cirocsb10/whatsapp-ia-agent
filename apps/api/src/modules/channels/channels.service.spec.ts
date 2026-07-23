import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ChannelsService } from "./channels.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { REDIS_CLIENT } from "../../common/redis/redis.module";

const mockChannel = {
  id: "ch-1",
  tenantId: "t-1",
  displayName: "Vendas Salvador",
  whatsappPhoneId: "phone-1",
  whatsappNumber: "+5571999999999",
  metaAccessToken: "secret-token",
  wabaId: "waba-1",
  status: "ACTIVE" as const,
  isDefault: true,
  isAiEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  members: [],
};

const mockPrisma = {
  whatsappChannel: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  whatsappChannelMember: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  conversation: {
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockRedis = {
  del: jest.fn().mockResolvedValue(1),
};

describe("ChannelsService", () => {
  let service: ChannelsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();
    service = module.get(ChannelsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
  });

  describe("create", () => {
    it("requer displayName não vazio", async () => {
      await expect(
        service.create("t-1", {
          displayName: "   ",
          whatsappPhoneId: "phone-1",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("requer whatsappPhoneId não vazio após trim", async () => {
      await expect(
        service.create("t-1", {
          displayName: "Canal",
          whatsappPhoneId: "   ",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.whatsappChannel.create).not.toHaveBeenCalled();
    });

    it("cria canal com displayName e phoneId únicos; primeiro vira default", async () => {
      mockPrisma.whatsappChannel.findUnique.mockResolvedValue(null);
      mockPrisma.whatsappChannel.count.mockResolvedValue(0);
      mockPrisma.whatsappChannel.create.mockResolvedValue(mockChannel);

      const result = await service.create("t-1", {
        displayName: "Vendas Salvador",
        whatsappPhoneId: "phone-1",
        whatsappNumber: "+5571999999999",
        metaAccessToken: "secret-token",
        isAiEnabled: false,
      });

      expect(mockPrisma.whatsappChannel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: "t-1",
            displayName: "Vendas Salvador",
            whatsappPhoneId: "phone-1",
            isDefault: true,
            isAiEnabled: false,
          }),
        }),
      );
      expect(result).not.toHaveProperty("metaAccessToken");
      expect(result.hasMetaAccessToken).toBe(true);
    });

    it("rejeita whatsappPhoneId duplicado", async () => {
      mockPrisma.whatsappChannel.findUnique.mockResolvedValue({ id: "other" });
      await expect(
        service.create("t-1", {
          displayName: "Dup",
          whatsappPhoneId: "phone-1",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("valida memberUserIds do tenant e associa no create", async () => {
      mockPrisma.whatsappChannel.findUnique.mockResolvedValue(null);
      mockPrisma.whatsappChannel.count.mockResolvedValue(1);
      mockPrisma.user.findMany.mockResolvedValue([{ id: "u-1" }, { id: "u-2" }]);
      mockPrisma.whatsappChannel.create.mockResolvedValue({
        ...mockChannel,
        isDefault: false,
        members: [
          { userId: "u-1", user: { id: "u-1", name: "A", email: "a@x.com", role: "AGENT" } },
        ],
      });

      await service.create("t-1", {
        displayName: "Suporte",
        whatsappPhoneId: "phone-2",
        memberUserIds: ["u-1", "u-2"],
      });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: "t-1",
            id: { in: ["u-1", "u-2"] },
          }),
        }),
      );
      expect(mockPrisma.whatsappChannel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isDefault: false,
            members: { create: [{ userId: "u-1" }, { userId: "u-2" }] },
          }),
        }),
      );
    });
  });

  describe("toggleAi", () => {
    it("atualiza isAiEnabled e invalida cache Redis", async () => {
      mockPrisma.whatsappChannel.findFirst.mockResolvedValue(mockChannel);
      mockPrisma.whatsappChannel.update.mockResolvedValue({
        ...mockChannel,
        isAiEnabled: true,
      });

      const result = await service.toggleAi("t-1", "ch-1", true);

      expect(mockPrisma.whatsappChannel.update).toHaveBeenCalledWith({
        where: { id: "ch-1" },
        data: { isAiEnabled: true },
        include: expect.any(Object),
      });
      expect(mockRedis.del).toHaveBeenCalledWith("channel:phone:phone-1");
      expect(result.isAiEnabled).toBe(true);
    });

    it("lança NotFoundException se canal não existe no tenant", async () => {
      mockPrisma.whatsappChannel.findFirst.mockResolvedValue(null);
      await expect(service.toggleAi("t-1", "missing", true)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("replaceMembers", () => {
    it("substitui a lista de membros (deleteMany + createMany)", async () => {
      mockPrisma.whatsappChannel.findFirst
        .mockResolvedValueOnce(mockChannel)
        .mockResolvedValueOnce({
          ...mockChannel,
          members: [
            { userId: "u-2", user: { id: "u-2", name: "B", email: "b@x.com", role: "AGENT" } },
          ],
        });
      mockPrisma.user.findMany.mockResolvedValue([{ id: "u-2" }]);
      mockPrisma.whatsappChannelMember.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.whatsappChannelMember.createMany.mockResolvedValue({ count: 1 });

      await service.replaceMembers("t-1", "ch-1", ["u-2"]);

      expect(mockPrisma.whatsappChannelMember.deleteMany).toHaveBeenCalledWith({
        where: { channelId: "ch-1" },
      });
      expect(mockPrisma.whatsappChannelMember.createMany).toHaveBeenCalledWith({
        data: [{ channelId: "ch-1", userId: "u-2" }],
      });
    });

    it("permite lista vazia (remove todos os membros)", async () => {
      mockPrisma.whatsappChannel.findFirst
        .mockResolvedValueOnce(mockChannel)
        .mockResolvedValueOnce({ ...mockChannel, members: [] });
      mockPrisma.whatsappChannelMember.deleteMany.mockResolvedValue({ count: 0 });

      await service.replaceMembers("t-1", "ch-1", []);

      expect(mockPrisma.whatsappChannelMember.createMany).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("invalida cache ao atualizar metaAccessToken", async () => {
      mockPrisma.whatsappChannel.findFirst.mockResolvedValue(mockChannel);
      mockPrisma.whatsappChannel.update.mockResolvedValue({
        ...mockChannel,
        metaAccessToken: "new-token",
      });

      await service.update("t-1", "ch-1", { metaAccessToken: "new-token" });

      expect(mockRedis.del).toHaveBeenCalledWith("channel:phone:phone-1");
    });

    it("rejeita whatsappPhoneId vazio após trim", async () => {
      mockPrisma.whatsappChannel.findFirst.mockResolvedValue(mockChannel);

      await expect(
        service.update("t-1", "ch-1", { whatsappPhoneId: "   " }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.whatsappChannel.update).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("bloqueia exclusão do único canal com conversas ativas", async () => {
      mockPrisma.whatsappChannel.findFirst.mockResolvedValue(mockChannel);
      mockPrisma.whatsappChannel.count.mockResolvedValue(1);
      mockPrisma.conversation.count.mockResolvedValue(3);

      await expect(service.remove("t-1", "ch-1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockPrisma.whatsappChannel.delete).not.toHaveBeenCalled();
      expect(mockPrisma.conversation.updateMany).not.toHaveBeenCalled();
    });

    it("nullifica channelId nas conversas antes de excluir", async () => {
      mockPrisma.whatsappChannel.findFirst.mockResolvedValue({
        ...mockChannel,
        isDefault: false,
      });
      mockPrisma.whatsappChannel.count.mockResolvedValue(2);
      mockPrisma.conversation.updateMany.mockResolvedValue({ count: 5 });
      mockPrisma.whatsappChannel.delete.mockResolvedValue(mockChannel);

      await service.remove("t-1", "ch-1");

      expect(mockPrisma.conversation.updateMany).toHaveBeenCalledWith({
        where: { channelId: "ch-1" },
        data: { channelId: null },
      });
      expect(mockPrisma.whatsappChannel.delete).toHaveBeenCalledWith({
        where: { id: "ch-1" },
      });
      expect(mockRedis.del).toHaveBeenCalledWith("channel:phone:phone-1");
    });

    it("reassigna default ao excluir canal default com outros canais", async () => {
      mockPrisma.whatsappChannel.findFirst
        .mockResolvedValueOnce(mockChannel)
        .mockResolvedValueOnce({ id: "ch-2", tenantId: "t-1" });
      mockPrisma.whatsappChannel.count.mockResolvedValue(2);
      mockPrisma.conversation.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.whatsappChannel.delete.mockResolvedValue(mockChannel);
      mockPrisma.whatsappChannel.update.mockResolvedValue({ id: "ch-2", isDefault: true });

      await service.remove("t-1", "ch-1");

      expect(mockPrisma.conversation.updateMany).toHaveBeenCalledWith({
        where: { channelId: "ch-1" },
        data: { channelId: null },
      });
      expect(mockPrisma.whatsappChannel.delete).toHaveBeenCalledWith({ where: { id: "ch-1" } });
      expect(mockPrisma.whatsappChannel.update).toHaveBeenCalledWith({
        where: { id: "ch-2" },
        data: { isDefault: true },
      });
      expect(mockRedis.del).toHaveBeenCalledWith("channel:phone:phone-1");
    });
  });

  describe("findAll", () => {
    it("lista apenas canais do tenant e omite o token", async () => {
      mockPrisma.whatsappChannel.findMany.mockResolvedValue([mockChannel]);

      const result = await service.findAll("t-1");

      expect(mockPrisma.whatsappChannel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: "t-1" } }),
      );
      expect(result[0]).not.toHaveProperty("metaAccessToken");
      expect(result[0]?.hasMetaAccessToken).toBe(true);
    });
  });
});
