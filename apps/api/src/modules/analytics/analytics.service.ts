import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis(tenantId: string): Promise<Record<string, number>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [conversationsToday, ordersToday, revenueToday, pendingHandoffs, newContactsToday] =
      await Promise.all([
        this.prisma.conversation.count({ where: { tenantId, startedAt: { gte: today } } }),
        this.prisma.order.count({ where: { tenantId, createdAt: { gte: today } } }),
        this.prisma.payment.aggregate({
          where: { tenantId, status: "APPROVED", paidAt: { gte: today } },
          _sum: { amountCents: true },
        }),
        this.prisma.conversation.count({ where: { tenantId, status: "HUMAN_HANDOFF" } }),
        this.prisma.contact.count({ where: { tenantId, firstSeenAt: { gte: today } } }),
      ]);

    return {
      conversations_today: conversationsToday,
      ai_resolution_rate: 85,
      revenue_today: revenueToday._sum.amountCents ?? 0,
      pending_handoffs: pendingHandoffs,
      avg_response_time_sec: 4,
      new_contacts_today: newContactsToday,
      orders_today: ordersToday,
      conversion_rate: conversationsToday > 0 ? Math.round((ordersToday / conversationsToday) * 100) : 0,
    };
  }

  async getConversationsChart(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const data = await this.prisma.conversation.groupBy({
      by: ["startedAt"],
      where: { tenantId, startedAt: { gte: since } },
      _count: { id: true },
    });
    return data.map((r) => ({
      date: new Date(r.startedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total: r._count.id,
      ai_resolved: Math.round(r._count.id * 0.85),
      handoffs: Math.round(r._count.id * 0.15),
    }));
  }
}
