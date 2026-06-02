import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllTenants(page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { conversations: true } },
          billing: {
            select: { conversationsThisMonth: true, conversationsLimit: true },
          },
        },
      }),
      this.prisma.tenant.count(),
    ]);
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
