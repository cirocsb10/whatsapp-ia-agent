import { Test } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { PlatformSettingsController } from "./platform-settings.controller";
import { PlatformSettingsService } from "./platform-settings.service";

describe("PlatformSettingsController", () => {
  let controller: PlatformSettingsController;
  const getSettings = jest.fn();
  const updateSettings = jest.fn();

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PlatformSettingsController],
      providers: [
        {
          provide: PlatformSettingsService,
          useValue: { getSettings, updateSettings },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SuperAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PlatformSettingsController);
    jest.clearAllMocks();
  });

  it("GET retorna settings", async () => {
    getSettings.mockResolvedValue({ maintenanceMode: false });
    await expect(controller.getSettings()).resolves.toEqual({
      maintenanceMode: false,
    });
  });

  it("PUT atualiza settings", async () => {
    updateSettings.mockResolvedValue({ maintenanceMode: true });
    await expect(
      controller.updateSettings({ maintenanceMode: true }),
    ).resolves.toEqual({ maintenanceMode: true });
    expect(updateSettings).toHaveBeenCalledWith({ maintenanceMode: true });
  });

  it("exige super-admin", () => {
    const guard = new SuperAdminGuard();
    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => ({ user: {} }) }),
      } as never),
    ).toThrow(ForbiddenException);
  });
});
