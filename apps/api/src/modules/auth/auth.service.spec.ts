import { Test } from "@nestjs/testing";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException, ConflictException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../common/prisma/prisma.service";
import { REDIS_CLIENT } from "../../common/redis/redis.module";

type MockPrisma = {
  $transaction: jest.Mock;
  tenant: { create: jest.Mock };
  user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
};

const mockPrisma: MockPrisma = {
  $transaction: jest.fn((fn: (tx: MockPrisma) => Promise<unknown>) => fn(mockPrisma)),
  tenant: { create: jest.fn() },
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
};

const redisStore = new Map<string, string>();
const mockRedis = {
  set: jest.fn((key: string, value: string) => {
    redisStore.set(key, value);
    return Promise.resolve("OK");
  }),
  get: jest.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
  del: jest.fn((key: string) => {
    const existed = redisStore.delete(key);
    return Promise.resolve(existed ? 1 : 0);
  }),
};

const configValues: Record<string, string> = {
  JWT_ACCESS_SECRET: "test_access_secret",
  JWT_REFRESH_SECRET: "test_refresh_secret",
  JWT_ACCESS_EXPIRES_IN: "15m",
  JWT_REFRESH_EXPIRES_IN: "7d",
};

const activeTenant = { id: "tenant_1", slug: "acme-abc123", status: "ACTIVE", name: "Acme" };

describe("AuthService", () => {
  let service: AuthService;
  let jwt: JwtService;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash("supersecret", 10);
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: REDIS_CLIENT, useValue: mockRedis },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => configValues[key] },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    jwt = moduleRef.get(JwtService);
    jest.clearAllMocks();
    redisStore.clear();
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: MockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  describe("login", () => {
    it("rejeita credenciais inválidas (usuário inexistente)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login("nao@existe.com", "x")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejeita senha incorreta", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u1",
        tenantId: "tenant_1",
        email: "a@b.com",
        passwordHash,
        isActive: true,
        tenant: activeTenant,
      });
      await expect(service.login("a@b.com", "errada")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejeita tenant suspenso", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u1",
        tenantId: "tenant_1",
        email: "a@b.com",
        passwordHash,
        isActive: true,
        tenant: { ...activeTenant, status: "SUSPENDED" },
      });
      await expect(service.login("a@b.com", "supersecret")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("retorna tokens e user sem passwordHash quando válido", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u1",
        tenantId: "tenant_1",
        email: "a@b.com",
        passwordHash,
        isActive: true,
        tenant: activeTenant,
      });

      const result = await service.login("a@b.com", "supersecret");

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh-family:/),
        expect.any(String),
        "EX",
        expect.any(Number),
      );
    });
  });

  describe("register", () => {
    it("rejeita e-mail já cadastrado", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });
      await expect(
        service.register({ email: "a@b.com", name: "A", password: "supersecret" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("cria tenant + user OWNER e retorna tokens", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: "tenant_new" });
      mockPrisma.user.create.mockResolvedValue({
        id: "u_new",
        tenantId: "tenant_new",
        email: "a@b.com",
        passwordHash: "hash",
        isActive: true,
        tenant: { ...activeTenant, id: "tenant_new" },
      });

      const result = await service.register({
        email: "a@b.com",
        name: "A",
        password: "supersecret",
      });

      expect(mockPrisma.tenant.create).toHaveBeenCalled();
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: "OWNER", email: "a@b.com" }),
        }),
      );
      expect(result.accessToken).toBeDefined();
    });
  });

  describe("googleLogin", () => {
    afterEach(() => {
      (global.fetch as unknown as jest.Mock | undefined)?.mockClear?.();
    });

    it("rejeita e-mail não verificado", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ email_verified: "false", email: "a@b.com", sub: "g1" }),
      }) as unknown as typeof fetch;

      await expect(service.googleLogin("gtoken")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("loga usuário existente por googleId", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          email_verified: "true",
          email: "a@b.com",
          sub: "g1",
          name: "A",
        }),
      }) as unknown as typeof fetch;

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u1",
        tenantId: "tenant_1",
        email: "a@b.com",
        isActive: true,
        tenant: activeTenant,
      });

      const result = await service.googleLogin("gtoken");
      expect(result.accessToken).toBeDefined();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { googleId: "g1" } }),
      );
    });
  });

  describe("refreshToken (rotação)", () => {
    it("invalida o token antigo e emite um novo par", async () => {
      const tokens = await service.generateTokens("u1", "tenant_1");
      const decoded = jwt.decode(tokens.refreshToken) as { familyId: string };
      expect(redisStore.has(`refresh-family:${decoded.familyId}`)).toBe(true);

      const rotated = await service.refreshToken(tokens.refreshToken);

      expect(redisStore.has(`refresh-family:${decoded.familyId}`)).toBe(true);
      expect(rotated.refreshToken).toBeDefined();
      expect(rotated.refreshToken).not.toBe(tokens.refreshToken);

      const rotatedDecoded = jwt.decode(rotated.refreshToken) as { familyId: string };
      expect(rotatedDecoded.familyId).toBe(decoded.familyId);
    });

    it("rejeita reuso do token já rotacionado e revoga a família", async () => {
      const tokens = await service.generateTokens("u1", "tenant_1");
      const decoded = jwt.decode(tokens.refreshToken) as { familyId: string };

      await service.refreshToken(tokens.refreshToken);

      // Reapresentar o token original (já rotacionado) deve ser tratado como reuso.
      await expect(service.refreshToken(tokens.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(redisStore.has(`refresh-family:${decoded.familyId}`)).toBe(false);
    });

    it("rejeita token expirado/desconhecido", async () => {
      await expect(service.refreshToken("token-invalido")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe("logout", () => {
    it("remove a chave Redis da família do refresh token", async () => {
      const tokens = await service.generateTokens("u1", "tenant_1");
      const decoded = jwt.decode(tokens.refreshToken) as { familyId: string };

      await service.logout(tokens.refreshToken);

      expect(redisStore.has(`refresh-family:${decoded.familyId}`)).toBe(false);
    });

    it("não lança erro para token inválido", async () => {
      await expect(service.logout("token-invalido")).resolves.toBeUndefined();
    });
  });

  describe("issueSocketTicket", () => {
    it("grava ticket de uso único no Redis com TTL", async () => {
      const ticket = await service.issueSocketTicket("u1");
      expect(mockRedis.set).toHaveBeenCalledWith(
        `socket-ticket:${ticket}`,
        "u1",
        "EX",
        expect.any(Number),
      );
    });
  });
});
