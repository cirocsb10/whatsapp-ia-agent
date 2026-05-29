import { createHmac } from "crypto";
import { HmacGuard } from "./hmac.guard";
import { ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

function makeContext(body: string, signature: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        rawBody: Buffer.from(body),
        headers: { "x-hub-signature-256": signature },
      }),
    }),
  } as unknown as ExecutionContext;
}

function sign(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("HmacGuard", () => {
  const secret = "test_secret";
  const configService = {
    get: (key: string) => (key === "meta.webhookSecret" ? secret : null),
  } as unknown as ConfigService;
  const guard = new HmacGuard(configService);

  it("returns true for valid signature", () => {
    const body = JSON.stringify({ test: "data" });
    expect(guard.canActivate(makeContext(body, sign(secret, body)))).toBe(true);
  });

  it("throws for invalid signature", () => {
    expect(() =>
      guard.canActivate(makeContext("{}", "sha256=invalid")),
    ).toThrow();
  });

  it("throws when header missing", () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ rawBody: Buffer.from("{}"), headers: {} }),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow();
  });
});
