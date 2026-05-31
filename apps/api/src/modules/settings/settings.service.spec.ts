import { Test } from "@nestjs/testing";
import { SettingsService } from "./settings.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe("SettingsService", () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
  });

  describe("updateWhatsappSettings", () => {
    it("deve atualizar whatsappPhoneId e metaAccessToken do tenant", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: "t-1", name: "Loja" });
      mockPrisma.tenant.update.mockResolvedValue({ id: "t-1", whatsappPhoneId: "1168626729666802", metaAccessToken: "tok123", whatsappStatus: "CONNECTED" });

      const result = await service.updateWhatsappSettings("t-1", {
        whatsappPhoneId: "1168626729666802",
        metaAccessToken: "tok123",
      });

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: "t-1" } });
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: "t-1" },
        data: { whatsappPhoneId: "1168626729666802", metaAccessToken: "tok123" },
        select: { id: true, whatsappPhoneId: true, whatsappStatus: true },
      });
      expect(result.whatsappPhoneId).toBe("1168626729666802");
    });

    it("deve lançar NotFoundException se tenant não existe", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.updateWhatsappSettings("nao-existe", { whatsappPhoneId: "123" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("deve atualizar apenas whatsappPhoneId quando metaAccessToken nao fornecido", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: "t-1", name: "Loja" });
      mockPrisma.tenant.update.mockResolvedValue({ id: "t-1", whatsappPhoneId: "999", whatsappStatus: "DISCONNECTED" });

      await service.updateWhatsappSettings("t-1", { whatsappPhoneId: "999" });

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: "t-1" },
        data: { whatsappPhoneId: "999" },
        select: { id: true, whatsappPhoneId: true, whatsappStatus: true },
      });
    });
  });
});
