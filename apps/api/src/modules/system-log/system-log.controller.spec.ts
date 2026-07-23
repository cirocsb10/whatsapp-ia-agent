import { Test } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { SystemLogController } from "./system-log.controller";
import { SystemLogService } from "./system-log.service";

describe("SystemLogController", () => {
  let controller: SystemLogController;
  const query = jest.fn();

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [SystemLogController],
      providers: [{ provide: SystemLogService, useValue: { query } }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SuperAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SystemLogController);
    jest.clearAllMocks();
  });

  it("delega query ao service", async () => {
    query.mockResolvedValue({ items: [], total: 0, page: 1, limit: 50 });
    const result = await controller.query({ page: 1, method: "GET" });
    expect(result.total).toBe(0);
    expect(query).toHaveBeenCalledWith({ page: 1, method: "GET" });
  });

  it("SuperAdminGuard bloqueia não-admin (403)", () => {
    const guard = new SuperAdminGuard();
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { isSuperAdmin: false } }),
      }),
    };
    expect(() => guard.canActivate(ctx as never)).toThrow(ForbiddenException);
  });
});
