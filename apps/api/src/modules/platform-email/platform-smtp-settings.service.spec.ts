import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PlatformSmtpSettingsService } from "./platform-smtp-settings.service";
import { PrismaService } from "../../common/prisma/prisma.service";

const sendMailMock = jest.fn().mockResolvedValue({ messageId: "test" });
jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({ sendMail: sendMailMock })),
}));

// 32 bytes -> base64 (chave válida para AES-256-GCM).
const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

const mockPrisma = {
  platformSmtpSettings: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

describe("PlatformSmtpSettingsService", () => {
  let service: PlatformSmtpSettingsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PlatformSmtpSettingsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === "SETTINGS_ENCRYPTION_KEY" ? ENCRYPTION_KEY : undefined,
            ),
          },
        },
      ],
    }).compile();

    service = module.get(PlatformSmtpSettingsService);
    jest.clearAllMocks();
  });

  it("retorna config padrão não configurada quando não há registro", async () => {
    mockPrisma.platformSmtpSettings.findUnique.mockResolvedValue(null);

    const result = await service.getSettings();

    expect(result.configured).toBe(false);
    expect(result.hasPassword).toBe(false);
    expect(result.port).toBe(587);
  });

  it("nunca expõe a senha criptografada no getSettings", async () => {
    mockPrisma.platformSmtpSettings.findUnique.mockResolvedValue({
      id: "default",
      host: "smtp.gmail.com",
      port: 587,
      username: "user@gmail.com",
      passwordEncrypted: "iv:tag:data",
      secure: false,
      fromEmail: "no-reply@whatsagent.com",
      fromName: "WhatsAgent",
      updatedAt: new Date(),
    });

    const result = (await service.getSettings()) as Record<string, unknown>;

    expect(result.passwordEncrypted).toBeUndefined();
    expect(result.hasPassword).toBe(true);
    expect(result.configured).toBe(true);
  });

  it("criptografa a senha ao atualizar e faz round-trip na descriptografia", async () => {
    let stored: string | null = null;
    mockPrisma.platformSmtpSettings.upsert.mockImplementation(({ create }) => {
      stored = create.passwordEncrypted;
      return {
        id: "default",
        host: "smtp.gmail.com",
        port: 587,
        username: "user@gmail.com",
        passwordEncrypted: create.passwordEncrypted,
        secure: false,
        fromEmail: "no-reply@whatsagent.com",
        fromName: "WhatsAgent",
        updatedAt: new Date(),
      };
    });

    const updated = (await service.updateSettings({
      host: "smtp.gmail.com",
      username: "user@gmail.com",
      password: "s3cr3t-pass",
      fromEmail: "no-reply@whatsagent.com",
    })) as Record<string, unknown>;

    expect(stored).toBeTruthy();
    expect(stored).not.toContain("s3cr3t-pass");
    expect(updated.passwordEncrypted).toBeUndefined();
    expect(updated.hasPassword).toBe(true);

    // getSettingsForSending deve descriptografar de volta ao texto original.
    mockPrisma.platformSmtpSettings.findUnique.mockResolvedValue({
      id: "default",
      host: "smtp.gmail.com",
      port: 587,
      username: "user@gmail.com",
      passwordEncrypted: stored,
      secure: false,
      fromEmail: "no-reply@whatsagent.com",
      fromName: "WhatsAgent",
      updatedAt: new Date(),
    });

    const sending = await service.getSettingsForSending();
    expect(sending?.password).toBe("s3cr3t-pass");
  });

  it("retorna null em getSettingsForSending quando host/fromEmail ausentes", async () => {
    mockPrisma.platformSmtpSettings.findUnique.mockResolvedValue({
      id: "default",
      host: null,
      port: 587,
      username: null,
      passwordEncrypted: null,
      secure: false,
      fromEmail: null,
      fromName: null,
      updatedAt: new Date(),
    });

    expect(await service.getSettingsForSending()).toBeNull();
  });

  it("envia e-mail de teste usando overrides do formulário", async () => {
    mockPrisma.platformSmtpSettings.findUnique.mockResolvedValue(null);

    const result = await service.sendTestEmail({
      host: "smtp.mailtrap.io",
      port: 2525,
      username: "u",
      password: "p",
      fromEmail: "no-reply@whatsagent.com",
      to: "admin@whatsagent.com",
    });

    expect(result).toEqual({ success: true });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });
});
