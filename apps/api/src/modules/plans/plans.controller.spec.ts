import { Test } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { PlansController } from "./plans.controller";
import { PlansService } from "./plans.service";

describe("PlansController", () => {
  let controller: PlansController;
  const getOverview = jest.fn();
  const overridePlan = jest.fn();

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [
        { provide: PlansService, useValue: { getOverview, overridePlan } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SuperAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PlansController);
    jest.clearAllMocks();
  });

  it("GET overview pagina", async () => {
    getOverview.mockResolvedValue({ items: [], total: 0 });
    await controller.getOverview("2", "10");
    expect(getOverview).toHaveBeenCalledWith(2, 10);
  });

  it("POST override delega ao service", async () => {
    overridePlan.mockResolvedValue({
      planType: "GROWTH",
      warning: "Assinatura Stripe não alterada",
    });
    const result = await controller.overridePlan("t1", { planType: "GROWTH" });
    expect(overridePlan).toHaveBeenCalledWith("t1", { planType: "GROWTH" });
    expect(result.warning).toContain("Stripe");
  });

  it("exige super-admin", () => {
    const guard = new SuperAdminGuard();
    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ user: { isSuperAdmin: false } }),
        }),
      } as never),
    ).toThrow(ForbiddenException);
  });
});
