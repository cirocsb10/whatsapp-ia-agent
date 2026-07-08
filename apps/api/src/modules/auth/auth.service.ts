import { randomUUID } from "crypto";
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PlanType, TenantStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { Redis } from "ioredis";
import { PrismaService } from "../../common/prisma/prisma.service";
import { REDIS_CLIENT } from "../../common/redis/redis.module";
import { RegisterDto } from "./dto/register.dto";

const REFRESH_PREFIX = "refresh:";
const SOCKET_TICKET_PREFIX = "socket-ticket:";
const SOCKET_TICKET_TTL_SECONDS = 30;
const BCRYPT_ROUNDS = 10;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface RefreshPayload {
  sub: string;
  tenantId: string;
  jti: string;
}

interface GoogleTokenInfo {
  email?: string;
  email_verified?: string | boolean;
  sub?: string;
  name?: string;
  picture?: string;
}

interface CreateTenantUserInput {
  email: string;
  name: string;
  passwordHash?: string | undefined;
  googleId?: string | undefined;
  avatarUrl?: string | undefined;
  companyName?: string | undefined;
}

/** Converte durações como "15m"/"7d"/"3600" em segundos. */
function parseDurationToSeconds(value: string, fallback: number): number {
  const match = /^(\d+)\s*([smhd])$/i.exec(value.trim());
  if (!match || !match[1] || !match[2]) {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : fallback;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  return amount * multiplier;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;
  private readonly refreshTtlSeconds: number;

  private readonly userInclude = {
    tenant: { select: { id: true, slug: true, status: true, name: true } },
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.accessSecret = config.get<string>("JWT_ACCESS_SECRET") ?? "dev_access_secret";
    this.refreshSecret = config.get<string>("JWT_REFRESH_SECRET") ?? "dev_refresh_secret";
    this.accessExpiresIn = config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m";
    this.refreshExpiresIn = config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d";
    this.refreshTtlSeconds = parseDurationToSeconds(this.refreshExpiresIn, 604800);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: this.userInclude,
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    this.assertActive(user);
    const tokens = await this.generateTokens(user.id, user.tenantId);
    return { ...tokens, user: this.sanitize(user) };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("E-mail já cadastrado");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.createTenantAndUser({
      email: dto.email,
      name: dto.name,
      passwordHash,
      companyName: dto.companyName,
    });

    const tokens = await this.generateTokens(user.id, user.tenantId);
    return { ...tokens, user: this.sanitize(user) };
  }

  async googleLogin(accessToken: string) {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
    );

    if (!response.ok) {
      throw new UnauthorizedException("Token do Google inválido");
    }

    const info = (await response.json()) as GoogleTokenInfo;
    const emailVerified = info.email_verified === true || info.email_verified === "true";
    if (!emailVerified || !info.email || !info.sub) {
      throw new UnauthorizedException("E-mail do Google não verificado");
    }

    const googleId = info.sub;
    const email = info.email;

    let user = await this.prisma.user.findUnique({
      where: { googleId },
      include: this.userInclude,
    });

    if (!user) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email },
        include: this.userInclude,
      });

      if (byEmail) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId },
          include: this.userInclude,
        });
      } else {
        user = await this.createTenantAndUser({
          email,
          name: info.name || email.split("@")[0] || "Usuário",
          googleId,
          avatarUrl: info.picture,
        });
      }
    }

    this.assertActive(user);
    const tokens = await this.generateTokens(user.id, user.tenantId);
    return { ...tokens, user: this.sanitize(user) };
  }

  async generateTokens(userId: string, tenantId: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, tenantId },
      { secret: this.accessSecret, expiresIn: this.accessExpiresIn as unknown as number },
    );

    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, tenantId, jti },
      { secret: this.refreshSecret, expiresIn: this.refreshExpiresIn as unknown as number },
    );

    await this.redis.set(`${REFRESH_PREFIX}${jti}`, userId, "EX", this.refreshTtlSeconds);
    return { accessToken, refreshToken };
  }

  async refreshToken(token: string): Promise<TokenPair> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException("Refresh token inválido ou expirado");
    }

    const key = `${REFRESH_PREFIX}${payload.jti}`;
    const userId = await this.redis.get(key);
    if (!userId) {
      throw new UnauthorizedException("Sessão expirada");
    }

    await this.redis.del(key);
    return this.generateTokens(payload.sub, payload.tenantId);
  }

  async logout(token: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.refreshSecret,
      });
      if (payload?.jti) {
        await this.redis.del(`${REFRESH_PREFIX}${payload.jti}`);
      }
    } catch {
      // Token já inválido/expirado — logout é idempotente.
    }
  }

  async issueSocketTicket(userId: string): Promise<string> {
    const ticket = randomUUID();
    await this.redis.set(
      `${SOCKET_TICKET_PREFIX}${ticket}`,
      userId,
      "EX",
      SOCKET_TICKET_TTL_SECONDS,
    );
    return ticket;
  }

  private async createTenantAndUser(input: CreateTenantUserInput) {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.companyName || input.name,
          slug: this.buildSlug(input.email),
          status: TenantStatus.TRIAL,
          planType: PlanType.STARTER,
        },
      });

      return tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash ?? null,
          googleId: input.googleId ?? null,
          avatarUrl: input.avatarUrl ?? null,
          role: "OWNER",
          isActive: true,
        },
        include: this.userInclude,
      });
    });
  }

  private assertActive(user: { isActive: boolean; tenant: { status: string } }) {
    if (!user.isActive) {
      throw new UnauthorizedException("Usuário inativo");
    }
    if (user.tenant.status === "SUSPENDED" || user.tenant.status === "CANCELLED") {
      throw new UnauthorizedException("Conta suspensa");
    }
  }

  private sanitize<T extends { passwordHash?: string | null }>(user: T) {
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
  }

  private buildSlug(email: string): string {
    const localPart = email.split("@")[0] ?? "user";
    const prefix = localPart
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30);
    const suffix = randomUUID().replace(/-/g, "").slice(0, 6);
    return `${prefix}-${suffix}`;
  }
}
