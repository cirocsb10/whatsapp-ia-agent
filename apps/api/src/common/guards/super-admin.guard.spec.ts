import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { SuperAdminGuard } from "./super-admin.guard";

function buildContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe("SuperAdminGuard", () => {
  const guard = new SuperAdminGuard();

  it("permite usuário com isSuperAdmin=true", () => {
    expect(guard.canActivate(buildContext({ isSuperAdmin: true }))).toBe(true);
  });

  it("rejeita usuário sem isSuperAdmin", () => {
    expect(() => guard.canActivate(buildContext({ isSuperAdmin: false }))).toThrow(
      ForbiddenException,
    );
  });

  it("rejeita request sem user", () => {
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
