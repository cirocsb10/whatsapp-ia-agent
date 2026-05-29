import { ClerkAuthGuard } from "./clerk-auth.guard";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

function makeContext(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization },
        user: undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe("ClerkAuthGuard", () => {
  const configService = {
    get: (key: string) => (key === "CLERK_SECRET_KEY" ? "sk_test_xxx" : null),
  } as unknown as ConfigService;

  const guard = new ClerkAuthGuard(configService);

  it("deve lançar UnauthorizedException sem header Authorization", async () => {
    await expect(guard.canActivate(makeContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("deve lançar UnauthorizedException com token inválido", async () => {
    await expect(
      guard.canActivate(makeContext("Bearer invalid_token_here")),
    ).rejects.toThrow(UnauthorizedException);
  });
});
