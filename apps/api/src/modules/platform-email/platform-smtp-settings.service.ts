import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  decryptSecret,
  encryptSecret,
  getEncryptionKey,
} from "../../common/crypto/secret-cipher.util";
import { buildTransporter, formatFrom } from "../../common/mail/smtp-transporter.util";
import { TestSmtpSettingsDto, UpdateSmtpSettingsDto } from "./dto/smtp-settings.dto";

const SETTINGS_ID = "default";

export interface SmtpSendingConfig {
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  secure: boolean;
  fromEmail: string;
  fromName: string | null;
}

function isPasswordProvided(password: string | null | undefined): password is string {
  return typeof password === "string" && password.trim() !== "";
}

@Injectable()
export class PlatformSmtpSettingsService {
  private encryptionKey: Buffer | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Resolvido tardiamente (não no construtor) para que uma
   * SETTINGS_ENCRYPTION_KEY ausente/malformada só quebre operações que
   * dependem de SMTP, em vez de derrubar toda a API no bootstrap.
   */
  private getKey(): Buffer {
    if (!this.encryptionKey) {
      this.encryptionKey = getEncryptionKey(this.config);
    }
    return this.encryptionKey;
  }

  async getSettings() {
    const settings = await this.prisma.platformSmtpSettings.findUnique({
      where: { id: SETTINGS_ID },
    });

    if (!settings) {
      return {
        id: SETTINGS_ID,
        host: null,
        port: 587,
        username: null,
        secure: false,
        fromEmail: null,
        fromName: null,
        hasPassword: false,
        configured: false,
        updatedAt: new Date(),
      };
    }

    const { passwordEncrypted, ...rest } = settings;
    return {
      ...rest,
      hasPassword: Boolean(passwordEncrypted),
      configured: Boolean(settings.host && settings.fromEmail),
    };
  }

  async updateSettings(dto: UpdateSmtpSettingsDto) {
    const passwordEncrypted = isPasswordProvided(dto.password)
      ? encryptSecret(dto.password, this.getKey())
      : undefined;

    const updated = await this.prisma.platformSmtpSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        host: dto.host ?? null,
        port: dto.port ?? 587,
        username: dto.username ?? null,
        passwordEncrypted: passwordEncrypted ?? null,
        secure: dto.secure ?? false,
        fromEmail: dto.fromEmail ?? null,
        fromName: dto.fromName ?? null,
      },
      update: {
        ...(dto.host !== undefined && { host: dto.host || null }),
        ...(dto.port !== undefined && { port: dto.port }),
        ...(dto.username !== undefined && { username: dto.username || null }),
        ...(passwordEncrypted !== undefined && { passwordEncrypted }),
        ...(dto.secure !== undefined && { secure: dto.secure }),
        ...(dto.fromEmail !== undefined && { fromEmail: dto.fromEmail || null }),
        ...(dto.fromName !== undefined && { fromName: dto.fromName || null }),
      },
    });

    const { passwordEncrypted: _omitted, ...rest } = updated;
    return {
      ...rest,
      hasPassword: Boolean(updated.passwordEncrypted),
      configured: Boolean(updated.host && updated.fromEmail),
    };
  }

  async getSettingsForSending(): Promise<SmtpSendingConfig | null> {
    const settings = await this.prisma.platformSmtpSettings.findUnique({
      where: { id: SETTINGS_ID },
    });

    if (!settings?.host || !settings.fromEmail) {
      return null;
    }

    let password: string | null = null;
    if (settings.passwordEncrypted) {
      try {
        password = decryptSecret(settings.passwordEncrypted, this.getKey());
      } catch {
        throw new Error(
          "Falha ao descriptografar a senha SMTP salva. Reconfigure as credenciais em Plataforma > Email.",
        );
      }
    }

    if (settings.username && !password) {
      throw new Error(
        "SMTP configurado com usuário mas sem senha. Configure a senha em Plataforma > Email.",
      );
    }

    return {
      host: settings.host,
      port: settings.port ?? 587,
      username: settings.username,
      password,
      secure: settings.secure,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
    };
  }

  async sendTestEmail(dto: TestSmtpSettingsDto) {
    // A config salva pode estar incompleta ou indescriptografável — isso não
    // deve bloquear o teste de overrides ainda não salvos vindos do formulário.
    let saved: SmtpSendingConfig | null = null;
    try {
      saved = await this.getSettingsForSending();
    } catch {
      saved = null;
    }

    const host = dto.host ?? saved?.host;
    const port = dto.port ?? saved?.port ?? 587;
    const username = dto.username !== undefined ? dto.username || null : (saved?.username ?? null);
    const secure = dto.secure ?? saved?.secure ?? false;
    const fromEmail = dto.fromEmail ?? saved?.fromEmail;
    const fromName = dto.fromName !== undefined ? dto.fromName || null : (saved?.fromName ?? null);

    const password = isPasswordProvided(dto.password) ? dto.password : (saved?.password ?? null);

    if (!host || !fromEmail) {
      throw new BadRequestException("Host SMTP e e-mail remetente são obrigatórios para o teste");
    }

    if (username && !password) {
      throw new BadRequestException(
        "Usuário SMTP informado sem senha. Preencha a senha para autenticar.",
      );
    }

    try {
      const transporter = buildTransporter({
        host,
        port,
        secure,
        username,
        password,
        fromEmail,
        fromName,
      });

      await transporter.sendMail({
        from: formatFrom(fromName, fromEmail),
        to: dto.to,
        subject: "E-mail de teste — WhatsAgent",
        html: "<p>Este é um e-mail de teste enviado pela plataforma WhatsAgent.</p>",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar e-mail de teste";
      throw new BadRequestException(message);
    }

    return { success: true };
  }
}
