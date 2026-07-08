import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const activated = (await super.canActivate(context)) as boolean;
    if (!activated) {
      return false;
    }

    const req = context.switchToHttp().getRequest();
    const payload = req.user as { sub?: string } | undefined;
    if (!payload?.sub) {
      throw new UnauthorizedException("Token inválido");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        tenant: { select: { id: true, slug: true, status: true, name: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException("Usuário não encontrado");
    }
    if (!user.isActive) {
      throw new UnauthorizedException("Usuário inativo");
    }
    if (user.tenant.status === "SUSPENDED" || user.tenant.status === "CANCELLED") {
      throw new UnauthorizedException("Conta suspensa");
    }

    req.user = user;
    req.tenantId = user.tenantId;
    return true;
  }
}
