import { randomUUID } from "crypto";
import { Injectable, Logger } from "@nestjs/common";
import { PlanType, TenantStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

interface ClerkUserPayload {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  primary_email_address_id: string;
  email_addresses: Array<{ id: string; email_address: string }>;
  public_metadata?: {
    tenantId?: string;
  };
}

@Injectable()
export class ClerkWebhookService {
  private readonly logger = new Logger(ClerkWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleUserCreated(data: ClerkUserPayload): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { clerkId: data.id } });
    if (existing) {
      this.logger.warn(`user.created ignorado — clerkId ${data.id} ja existe`);
      return;
    }

    const email =
      data.email_addresses.find((e) => e.id === data.primary_email_address_id)
        ?.email_address ?? data.email_addresses[0]?.email_address ?? "";

    const rawName = [data.first_name, data.last_name].filter(Boolean).join(" ");
    const name: string = rawName || (email.split("@")[0] ?? "unknown");
    const slug = this.buildSlug(email);

    await this.prisma.$transaction(async (tx) => {
      const metadataTenantId = data.public_metadata?.tenantId;
      let tenant = metadataTenantId
        ? await tx.tenant.findUnique({ where: { id: metadataTenantId } })
        : null;

      if (!tenant) {
        tenant = await tx.tenant.create({
          data: { name, slug, status: TenantStatus.TRIAL, planType: PlanType.STARTER },
        });
      }

      const existingUsers = await tx.user.count({ where: { tenantId: tenant.id } });
      const role = existingUsers === 0 ? "OWNER" : "AGENT";

      await tx.user.create({
        data: {
          tenantId: tenant.id,
          clerkId: data.id,
          email,
          name,
          avatarUrl: data.image_url,
          role,
          isActive: true,
        },
      });

      this.logger.log(`Tenant + User criados para ${email} (tenant: ${tenant.id})`);
    });
  }

  async handleUserUpdated(data: ClerkUserPayload): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { clerkId: data.id } });
    if (!existing) return;

    const email =
      data.email_addresses.find((e) => e.id === data.primary_email_address_id)
        ?.email_address ?? data.email_addresses[0]?.email_address ?? existing.email;

    const rawName = [data.first_name, data.last_name].filter(Boolean).join(" ");
    const name: string = rawName || (email.split("@")[0] ?? "unknown");

    await this.prisma.user.update({
      where: { clerkId: data.id },
      data: { name, email, avatarUrl: data.image_url },
    });

    this.logger.log(`User atualizado: clerkId ${data.id}`);
  }

  async handleUserDeleted(clerkId: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { clerkId } });
    if (!existing) return;

    await this.prisma.user.update({ where: { clerkId }, data: { isActive: false } });
    this.logger.log(`User desativado: clerkId ${clerkId}`);
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
