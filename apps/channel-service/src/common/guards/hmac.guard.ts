import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";

interface RawBodyRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer;
}

@Injectable()
export class HmacGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest>();
    const signature = req.headers["x-hub-signature-256"] as string | undefined;

    if (!signature) {
      throw new ForbiddenException("Missing X-Hub-Signature-256 header");
    }

    const secret = this.config.get<string>("meta.webhookSecret");
    if (!secret) {
      throw new ForbiddenException("Webhook secret not configured");
    }

    const expectedSig =
      "sha256=" + createHmac("sha256", secret).update(req.rawBody).digest("hex");

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      throw new ForbiddenException("Invalid webhook signature");
    }

    return true;
  }
}
