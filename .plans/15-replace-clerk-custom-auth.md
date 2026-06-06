# Auth Migration: Clerk → Custom JWT + Google OAuth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir completamente o Clerk por autenticação própria com JWT, registro por email/senha e login social via Google OAuth.

**Architecture:** O backend NestJS (`apps/api`) emite e valida JWTs próprios, substituindo `ClerkAuthGuard` por `JwtAuthGuard`. O frontend Next.js substitui `ClerkProvider` por um `AuthContext` customizado; o middleware lê um cookie `access_token` para proteger rotas. Google OAuth é tratado via Passport no backend com redirect ao frontend após troca do token.

**Tech Stack:** `@nestjs/jwt`, `@nestjs/passport`, `passport-google-oauth20`, `bcryptjs`, `class-validator` (já existe), cookie do browser (acesso no edge middleware), React Context API

**Out of scope:** Fluxo de convite de membros de equipe (cada cadastro cria um novo tenant).

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `packages/database/prisma/schema.prisma` | Modificar | Remove `clerkId`, adiciona `passwordHash`, `googleId`, modelo `RefreshToken` |
| `apps/api/src/modules/auth/auth.service.ts` | Criar | register, login, googleLogin, refreshTokens, logout, helpers |
| `apps/api/src/modules/auth/auth.controller.ts` | Criar | Rotas REST de autenticação |
| `apps/api/src/modules/auth/auth.module.ts` | Criar | Wiring do módulo com Passport + JWT |
| `apps/api/src/modules/auth/strategies/jwt.strategy.ts` | Criar | Extrai payload do Bearer JWT |
| `apps/api/src/modules/auth/strategies/google.strategy.ts` | Criar | Passport Google OAuth 2.0 |
| `apps/api/src/modules/auth/dto/register.dto.ts` | Criar | DTO de cadastro com validações |
| `apps/api/src/modules/auth/dto/login.dto.ts` | Criar | DTO de login |
| `apps/api/src/modules/auth/auth.service.spec.ts` | Criar | Testes unitários do AuthService |
| `apps/api/src/common/guards/jwt-auth.guard.ts` | Criar | Substitui `ClerkAuthGuard` — verifica JWT + carrega user do DB |
| `apps/api/src/common/guards/jwt-auth.guard.spec.ts` | Criar | Testes do guard |
| `apps/api/src/common/guards/clerk-auth.guard.ts` | Deletar | Removido |
| `apps/api/src/common/guards/clerk-auth.guard.spec.ts` | Deletar | Removido |
| `apps/api/src/modules/clerk/` (diretório completo) | Deletar | ClerkModule, controller, service removidos |
| `apps/api/src/app.module.ts` | Modificar | Troca `ClerkModule` → `AuthModule` |
| `apps/api/src/gateways/events.gateway.ts` | Modificar | Substitui `verifyToken` do Clerk por `jwtService.verify` |
| `apps/api/package.json` | Modificar | Remove `@clerk/backend`, `svix`; adiciona novas deps |
| `apps/web/src/contexts/auth-context.tsx` | Criar | React Context com user, token, login, logout |
| `apps/web/src/app/providers.tsx` | Modificar | Troca `ClerkProvider` → `AuthProvider` |
| `apps/web/src/middleware.ts` | Modificar | Troca `clerkMiddleware` → middleware customizado com cookie |
| `apps/web/src/lib/hooks/useApi.ts` | Modificar | Pega token do `AuthContext` em vez do `useAuth()` do Clerk |
| `apps/web/src/hooks/useSocket.ts` | Modificar | Pega token do `AuthContext` |
| `apps/web/src/app/(auth)/sign-in/page.tsx` | Criar | Página de login email/senha + botão Google |
| `apps/web/src/app/(auth)/sign-up/page.tsx` | Criar | Página de cadastro |
| `apps/web/src/app/auth/callback/page.tsx` | Criar | Captura token da URL após Google OAuth e redireciona |
| `apps/web/src/components/layout/Header.tsx` | Modificar | Troca hooks do Clerk por `useAuthContext()` |
| `apps/web/src/app/page.tsx` | Modificar | Troca `<SignInButton>/<SignUpButton>` por links próprios |
| `apps/web/src/app/(onboarding)/setup/plan/page.tsx` | Verificar/Modificar | Substituir qualquer uso de `useAuth()` do Clerk |
| `apps/web/src/app/(dashboard)/settings/page.tsx` | Verificar/Modificar | Substituir qualquer uso de `useUser()` do Clerk |
| `apps/web/package.json` | Modificar | Remove `@clerk/nextjs` |
| `.env.example` | Modificar | Remove vars do Clerk, adiciona `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_*`, `FRONTEND_URL` |

---

## Task 1: Prisma Schema — Migração dos campos de auth

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: nova migration via `pnpm db:migrate`

- [ ] **Step 1: Verificar emails duplicados antes de adicionar @unique**

```sql
-- Rodar via Prisma Studio ou psql antes de prosseguir
SELECT email, COUNT(*) FROM "User" GROUP BY email HAVING COUNT(*) > 1;
```
Resultado esperado: zero linhas. Se houver duplicatas, resolver manualmente antes de continuar.

- [ ] **Step 2: Atualizar schema.prisma**

No modelo `User`, remover `clerkId` e adicionar os novos campos:

```prisma
model User {
  id           String    @id @default(uuid())
  tenantId     String
  email        String    @unique          // adiciona @unique
  name         String
  avatarUrl    String?
  passwordHash String?                    // null para usuários só-Google
  googleId     String?   @unique          // null para usuários email/senha
  role         UserRole  @default(AGENT)
  isSuperAdmin Boolean   @default(false)
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  tenant        Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  refreshTokens RefreshToken[]
  auditLogs     AuditLog[]

  @@index([tenantId])
  @@index([tenantId, role])
}
```

Adicionar novo modelo `RefreshToken` após o modelo `User`:

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

Remover os indexes antigos de `clerkId` do modelo `User` (@@index([clerkId])).

- [ ] **Step 3: Criar e aplicar a migration**

```powershell
pnpm --filter @whatsagent/database migrate:dev --name replace_clerk_with_custom_auth
```

Resultado esperado: migration aplicada com sucesso, sem erros de constraint.

- [ ] **Step 4: Verificar schema no Prisma Studio**

```powershell
pnpm db:studio
```

Confirmar que: `User` não tem `clerkId`, tem `passwordHash` e `googleId`; modelo `RefreshToken` existe.

- [ ] **Step 5: Commit**

```powershell
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(db): replace clerkId with passwordHash/googleId, add RefreshToken model"
```

---

## Task 2: Backend — Instalar dependências e criar DTOs

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/src/modules/auth/dto/register.dto.ts`
- Create: `apps/api/src/modules/auth/dto/login.dto.ts`

- [ ] **Step 1: Instalar novas dependências**

```powershell
pnpm --filter @whatsagent/api add @nestjs/jwt @nestjs/passport passport passport-google-oauth20 bcryptjs
pnpm --filter @whatsagent/api add -D @types/passport-google-oauth20 @types/bcryptjs @types/passport
```

- [ ] **Step 2: Criar RegisterDto**

```typescript
// apps/api/src/modules/auth/dto/register.dto.ts
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  companyName?: string;
}
```

- [ ] **Step 3: Criar LoginDto**

```typescript
// apps/api/src/modules/auth/dto/login.dto.ts
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

- [ ] **Step 4: Commit**

```powershell
git add apps/api/package.json apps/api/src/modules/auth/dto/
git commit -m "feat(api/auth): add auth DTOs and install passport/jwt dependencies"
```

---

## Task 3: Backend — AuthService com testes

**Files:**
- Create: `apps/api/src/modules/auth/auth.service.ts`
- Create: `apps/api/src/modules/auth/auth.service.spec.ts`

- [ ] **Step 1: Escrever os testes que vão falhar**

```typescript
// apps/api/src/modules/auth/auth.service.spec.ts
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  tenant: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn((cb) => cb(mockPrisma)),
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('signed-token'),
  verify: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const values: Record<string, string> = {
      JWT_SECRET: 'test-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
    };
    return values[key];
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('register', () => {
    it('throws ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      await expect(
        service.register({ email: 'a@b.com', name: 'A', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates tenant and user, returns tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: 't1' });
      mockPrisma.user.create.mockResolvedValue({
        id: 'u1', tenantId: 't1', email: 'a@b.com', name: 'A', role: 'OWNER',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({ email: 'a@b.com', name: 'A', password: 'password123' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.tenant.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('x@x.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1', passwordHash: await bcrypt.hash('correct', 10), tenant: { status: 'ACTIVE' },
      });
      await expect(service.login('x@x.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens for valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1', tenantId: 't1', role: 'OWNER', passwordHash: hash,
        tenant: { status: 'ACTIVE' },
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login('a@b.com', 'password123');
      expect(result).toHaveProperty('accessToken');
    });
  });
});
```

- [ ] **Step 2: Rodar os testes — verificar que falham**

```powershell
pnpm --filter @whatsagent/api test -- --testPathPattern="auth.service.spec" --no-coverage
```

Esperado: FAIL — `AuthService` não existe ainda.

- [ ] **Step 3: Implementar AuthService**

```typescript
// apps/api/src/modules/auth/auth.service.ts
import {
  Injectable, ConflictException, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from './dto/register.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const slug = await this.generateTenantSlug(dto.companyName || dto.name, tx as any);
      const tenant = await (tx as any).tenant.create({
        data: { name: dto.companyName || dto.name, slug, status: 'TRIAL', planType: 'STARTER' },
      });
      return (tx as any).user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          name: dto.name,
          passwordHash,
          role: 'OWNER',
          isActive: true,
        },
      });
    });

    return this.generateTokens(user as User);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user?.passwordHash) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.generateTokens(user);
  }

  async googleLogin(profile: { googleId: string; email: string; name: string; avatarUrl?: string }) {
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });

    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
      if (byEmail) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId: profile.googleId, avatarUrl: profile.avatarUrl },
        });
      } else {
        user = await this.prisma.$transaction(async (tx) => {
          const slug = await this.generateTenantSlug(profile.name, tx as any);
          const tenant = await (tx as any).tenant.create({
            data: { name: profile.name, slug, status: 'TRIAL', planType: 'STARTER' },
          });
          return (tx as any).user.create({
            data: {
              tenantId: tenant.id,
              email: profile.email,
              name: profile.name,
              avatarUrl: profile.avatarUrl,
              googleId: profile.googleId,
              role: 'OWNER',
              isActive: true,
            },
          });
        }) as User;
      }
    }

    return this.generateTokens(user!);
  }

  async refreshTokens(refreshToken: string) {
    let payload: { sub: string; tenantId: string; role: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findMany({
      where: { userId: payload.sub, expiresAt: { gt: new Date() } },
    });

    let matched: (typeof stored)[0] | null = null;
    for (const t of stored) {
      if (await bcrypt.compare(refreshToken, t.tokenHash)) {
        matched = t;
        break;
      }
    }

    if (!matched) throw new UnauthorizedException('Invalid refresh token');

    await this.prisma.refreshToken.delete({ where: { id: matched.id } });

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException();

    return this.generateTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      return; // Token já inválido — logout ok
    }

    const tokens = await this.prisma.refreshToken.findMany({ where: { userId: payload.sub } });
    for (const t of tokens) {
      if (await bcrypt.compare(refreshToken, t.tokenHash)) {
        await this.prisma.refreshToken.delete({ where: { id: t.id } });
        return;
      }
    }
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, tenantId: user.tenantId, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  private async generateTenantSlug(name: string, prismaCtx = this.prisma): Promise<string> {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let candidate = base;
    let n = 2;
    while (await (prismaCtx as any).tenant.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${n++}`;
    }
    return candidate;
  }
}
```

- [ ] **Step 4: Rodar os testes — verificar que passam**

```powershell
pnpm --filter @whatsagent/api test -- --testPathPattern="auth.service.spec" --no-coverage
```

Esperado: PASS (todos os testes do describe).

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/modules/auth/
git commit -m "feat(api/auth): implement AuthService with register, login, google, refresh, logout"
```

---

## Task 4: Backend — Strategies JWT e Google

**Files:**
- Create: `apps/api/src/modules/auth/strategies/jwt.strategy.ts`
- Create: `apps/api/src/modules/auth/strategies/google.strategy.ts`

- [ ] **Step 1: Criar JwtStrategy**

```typescript
// apps/api/src/modules/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: { sub: string; tenantId: string; role: string }) {
    return { id: payload.sub, tenantId: payload.tenantId, role: payload.role };
  }
}
```

Nota: `passport-jwt` já está incluído via `@nestjs/passport`. Instalar se faltar:
```powershell
pnpm --filter @whatsagent/api add passport-jwt @types/passport-jwt
```

- [ ] **Step 2: Criar GoogleStrategy**

```typescript
// apps/api/src/modules/auth/strategies/google.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const { id, emails, displayName, photos } = profile;
    done(null, {
      googleId: id,
      email: emails![0].value,
      name: displayName,
      avatarUrl: photos?.[0]?.value,
    });
  }
}
```

- [ ] **Step 3: Commit**

```powershell
git add apps/api/src/modules/auth/strategies/
git commit -m "feat(api/auth): add JwtStrategy and GoogleStrategy"
```

---

## Task 5: Backend — JwtAuthGuard com testes

**Files:**
- Create: `apps/api/src/common/guards/jwt-auth.guard.ts`
- Create: `apps/api/src/common/guards/jwt-auth.guard.spec.ts`

- [ ] **Step 1: Escrever testes que vão falhar**

```typescript
// apps/api/src/common/guards/jwt-auth.guard.spec.ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantStatus } from '@prisma/client';

const mockPrisma = { user: { findUnique: jest.fn() } };

function makeContext(user: object | null) {
  const request = { user, headers: {}, tenantId: null };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard(mockPrisma as any);
    // Mock super.canActivate para retornar true
    jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockResolvedValue(true);
  });

  it('throws UnauthorizedException for inactive user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', isActive: false, tenantId: 't1', tenant: { status: TenantStatus.ACTIVE },
    });
    const ctx = makeContext({ id: 'u1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for suspended tenant', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', isActive: true, tenantId: 't1', tenant: { status: TenantStatus.SUSPENDED },
    });
    const ctx = makeContext({ id: 'u1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('sets req.user and req.tenantId for valid user', async () => {
    const user = { id: 'u1', isActive: true, tenantId: 't1', tenant: { status: TenantStatus.ACTIVE } };
    mockPrisma.user.findUnique.mockResolvedValue(user);
    const request = { user: { id: 'u1' }, tenantId: null };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(request.tenantId).toBe('t1');
    expect(request.user).toEqual(user);
  });
});
```

- [ ] **Step 2: Rodar — verificar falha**

```powershell
pnpm --filter @whatsagent/api test -- --testPathPattern="jwt-auth.guard.spec" --no-coverage
```

Esperado: FAIL — guard não existe.

- [ ] **Step 3: Implementar JwtAuthGuard**

```typescript
// apps/api/src/common/guards/jwt-auth.guard.ts
import {
  Injectable, ExecutionContext, UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { TenantStatus } from '@prisma/client';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const request = context.switchToHttp().getRequest();
    const jwtPayload = request.user as { id: string };

    const user = await this.prismaService.user.findUnique({
      where: { id: jwtPayload.id },
      include: { tenant: true },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

    if (
      user.tenant.status === TenantStatus.SUSPENDED ||
      user.tenant.status === TenantStatus.CANCELLED
    ) {
      throw new UnauthorizedException('Tenant account is suspended');
    }

    request.user = user;
    request.tenantId = user.tenantId;
    return true;
  }
}
```

- [ ] **Step 4: Rodar — verificar que passam**

```powershell
pnpm --filter @whatsagent/api test -- --testPathPattern="jwt-auth.guard.spec" --no-coverage
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/common/guards/jwt-auth.guard.ts apps/api/src/common/guards/jwt-auth.guard.spec.ts
git commit -m "feat(api/auth): implement JwtAuthGuard replacing ClerkAuthGuard"
```

---

## Task 6: Backend — AuthController e AuthModule

**Files:**
- Create: `apps/api/src/modules/auth/auth.controller.ts`
- Create: `apps/api/src/modules/auth/auth.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Criar AuthController**

```typescript
// apps/api/src/modules/auth/auth.controller.ts
import {
  Controller, Post, Get, Body, Req, Res, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Passport redireciona para o Google automaticamente
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const tokens = await this.authService.googleLogin(req.user as any);
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const params = new URLSearchParams({
      token: tokens.accessToken,
      refresh: tokens.refreshToken,
    });
    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Body('refreshToken') refreshToken: string) {
    return this.authService.logout(refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    return req.user;
  }
}
```

- [ ] **Step 2: Criar AuthModule**

```typescript
// apps/api/src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [
    PassportModule,
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRATION', '15m') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
```

- [ ] **Step 3: Atualizar AppModule — trocar ClerkModule por AuthModule**

Abrir `apps/api/src/app.module.ts`. Localizar a importação `ClerkModule` e substituir por `AuthModule`:

```typescript
// Remover:
import { ClerkModule } from './modules/clerk/clerk-webhook.module';

// Adicionar:
import { AuthModule } from './modules/auth/auth.module';

// No array imports[]:
// Remover: ClerkModule,
// Adicionar: AuthModule,
```

- [ ] **Step 4: Verificar compilação**

```powershell
pnpm --filter @whatsagent/api build
```

Esperado: compilação sem erros (pode ter erros de `clerkId` — serão corrigidos na task seguinte).

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/modules/auth/ apps/api/src/app.module.ts
git commit -m "feat(api/auth): add AuthController, AuthModule, wire into AppModule"
```

---

## Task 7: Backend — Remover ClerkModule e substituir guards em todos controllers

**Files:**
- Delete: `apps/api/src/modules/clerk/` (pasta inteira)
- Delete: `apps/api/src/common/guards/clerk-auth.guard.ts`
- Delete: `apps/api/src/common/guards/clerk-auth.guard.spec.ts`
- Modify: todos os controllers que usam `ClerkAuthGuard`

- [ ] **Step 1: Encontrar todos os usos de ClerkAuthGuard**

```powershell
Select-String -Path "apps/api/src/**/*.ts" -Pattern "ClerkAuthGuard" -Recurse
```

Listar todos os arquivos retornados.

- [ ] **Step 2: Substituir import e uso em cada controller**

Para cada arquivo encontrado, fazer a substituição:

```typescript
// Remover:
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard';
// ou qualquer caminho relativo para clerk-auth.guard

// Adicionar:
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// (ajustar caminho relativo conforme localização do arquivo)
```

E substituir `ClerkAuthGuard` por `JwtAuthGuard` em todos os `@UseGuards(...)`.

Executar automaticamente:

```powershell
# PowerShell — substituição em batch
Get-ChildItem -Recurse -Path "apps/api/src" -Filter "*.ts" |
  ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'ClerkAuthGuard') {
      $content = $content -replace 'ClerkAuthGuard', 'JwtAuthGuard'
      $content = $content -replace "clerk-auth\.guard", "jwt-auth.guard"
      Set-Content $_.FullName $content
    }
  }
```

**Atenção:** Verificar manualmente cada arquivo após a substituição para confirmar o import path correto para `jwt-auth.guard`.

- [ ] **Step 3: Deletar ClerkModule**

```powershell
Remove-Item -Recurse -Force "apps/api/src/modules/clerk"
Remove-Item -Force "apps/api/src/common/guards/clerk-auth.guard.ts"
Remove-Item -Force "apps/api/src/common/guards/clerk-auth.guard.spec.ts"
```

- [ ] **Step 4: Verificar compilação**

```powershell
pnpm --filter @whatsagent/api build
```

Esperado: sem erros de imports ou `ClerkAuthGuard`. Erros de `clerkId` no prisma client são esperados se o client não foi regenerado — rodar:

```powershell
pnpm --filter @whatsagent/database generate
```

- [ ] **Step 5: Rodar todos os testes da API**

```powershell
pnpm --filter @whatsagent/api test --no-coverage
```

Esperado: todos os testes existentes passam (exceto testes que explicitamente testavam Clerk).

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "refactor(api): replace ClerkAuthGuard with JwtAuthGuard across all controllers, remove ClerkModule"
```

---

## Task 8: Backend — Atualizar EventsGateway (WebSocket)

**Files:**
- Modify: `apps/api/src/gateways/events.gateway.ts`

- [ ] **Step 1: Inspecionar o gateway atual**

Abrir `apps/api/src/gateways/events.gateway.ts`. Localizar o método `handleConnection` que chama `verifyToken` do Clerk.

- [ ] **Step 2: Substituir verificação Clerk por JwtService**

Substituir a lógica de verificação. O método `handleConnection` deve ficar assim:

```typescript
// Remover imports do Clerk (@clerk/backend)
// Adicionar:
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// No construtor, adicionar JwtService e ConfigService como dependências:
constructor(
  private readonly prismaService: PrismaService,
  private readonly jwtService: JwtService,  // adicionado
  private readonly config: ConfigService,    // adicionado
  // ... outros existentes
) {}

// No handleConnection:
async handleConnection(client: Socket) {
  const token = client.handshake.auth?.token as string;
  if (!token) { client.disconnect(); return; }

  let payload: { sub: string; tenantId: string };
  try {
    payload = this.jwtService.verify(token, {
      secret: this.config.get<string>('JWT_SECRET'),
    });
  } catch {
    client.disconnect();
    return;
  }

  const user = await this.prismaService.user.findUnique({
    where: { id: payload.sub },
    include: { tenant: true },
  });

  if (!user || !user.isActive) { client.disconnect(); return; }

  client.join(`tenant:${user.tenantId}`);
  client.data.tenantId = user.tenantId;
  client.data.userId = user.id;
}
```

Ajustar conforme o código real (pode ter variações de nome de método).

- [ ] **Step 3: Atualizar o módulo do gateway para injetar AuthModule**

O gateway precisa de `JwtService`. Verificar se o módulo do gateway importa `AuthModule`. Se não, adicionar:

```typescript
// No módulo que declara EventsGateway (provavelmente EventsModule ou AppModule):
imports: [..., AuthModule],
```

- [ ] **Step 4: Verificar compilação e testes**

```powershell
pnpm --filter @whatsagent/api build
pnpm --filter @whatsagent/api test --no-coverage
```

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/gateways/
git commit -m "refactor(api/gateway): replace Clerk token verification with JwtService in EventsGateway"
```

---

## Task 9: Frontend — AuthContext

**Files:**
- Create: `apps/web/src/contexts/auth-context.tsx`
- Modify: `apps/web/src/app/providers.tsx`

- [ ] **Step 1: Criar AuthContext**

```typescript
// apps/web/src/contexts/auth-context.tsx
'use client';

import {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
  tenantId: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function setAccessTokenCookie(token: string) {
  const expires = new Date(Date.now() + 15 * 60 * 1000).toUTCString();
  document.cookie = `access_token=${token}; path=/; expires=${expires}; SameSite=Strict`;
}

function clearAccessTokenCookie() {
  document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

function saveSession(tokens: AuthTokens) {
  localStorage.setItem('refresh_token', tokens.refreshToken);
  localStorage.setItem('auth_user', JSON.stringify(tokens.user));
  setAccessTokenCookie(tokens.accessToken);
}

function clearSession() {
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('auth_user');
  clearAccessTokenCookie();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const applyTokens = useCallback((tokens: AuthTokens) => {
    saveSession(tokens);
    setToken(tokens.accessToken);
    setUser(tokens.user);
  }, []);

  // Restaurar sessão ao montar (via refresh token)
  useEffect(() => {
    const stored = localStorage.getItem('refresh_token');
    if (!stored) { setIsLoaded(true); return; }

    fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored }),
    })
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data: AuthTokens) => applyTokens(data))
      .catch(() => clearSession())
      .finally(() => setIsLoaded(true));
  }, [applyTokens]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? 'Invalid credentials');
    }
    applyTokens(await res.json());
  }, [applyTokens]);

  const loginWithGoogle = useCallback(() => {
    window.location.href = `${API_URL}/auth/google`;
  }, []);

  const logout = useCallback(async () => {
    const stored = localStorage.getItem('refresh_token');
    if (token && stored) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ refreshToken: stored }),
      }).catch(() => {});
    }
    clearSession();
    setToken(null);
    setUser(null);
  }, [token]);

  return (
    <AuthContext.Provider value={{
      user, token, isLoaded,
      isSignedIn: !!user,
      login, loginWithGoogle, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Atualizar providers.tsx — trocar ClerkProvider por AuthProvider**

```typescript
// apps/web/src/app/providers.tsx
'use client';

import { AuthProvider } from '@/contexts/auth-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
```

Remover todos os imports do Clerk.

- [ ] **Step 3: Commit**

```powershell
git add apps/web/src/contexts/auth-context.tsx apps/web/src/app/providers.tsx
git commit -m "feat(web/auth): implement AuthContext replacing ClerkProvider"
```

---

## Task 10: Frontend — Middleware customizado

**Files:**
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Substituir clerkMiddleware**

```typescript
// apps/web/src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = [
  '/setup', '/overview', '/analytics', '/catalog',
  '/inbox', '/orders', '/agent', '/settings', '/support', '/tenants',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));

  if (isProtected) {
    const token = req.cookies.get('access_token')?.value;
    if (!token) {
      const signIn = new URL('/sign-in', req.url);
      signIn.searchParams.set('redirect', pathname);
      return NextResponse.redirect(signIn);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
```

- [ ] **Step 2: Commit**

```powershell
git add apps/web/src/middleware.ts
git commit -m "refactor(web): replace clerkMiddleware with custom JWT cookie middleware"
```

---

## Task 11: Frontend — Páginas de Sign-in e Sign-up

**Files:**
- Create: `apps/web/src/app/(auth)/sign-in/page.tsx`
- Create: `apps/web/src/app/(auth)/sign-up/page.tsx`
- Create: `apps/web/src/app/(auth)/layout.tsx`

- [ ] **Step 1: Criar layout do grupo (auth)**

```typescript
// apps/web/src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Criar página de Sign-in**

```typescript
// apps/web/src/app/(auth)/sign-in/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthContext } from '@/contexts/auth-context';

export default function SignInPage() {
  const { login, loginWithGoogle } = useAuthContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/overview';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.push(redirect);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-2xl rounded-2xl p-8 border border-slate-800">
      <h1 className="text-2xl font-bold text-white mb-6">Entrar</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-colors"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700" />
        </div>
        <div className="relative text-center text-sm text-slate-500">
          <span className="px-2 bg-slate-900">ou</span>
        </div>
      </div>

      <button
        onClick={loginWithGoogle}
        className="w-full flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-2 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continuar com Google
      </button>

      <p className="text-center text-sm text-slate-400 mt-4">
        Não tem conta?{' '}
        <Link href="/sign-up" className="text-green-400 hover:underline">Cadastrar</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Criar página de Sign-up**

```typescript
// apps/web/src/app/(auth)/sign-up/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthContext } from '@/contexts/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

export default function SignUpPage() {
  const { loginWithGoogle, login } = useAuthContext();
  const router = useRouter();

  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Erro ao criar conta');
      }
      await login(form.email, form.password);
      router.push('/setup');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-2xl rounded-2xl p-8 border border-slate-800">
      <h1 className="text-2xl font-bold text-white mb-6">Criar conta</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { label: 'Nome', key: 'name', type: 'text' },
          { label: 'Email', key: 'email', type: 'email' },
          { label: 'Senha', key: 'password', type: 'password' },
          { label: 'Nome da empresa (opcional)', key: 'companyName', type: 'text' },
        ].map(({ label, key, type }) => (
          <div key={key}>
            <label className="block text-sm text-slate-400 mb-1">{label}</label>
            <input
              type={type}
              value={form[key as keyof typeof form]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              required={key !== 'companyName'}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
            />
          </div>
        ))}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-colors"
        >
          {loading ? 'Criando...' : 'Criar conta'}
        </button>
      </form>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700" />
        </div>
        <div className="relative text-center text-sm text-slate-500">
          <span className="px-2 bg-slate-900">ou</span>
        </div>
      </div>

      <button
        onClick={loginWithGoogle}
        className="w-full flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-2 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continuar com Google
      </button>

      <p className="text-center text-sm text-slate-400 mt-4">
        Já tem conta?{' '}
        <Link href="/sign-in" className="text-green-400 hover:underline">Entrar</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```powershell
git add apps/web/src/app/(auth)/
git commit -m "feat(web/auth): add sign-in and sign-up pages with email/password and Google OAuth"
```

---

## Task 12: Frontend — Google OAuth Callback Page

**Files:**
- Create: `apps/web/src/app/auth/callback/page.tsx`

- [ ] **Step 1: Criar callback page**

```typescript
// apps/web/src/app/auth/callback/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthContext } from '@/contexts/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded } = useAuthContext();

  useEffect(() => {
    if (!isLoaded) return;

    const token = searchParams.get('token');
    const refresh = searchParams.get('refresh');

    if (!token || !refresh) {
      router.replace('/sign-in?error=oauth_failed');
      return;
    }

    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((user) => {
        localStorage.setItem('refresh_token', refresh);
        localStorage.setItem('auth_user', JSON.stringify(user));
        const expires = new Date(Date.now() + 15 * 60 * 1000).toUTCString();
        document.cookie = `access_token=${token}; path=/; expires=${expires}; SameSite=Strict`;
        router.replace('/overview');
      })
      .catch(() => router.replace('/sign-in?error=oauth_failed'));
  }, [isLoaded, router, searchParams]);

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <p className="text-slate-400">Autenticando...</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add apps/web/src/app/auth/callback/
git commit -m "feat(web/auth): add Google OAuth callback page"
```

---

## Task 13: Frontend — Atualizar useApi, useSocket, Header e Landing

**Files:**
- Modify: `apps/web/src/lib/hooks/useApi.ts`
- Modify: `apps/web/src/hooks/useSocket.ts`
- Modify: `apps/web/src/components/layout/Header.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Verify/Modify: `apps/web/src/app/(onboarding)/setup/plan/page.tsx`
- Verify/Modify: `apps/web/src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Atualizar useApi.ts**

```typescript
// apps/web/src/lib/hooks/useApi.ts
'use client';

import { useCallback } from 'react';
import { useAuthContext } from '@/contexts/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

export function useApi() {
  const { token } = useAuthContext();

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}): Promise<Response> => {
      return fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });
    },
    [token],
  );

  return { apiFetch, API_URL };
}
```

- [ ] **Step 2: Atualizar useSocket.ts**

```typescript
// apps/web/src/hooks/useSocket.ts
// Substituir useAuth() do Clerk por useAuthContext()
// Remover: import { useAuth } from '@clerk/nextjs';
// Adicionar:
import { useAuthContext } from '@/contexts/auth-context';

// Dentro do hook:
const { token } = useAuthContext();
// Usar token diretamente (sem await getToken())
// Remover padrão async getToken() — token é síncrono agora
```

- [ ] **Step 3: Atualizar Header.tsx**

```typescript
// apps/web/src/components/layout/Header.tsx
// Remover: import { useUser, useClerk } from '@clerk/nextjs';
// Adicionar:
import { useAuthContext } from '@/contexts/auth-context';

// Dentro do componente:
const { user, logout } = useAuthContext();
// Usar user.name, user.avatarUrl, logout()
// Remover: const { user } = useUser(); const { signOut } = useClerk();
```

- [ ] **Step 4: Atualizar Landing page (page.tsx)**

```typescript
// apps/web/src/app/page.tsx
// Remover: import { SignInButton, SignUpButton, useAuth } from '@clerk/nextjs';
// Adicionar:
import Link from 'next/link';
import { useAuthContext } from '@/contexts/auth-context';

// Substituir <SignInButton> por <Link href="/sign-in">Entrar</Link>
// Substituir <SignUpButton> por <Link href="/sign-up">Começar grátis</Link>
// Para verificar isSignedIn: const { isSignedIn } = useAuthContext();
```

- [ ] **Step 5: Verificar e atualizar setup/plan e settings**

Abrir cada arquivo e substituir qualquer `useAuth()`, `useUser()`, `useClerk()` do Clerk pelo `useAuthContext()` equivalente.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/
git commit -m "refactor(web): replace all Clerk hooks with useAuthContext across components and hooks"
```

---

## Task 14: Limpeza Final — Remover Clerk e Atualizar Env

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/api/package.json`
- Modify: `.env.example`

- [ ] **Step 1: Remover pacotes Clerk**

```powershell
pnpm --filter @whatsagent/web remove @clerk/nextjs
pnpm --filter @whatsagent/api remove @clerk/backend svix
```

- [ ] **Step 2: Atualizar .env.example**

Remover:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
```

Adicionar:
```
# Auth JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-different-from-jwt-secret
JWT_EXPIRATION=15m

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3002/auth/google/callback

# Frontend URL (para redirect após Google OAuth)
FRONTEND_URL=http://localhost:3000
```

- [ ] **Step 3: Build completo para validar**

```powershell
pnpm build
```

Esperado: todos os pacotes compilam sem erros.

- [ ] **Step 4: Rodar todos os testes**

```powershell
pnpm test
```

Esperado: todos os testes passam.

- [ ] **Step 5: Commit final**

```powershell
git add .
git commit -m "chore: remove Clerk dependencies, update env.example with custom auth vars"
```

---

## Verificação End-to-End

Após todas as tasks, verificar o fluxo completo:

1. **Iniciar infraestrutura:**
   ```powershell
   pnpm docker:up
   pnpm db:migrate
   ```

2. **Iniciar todos os serviços:**
   ```powershell
   pnpm dev
   ```

3. **Testar cadastro email/senha:**
   - Acessar `http://localhost:3000/sign-up`
   - Criar conta com email + senha
   - Verificar redirecionamento para `/setup`
   - Verificar que um Tenant e User foram criados (via Prisma Studio)

4. **Testar login email/senha:**
   - Fazer logout
   - Acessar `http://localhost:3000/sign-in`
   - Logar com as credenciais criadas
   - Verificar redirecionamento para `/overview`

5. **Testar proteção de rotas:**
   - Limpar cookies/localStorage
   - Acessar `http://localhost:3000/overview` diretamente
   - Verificar redirecionamento para `/sign-in`

6. **Testar Google OAuth:**
   - Configurar Google OAuth App no Google Cloud Console
   - Setar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` no `.env`
   - Clicar "Continuar com Google" na página de sign-in
   - Verificar callback e criação de usuário

7. **Testar refresh de token:**
   - Logar normalmente
   - Via DevTools, deletar o cookie `access_token` (mas manter `refresh_token` no localStorage)
   - Recarregar a página
   - Verificar que o AuthProvider renova o token automaticamente e usuário permanece logado

8. **Testar WebSocket:**
   - Navegar para `/inbox` (usa WebSocket)
   - Verificar no console do browser que a conexão foi estabelecida sem erros

---

## Setup do Google OAuth (pré-requisito externo)

Antes de testar o fluxo Google:

1. Acessar [Google Cloud Console](https://console.cloud.google.com)
2. Criar projeto ou usar existente
3. Ativar **Google+ API** e **Google OAuth API**
4. Em "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Tipo: **Web Application**
6. Authorized redirect URIs: `http://localhost:3002/auth/google/callback`
7. Copiar Client ID e Client Secret para o `.env`
