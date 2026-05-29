import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verifyToken } from "@clerk/backend";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly secretKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma?: PrismaService,
  ) {
    this.secretKey =
      config.get<string>("clerk.secretKey") ??
      config.get<string>("CLERK_SECRET_KEY") ??
      "";
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization as string | undefined;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or invalid Authorization header");
    }

    const token = authHeader.slice(7);

    try {
      const payload = await verifyToken(token, { secretKey: this.secretKey });

      if (this.prisma) {
        const user = await this.prisma.user.findUnique({
          where: { clerkId: payload.sub },
          include: { tenant: { select: { id: true, slug: true, status: true } } },
        });

        if (!user) {
          throw new UnauthorizedException("User not found in system");
        }

        if (user.tenant.status === "SUSPENDED" || user.tenant.status === "CANCELLED") {
          throw new UnauthorizedException("Tenant account is suspended");
        }

        req.user = user;
        req.tenantId = user.tenantId;
      } else {
        req.user = { clerkId: payload.sub };
      }

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
