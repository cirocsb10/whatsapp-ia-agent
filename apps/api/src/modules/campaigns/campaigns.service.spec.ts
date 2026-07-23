import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { CampaignsService } from "./campaigns.service";
import { AudienceService } from "./audience.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CAMPAIGN_DISPATCH_QUEUE } from "./campaign.constants";

const mockPrisma: Record<string, unknown> = {
  whatsappChannel: { findFirst: jest.fn() },
  messageTemplate: { findFirst: jest.fn() },
  campaign: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  campaignRecipient: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
};
mockPrisma["$transaction"] = jest.fn(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
  fn(mockPrisma),
);

const mockAudience = { buildAudience: jest.fn() };
const mockQueue = { add: jest.fn() };

describe("CampaignsService", () => {
  let service: CampaignsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (mockPrisma["$transaction"] as jest.Mock).mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    const module = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AudienceService, useValue: mockAudience },
        { provide: getQueueToken(CAMPAIGN_DISPATCH_QUEUE), useValue: mockQueue },
      ],
    }).compile();
    service = module.get(CampaignsService);
  });

  describe("create — APPROVED only", () => {
    it("rejeita template não APPROVED", async () => {
      (mockPrisma["whatsappChannel"] as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
        id: "ch-1",
        metaAccessToken: "tok",
        whatsappPhoneId: "pid",
      });
      (mockPrisma["messageTemplate"] as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
        id: "tpl-1",
        status: "PENDING",
        channelId: "ch-1",
      });

      await expect(
        service.create("tenant-1", {
          name: "Campanha",
          channelId: "ch-1",
          templateId: "tpl-1",
          audienceQuery: { type: "all" },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("cria campanha com template APPROVED", async () => {
      (mockPrisma["whatsappChannel"] as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
        id: "ch-1",
        metaAccessToken: "tok",
        whatsappPhoneId: "pid",
      });
      (mockPrisma["messageTemplate"] as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
        id: "tpl-1",
        status: "APPROVED",
        channelId: "ch-1",
      });
      (mockPrisma["campaign"] as { create: jest.Mock }).create.mockResolvedValue({
        id: "camp-1",
        status: "DRAFT",
      });

      await service.create("tenant-1", {
        name: "Aniversário",
        channelId: "ch-1",
        templateId: "tpl-1",
        audienceQuery: { type: "all" },
      });

      expect((mockPrisma["campaign"] as { create: jest.Mock }).create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Aniversário",
            status: "DRAFT",
            audienceQuery: { type: "all" },
          }),
        }),
      );
    });
  });

  describe("dispatch — APPROVED only", () => {
    it("rejeita dispatch se template deixou de ser APPROVED", async () => {
      (mockPrisma["campaign"] as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
        id: "camp-1",
        status: "DRAFT",
        audienceQuery: { type: "all" },
        template: { status: "REJECTED" },
        channel: { metaAccessToken: "tok" },
      });

      await expect(service.dispatch("tenant-1", "camp-1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("enfileira job quando APPROVED e audiência não vazia", async () => {
      (mockPrisma["campaign"] as { findFirst: jest.Mock }).findFirst
        .mockResolvedValueOnce({
          id: "camp-1",
          status: "DRAFT",
          audienceQuery: { type: "all" },
          template: { status: "APPROVED" },
          channel: { metaAccessToken: "tok" },
        })
        .mockResolvedValueOnce({
          id: "camp-1",
          status: "SENDING",
          recipients: [],
          channel: {},
          template: {},
        });
      mockAudience.buildAudience.mockResolvedValue([{ id: "c1", phone: "5511", name: "A" }]);

      await service.dispatch("tenant-1", "camp-1");

      expect(
        (mockPrisma["campaignRecipient"] as { createMany: jest.Mock }).createMany,
      ).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        "dispatch",
        { campaignId: "camp-1", tenantId: "tenant-1" },
        expect.any(Object),
      );
    });

    it("404 se campanha não existe", async () => {
      (mockPrisma["campaign"] as { findFirst: jest.Mock }).findFirst.mockResolvedValue(null);
      await expect(service.dispatch("tenant-1", "x")).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
