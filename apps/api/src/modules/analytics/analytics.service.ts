import { Injectable, Inject } from "@nestjs/common";
import { Redis } from "ioredis";
import { PrismaService } from "../../common/prisma/prisma.service";

/**
 * TTLs curtos: o dashboard é near-real-time, não precisa ser ao segundo.
 * Resolve B1 na raiz (analytics recalculava ~30 queries por load, sem cache).
 */
const TTL_KPIS = 30;
const TTL_TRENDS = 45;
const TTL_AGG = 60;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("REDIS_CLIENT") private readonly redis: Redis,
  ) {}

  /** Cache-aside sobre Redis. Falhas de cache degradam para o cálculo direto. */
  private async cached<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    try {
      const hit = await this.redis.get(key);
      if (hit) return JSON.parse(hit) as T;
    } catch {
      /* cache indisponível → recalcula */
    }
    const value = await compute();
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      /* ignora erros de escrita no cache */
    }
    return value;
  }

  getKpis(tenantId: string): Promise<Record<string, number | null>> {
    return this.cached(`analytics:${tenantId}:kpis`, TTL_KPIS, () => this.computeKpis(tenantId));
  }

  private async computeKpis(tenantId: string): Promise<Record<string, number | null>> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      conversationsToday,
      ordersToday,
      revenueToday,
      pendingHandoffs,
      newContactsToday,
      closedToday,
      closedByAiToday,
      latencyResult,
      csatResult,
      tokensResult,
    ] = await Promise.all([
      this.prisma.conversation.count({ where: { tenantId, startedAt: { gte: startOfDay } } }),
      this.prisma.order.count({ where: { tenantId, createdAt: { gte: startOfDay } } }),
      this.prisma.payment.aggregate({
        where: { tenantId, status: "APPROVED", paidAt: { gte: startOfDay } },
        _sum: { amountCents: true },
      }),
      this.prisma.conversation.count({ where: { tenantId, status: "HUMAN_HANDOFF" } }),
      this.prisma.contact.count({ where: { tenantId, firstSeenAt: { gte: startOfDay } } }),
      this.prisma.conversation.count({
        where: { tenantId, status: "CLOSED", closedAt: { gte: startOfDay } },
      }),
      this.prisma.conversation.count({
        where: {
          tenantId,
          status: "CLOSED",
          closedAt: { gte: startOfDay },
          messages: { some: { isFromAi: true } },
          handoffEvents: { none: {} },
        },
      }),
      this.prisma.message.aggregate({
        where: {
          tenantId,
          isFromAi: true,
          aiLatencyMs: { not: null },
          sentAt: { gte: startOfDay },
        },
        _avg: { aiLatencyMs: true },
      }),
      this.prisma.conversation.aggregate({
        where: {
          tenantId,
          csatScore: { not: null },
          closedAt: { gte: sevenDaysAgo },
        },
        _avg: { csatScore: true },
      }),
      this.prisma.message.aggregate({
        where: {
          tenantId,
          isFromAi: true,
          aiTokensUsed: { not: null },
          sentAt: { gte: startOfDay },
        },
        _sum: { aiTokensUsed: true },
      }),
    ]);

    const ai_resolution_rate =
      closedToday > 0 ? Math.round((closedByAiToday / closedToday) * 100) : 0;

    const avg_response_time_sec = latencyResult._avg.aiLatencyMs
      ? Math.round(latencyResult._avg.aiLatencyMs / 1000)
      : 0;

    const avg_csat_score = csatResult._avg.csatScore
      ? Number(csatResult._avg.csatScore.toFixed(1))
      : null;

    const ai_tokens_today = tokensResult._sum.aiTokensUsed ?? 0;

    return {
      conversations_today: conversationsToday,
      ai_resolution_rate,
      revenue_today: revenueToday._sum.amountCents ?? 0,
      pending_handoffs: pendingHandoffs,
      avg_response_time_sec,
      new_contacts_today: newContactsToday,
      orders_today: ordersToday,
      conversion_rate: conversationsToday > 0 ? Math.round((ordersToday / conversationsToday) * 100) : 0,
      avg_csat_score,
      ai_tokens_today,
    };
  }

  getConversationsChart(tenantId: string, days = 30) {
    return this.cached(`analytics:${tenantId}:conv-chart:${days}`, TTL_AGG, () =>
      this.computeConversationsChart(tenantId, days),
    );
  }

  private async computeConversationsChart(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);

    type Row = { day: Date; total: bigint; ai_resolved: bigint; handoffs: bigint };
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT
        DATE_TRUNC('day', c."startedAt") AS day,
        COUNT(c.id)                       AS total,
        COUNT(CASE
          WHEN c.status = 'CLOSED'
           AND NOT EXISTS (
             SELECT 1 FROM "HandoffEvent" h WHERE h."conversationId" = c.id
           )
          THEN 1
        END)                              AS ai_resolved,
        COUNT(CASE
          WHEN EXISTS (
            SELECT 1 FROM "HandoffEvent" h WHERE h."conversationId" = c.id
          )
          THEN 1
        END)                              AS handoffs
      FROM "Conversation" c
      WHERE c."tenantId" = ${tenantId}
        AND c."startedAt" >= ${since}
      GROUP BY DATE_TRUNC('day', c."startedAt")
      ORDER BY day ASC
    `;

    return rows.map((r) => ({
      date: new Date(r.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total: Number(r.total),
      ai_resolved: Number(r.ai_resolved),
      handoffs: Number(r.handoffs),
    }));
  }

  getKpiTrends(tenantId: string): Promise<Record<string, { change: number; trend: "up" | "down" | "neutral" }>> {
    return this.cached(`analytics:${tenantId}:kpi-trends`, TTL_TRENDS, () => this.computeKpiTrends(tenantId));
  }

  private async computeKpiTrends(
    tenantId: string,
  ): Promise<Record<string, { change: number; trend: "up" | "down" | "neutral" }>> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const [todayKpis, yesterdayKpis] = await Promise.all([
      this.getKpis(tenantId),
      this._getKpisForRange(tenantId, yesterdayStart, todayStart),
    ]);

    const result: Record<string, { change: number; trend: "up" | "down" | "neutral" }> = {};
    for (const key of Object.keys(todayKpis)) {
      const today = todayKpis[key] ?? 0;
      const yesterday = yesterdayKpis[key] ?? 0;
      if (yesterday === 0) {
        result[key] = { change: 0, trend: "neutral" };
      } else {
        const pct = Math.round(((today - yesterday) / yesterday) * 100);
        result[key] = {
          change: pct,
          trend: pct > 0 ? "up" : pct < 0 ? "down" : "neutral",
        };
      }
    }
    return result;
  }

  private async _getKpisForRange(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<Record<string, number | null>> {
    const sevenDaysAgo = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      conversationsToday,
      ordersToday,
      revenueToday,
      pendingHandoffs,
      newContactsToday,
      closedToday,
      closedByAiToday,
      latencyResult,
      csatResult,
      tokensResult,
    ] = await Promise.all([
      this.prisma.conversation.count({ where: { tenantId, startedAt: { gte: from, lt: to } } }),
      this.prisma.order.count({ where: { tenantId, createdAt: { gte: from, lt: to } } }),
      this.prisma.payment.aggregate({
        where: { tenantId, status: "APPROVED", paidAt: { gte: from, lt: to } },
        _sum: { amountCents: true },
      }),
      this.prisma.conversation.count({ where: { tenantId, status: "HUMAN_HANDOFF" } }),
      this.prisma.contact.count({ where: { tenantId, firstSeenAt: { gte: from, lt: to } } }),
      this.prisma.conversation.count({
        where: { tenantId, status: "CLOSED", closedAt: { gte: from, lt: to } },
      }),
      this.prisma.conversation.count({
        where: {
          tenantId,
          status: "CLOSED",
          closedAt: { gte: from, lt: to },
          messages: { some: { isFromAi: true } },
          handoffEvents: { none: {} },
        },
      }),
      this.prisma.message.aggregate({
        where: { tenantId, isFromAi: true, aiLatencyMs: { not: null }, sentAt: { gte: from, lt: to } },
        _avg: { aiLatencyMs: true },
      }),
      this.prisma.conversation.aggregate({
        where: { tenantId, csatScore: { not: null }, closedAt: { gte: sevenDaysAgo, lt: to } },
        _avg: { csatScore: true },
      }),
      this.prisma.message.aggregate({
        where: { tenantId, isFromAi: true, aiTokensUsed: { not: null }, sentAt: { gte: from, lt: to } },
        _sum: { aiTokensUsed: true },
      }),
    ]);

    const ai_resolution_rate = closedToday > 0 ? Math.round((closedByAiToday / closedToday) * 100) : 0;
    const avg_response_time_sec = latencyResult._avg.aiLatencyMs
      ? Math.round(latencyResult._avg.aiLatencyMs / 1000)
      : 0;
    const avg_csat_score = csatResult._avg.csatScore
      ? Number(csatResult._avg.csatScore.toFixed(1))
      : null;

    return {
      conversations_today: conversationsToday,
      ai_resolution_rate,
      revenue_today: revenueToday._sum.amountCents ?? 0,
      pending_handoffs: pendingHandoffs,
      avg_response_time_sec,
      new_contacts_today: newContactsToday,
      orders_today: ordersToday,
      conversion_rate: conversationsToday > 0 ? Math.round((ordersToday / conversationsToday) * 100) : 0,
      avg_csat_score,
      ai_tokens_today: tokensResult._sum.aiTokensUsed ?? 0,
    };
  }

  async getSetupStatus(tenantId: string): Promise<{
    whatsappConnected: boolean;
    agentConfigured: boolean;
    setupComplete: boolean;
  }> {
    const [tenant, agentConfig] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { whatsappStatus: true, whatsappPhoneId: true },
      }),
      this.prisma.agentConfig.findUnique({
        where: { tenantId },
        select: { id: true },
      }),
    ]);

    const whatsappConnected =
      tenant?.whatsappStatus !== "DISCONNECTED" && tenant?.whatsappPhoneId != null;
    const agentConfigured = agentConfig != null;

    return {
      whatsappConnected,
      agentConfigured,
      setupComplete: whatsappConnected && agentConfigured,
    };
  }

  getFunnel(tenantId: string, days = 30) {
    return this.cached(`analytics:${tenantId}:funnel:${days}`, TTL_AGG, () =>
      this.computeFunnel(tenantId, days),
    );
  }

  private async computeFunnel(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const [conversations, catalogViewed, cartStarted, paymentGenerated, paymentConfirmed] =
      await Promise.all([
        this.prisma.conversation.count({ where: { tenantId, startedAt: { gte: since } } }),
        this.prisma.analyticsEvent.count({ where: { tenantId, eventType: "catalog_viewed", occurredAt: { gte: since } } }),
        this.prisma.analyticsEvent.count({ where: { tenantId, eventType: "cart_started", occurredAt: { gte: since } } }),
        this.prisma.payment.count({ where: { tenantId, createdAt: { gte: since } } }),
        this.prisma.payment.count({ where: { tenantId, status: "APPROVED", paidAt: { gte: since } } }),
      ]);

    return {
      conversations,
      catalog_viewed: catalogViewed,
      cart_started: cartStarted,
      payment_generated: paymentGenerated,
      payment_confirmed: paymentConfirmed,
    };
  }

  getHeatmap(tenantId: string, days = 30) {
    return this.cached(`analytics:${tenantId}:heatmap:${days}`, TTL_AGG, () =>
      this.computeHeatmap(tenantId, days),
    );
  }

  private async computeHeatmap(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const messages = await this.prisma.message.findMany({
      where: { tenantId, sentAt: { gte: since } },
      select: { sentAt: true },
    });
    const buckets = Array.from({ length: 7 * 24 }, (_, i) => ({
      day: Math.floor(i / 24),
      hour: i % 24,
      value: 0,
    }));

    for (const msg of messages) {
      const date = new Date(msg.sentAt);
      const bucket = buckets[date.getDay() * 24 + date.getHours()];
      if (bucket) bucket.value += 1;
    }

    return buckets;
  }

  getHandoffReasons(tenantId: string, days = 30) {
    return this.cached(`analytics:${tenantId}:handoff-reasons:${days}`, TTL_AGG, () =>
      this.computeHandoffReasons(tenantId, days),
    );
  }

  private async computeHandoffReasons(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400000);
    const rows = await this.prisma.handoffEvent.groupBy({
      by: ["reason"],
      where: { tenantId, createdAt: { gte: since } },
      _count: { id: true },
    });

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.reason] = row._count.id;
      return acc;
    }, {});
  }
}
