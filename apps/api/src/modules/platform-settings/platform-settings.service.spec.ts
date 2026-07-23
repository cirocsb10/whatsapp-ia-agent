import { Test } from "@nestjs/testing";
import { PlatformSettingsService } from "./platform-settings.service";
import { PrismaService } from "../../common/prisma/prisma.service";

const mockPrisma = {
  platformSettings: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

describe("PlatformSettingsService", () => {
  let service: PlatformSettingsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PlatformSettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(PlatformSettingsService);
    jest.clearAllMocks();
  });

  it("retorna defaults quando não há registro", async () => {
    mockPrisma.platformSettings.findUnique.mockResolvedValue(null);

    const result = await service.getSettings();

    expect(result.maintenanceMode).toBe(false);
    expect(result.newTenantRegistrationOpen).toBe(true);
    expect(result.planConversationLimits.STARTER).toBe(100);
  });

  it("faz upsert ao atualizar flags", async () => {
    mockPrisma.platformSettings.upsert.mockResolvedValue({
      id: "default",
      maintenanceMode: true,
      maintenanceMessage: "Em manutenção",
      newTenantRegistrationOpen: false,
      defaultTrialDays: 14,
      defaultConversationsLimit: 200,
      planConversationLimits: { STARTER: 100, GROWTH: 1000, SCALE: 5000, ENTERPRISE: 20000 },
      updatedAt: new Date(),
    });

    const result = await service.updateSettings({
      maintenanceMode: true,
      maintenanceMessage: "Em manutenção",
      newTenantRegistrationOpen: false,
    });

    expect(result.maintenanceMode).toBe(true);
    expect(mockPrisma.platformSettings.upsert).toHaveBeenCalled();
  });
});
