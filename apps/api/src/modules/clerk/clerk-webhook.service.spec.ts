import { Test } from "@nestjs/testing";
import { ClerkWebhookService } from "./clerk-webhook.service";
import { PrismaService } from "../../common/prisma/prisma.service";

type MockPrisma = {
  $transaction: jest.Mock;
  tenant: { create: jest.Mock; findUnique: jest.Mock };
  user: { findUnique: jest.Mock; count: jest.Mock; create: jest.Mock; update: jest.Mock };
};

const mockPrisma: MockPrisma = {
  $transaction: jest.fn((fn: (tx: MockPrisma) => Promise<void>) => fn(mockPrisma as MockPrisma)),
  tenant: { create: jest.fn(), findUnique: jest.fn() },
  user: {
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const clerkUserPayload = {
  id: "user_clerk_123",
  first_name: "João",
  last_name: "Silva",
  image_url: "https://img.clerk.com/avatar.jpg",
  primary_email_address_id: "iea_1",
  email_addresses: [{ id: "iea_1", email_address: "joao@exemplo.com.br" }],
};

describe("ClerkWebhookService", () => {
  let service: ClerkWebhookService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ClerkWebhookService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ClerkWebhookService>(ClerkWebhookService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: MockPrisma) => Promise<void>) => fn(mockPrisma),
    );
  });

  describe("handleUserCreated", () => {
    it("deve criar Tenant e User quando usuario nao existe", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: "tenant_abc" });
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.user.create.mockResolvedValue({ id: "user_abc" });

      await service.handleUserCreated(clerkUserPayload);

      expect(mockPrisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "João Silva",
            status: "TRIAL",
            planType: "STARTER",
          }),
        }),
      );
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clerkId: "user_clerk_123",
            email: "joao@exemplo.com.br",
            name: "João Silva",
            role: "OWNER",
            isActive: true,
          }),
        }),
      );
    });

    it("nao deve criar duplicado se usuario ja existe no banco", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user_existente" });

      await service.handleUserCreated(clerkUserPayload);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.tenant.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it("usa prefixo do email como nome quando first_name e null", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: "tenant_abc" });
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.user.create.mockResolvedValue({ id: "user_abc" });

      await service.handleUserCreated({ ...clerkUserPayload, first_name: null, last_name: null });

      expect(mockPrisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "joao" }),
        }),
      );
    });
  });

  describe("handleUserUpdated", () => {
    it("deve atualizar name, email e avatarUrl se usuario existe", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user_abc", email: "joao@exemplo.com.br" });

      await service.handleUserUpdated(clerkUserPayload);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { clerkId: "user_clerk_123" },
        data: {
          name: "João Silva",
          email: "joao@exemplo.com.br",
          avatarUrl: "https://img.clerk.com/avatar.jpg",
        },
      });
    });

    it("nao faz nada se usuario nao existe no banco", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.handleUserUpdated(clerkUserPayload);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("usa prefixo do email como nome quando first_name e null", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user_abc", email: "joao@exemplo.com.br" });

      await service.handleUserUpdated({ ...clerkUserPayload, first_name: null, last_name: null });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "joao" }),
        }),
      );
    });
  });

  describe("handleUserDeleted", () => {
    it("deve desativar usuario", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user_abc" });

      await service.handleUserDeleted("user_clerk_123");

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { clerkId: "user_clerk_123" },
        data: { isActive: false },
      });
    });

    it("nao faz nada se usuario nao existe", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.handleUserDeleted("user_clerk_123");

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});
