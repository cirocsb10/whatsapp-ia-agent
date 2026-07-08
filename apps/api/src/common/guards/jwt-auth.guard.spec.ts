import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

type MockPrisma = { user: { findUnique: jest.Mock } };

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let prisma: MockPrisma;
  let superProto: { canActivate: jest.Mock };

  const activeUser = {
    id: "u1",
    tenantId: "tenant_1",
    email: "a@b.com",
    isActive: true,
    tenant: { id: "tenant_1", slug: "acme", status: "ACTIVE", name: "Acme" },
  };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    guard = new JwtAuthGuard(prisma as unknown as PrismaService);

    // super.canActivate() (AuthGuard('jwt')) simula o passport preenchendo req.user
    // com o payload validado. Mockamos no protótipo do mixin (avô do guard).
    superProto = Object.getPrototypeOf(Object.getPrototypeOf(guard));
    jest
      .spyOn(superProto, "canActivate")
      .mockImplementation(async (ctx: ExecutionContext) => {
        ctx.switchToHttp().getRequest().user = { sub: "u1", tenantId: "tenant_1" };
        return true;
      });
  });

  afterEach(() => jest.restoreAllMocks());

  it("rejeita usuário inativo", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...activeUser, isActive: false });
    await expect(guard.canActivate(buildContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejeita tenant suspenso", async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...activeUser,
      tenant: { ...activeUser.tenant, status: "SUSPENDED" },
    });
    await expect(guard.canActivate(buildContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejeita tenant cancelado", async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...activeUser,
      tenant: { ...activeUser.tenant, status: "CANCELLED" },
    });
    await expect(guard.canActivate(buildContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejeita usuário inexistente", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(buildContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("seta req.user e req.tenantId quando válido", async () => {
    prisma.user.findUnique.mockResolvedValue(activeUser);
    const req: Record<string, unknown> = {};

    const result = await guard.canActivate(buildContext(req));

    expect(result).toBe(true);
    expect(req.user).toEqual(activeUser);
    expect(req.tenantId).toBe("tenant_1");
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" } }),
    );
  });
});
