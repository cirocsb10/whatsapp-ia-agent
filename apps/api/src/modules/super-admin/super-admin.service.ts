import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllTenants(page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const [rawItems, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          planType: true,
          whatsappPhoneId: true,
          whatsappStatus: true,
          whatsappNumber: true,
          whatsappQualityRating: true,
          whatsappQualityCheckedAt: true,
          timezone: true,
          segment: true,
          locale: true,
          logoUrl: true,
          createdAt: true,
          updatedAt: true,
          metaAccessToken: true,
          stripeCustomerId: true,
          _count: { select: { conversations: true } },
          billing: {
            select: { conversationsThisMonth: true, conversationsLimit: true },
          },
        },
      }),
      this.prisma.tenant.count(),
    ]);

    // Nunca expor credenciais vivas (token do WhatsApp Cloud API) na listagem do
    // super-admin — apenas indicar presença, como já é feito em ChannelsService.toPublic().
    const items = rawItems.map(({ metaAccessToken, stripeCustomerId, ...rest }) => ({
      ...rest,
      hasMetaAccessToken: Boolean(metaAccessToken),
      hasStripeCustomer: Boolean(stripeCustomerId),
    }));

    return { items, total };
  }

  async getPlatformKpis() {
    const [totalTenants, activeTenants, totalConversations] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: "ACTIVE" } }),
      this.prisma.conversation.count(),
    ]);
    return { total_tenants: totalTenants, active_tenants: activeTenants, total_conversations: totalConversations };
  }

  async suspendTenant(tenantId: string) { return this.prisma.tenant.update({ where: { id: tenantId }, data: { status: "SUSPENDED" } }); }
  async activateTenant(tenantId: string) { return this.prisma.tenant.update({ where: { id: tenantId }, data: { status: "ACTIVE" } }); }
}
