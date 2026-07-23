import { Test } from "@nestjs/testing";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AnalyticsService } from "./analytics.service";

const mockPrisma = {
  $queryRaw: jest.fn(),
  conversation: {
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  order: { count: jest.fn() },
  payment: { aggregate: jest.fn(), count: jest.fn() },
  contact: { count: jest.fn() },
  message: { aggregate: jest.fn(), findMany: jest.fn() },
  messagePricingRate: { findMany: jest.fn() },
  analyticsEvent: { count: jest.fn() },
  handoffEvent: { groupBy: jest.fn() },
  tenant: { findUnique: jest.fn() },
  agentConfig: { findUnique: jest.fn() },
};

// get => null força cache-miss em todos os testes (sempre recalcula via Prisma).
const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue("OK"),
};

describe("AnalyticsService", () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: "REDIS_CLIENT", useValue: mockRedis },
      ],
    }).compile();
    service = module.get(AnalyticsService);
    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
  });

  describe("getKpis", () => {
    it("calcula KPIs com dados validos", async () => {
      mockPrisma.conversation.count
        .mockResolvedValueOnce(10)  // conversationsToday
        .mockResolvedValueOnce(2)   // pendingHandoffs
        .mockResolvedValueOnce(8)   // closedToday
        .mockResolvedValueOnce(6);  // closedByAiToday
      mockPrisma.order.count.mockResolvedValue(3);
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amountCents: 50000 } });
      mockPrisma.contact.count.mockResolvedValue(5);
      mockPrisma.message.aggregate
        .mockResolvedValueOnce({ _avg: { aiLatencyMs: 2000 } })
        .mockResolvedValueOnce({ _sum: { aiTokensUsed: 1500 } });
      mockPrisma.conversation.aggregate.mockResolvedValue({ _avg: { csatScore: 4.5 } });

      const kpis = await service.getKpis("t-1");

      expect(kpis.conversations_today).toBe(10);
      expect(kpis.orders_today).toBe(3);
      expect(kpis.revenue_today).toBe(50000);
      expect(kpis.pending_handoffs).toBe(2);
      expect(kpis.avg_response_time_sec).toBe(2);
      expect(kpis.new_contacts_today).toBe(5);
      expect(kpis.avg_csat_score).toBe(4.5);
      expect(kpis.ai_tokens_today).toBe(1500);
      expect(kpis.conversion_rate).toBe(30);
    });

    it("retorna ai_resolution_rate=0 quando nenhuma conversa foi fechada", async () => {
      mockPrisma.conversation.count.mockResolvedValue(0);
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amountCents: null } });
      mockPrisma.contact.count.mockResolvedValue(0);
      mockPrisma.message.aggregate
        .mockResolvedValueOnce({ _avg: { aiLatencyMs: null } })
        .mockResolvedValueOnce({ _sum: { aiTokensUsed: null } });
      mockPrisma.conversation.aggregate.mockResolvedValue({ _avg: { csatScore: null } });

      const kpis = await service.getKpis("t-1");

      expect(kpis.ai_resolution_rate).toBe(0);
      expect(kpis.avg_response_time_sec).toBe(0);
      expect(kpis.avg_csat_score).toBeNull();
      expect(kpis.revenue_today).toBe(0);
      expect(kpis.ai_tokens_today).toBe(0);
    });
  });

  describe("getConversationsChart", () => {
    it("mapeia dados agrupados por dia para o formato de grafico", async () => {
      const date = new Date("2024-01-15");
      mockPrisma.$queryRaw.mockResolvedValue([
        { day: date, total: BigInt(20), ai_resolved: BigInt(17), handoffs: BigInt(3) },
      ]);

      const result = await service.getConversationsChart("t-1", 30);

      expect(result).toHaveLength(1);
      expect(result[0]!.total).toBe(20);
      expect(result[0]!.ai_resolved).toBe(17);
      expect(result[0]!.handoffs).toBe(3);
    });
  });

  describe("getSetupStatus", () => {
    it("retorna setupComplete quando whatsapp e agente estao configurados", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        whatsappStatus: "CONNECTED",
        whatsappPhoneId: "phone-1",
      });
      mockPrisma.agentConfig.findUnique.mockResolvedValue({ id: "ac-1" });

      const status = await service.getSetupStatus("t-1");

      expect(status).toEqual({
        whatsappConnected: true,
        agentConfigured: true,
        setupComplete: true,
      });
    });

    it("retorna setupComplete=false quando whatsapp desconectado", async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        whatsappStatus: "DISCONNECTED",
        whatsappPhoneId: null,
      });
      mockPrisma.agentConfig.findUnique.mockResolvedValue({ id: "ac-1" });

      const status = await service.getSetupStatus("t-1");

      expect(status.setupComplete).toBe(false);
      expect(status.whatsappConnected).toBe(false);
    });
  });

  describe("getFunnel", () => {
    it("retorna contagens do funil", async () => {
      mockPrisma.conversation.count.mockResolvedValue(100);
      mockPrisma.analyticsEvent.count
        .mockResolvedValueOnce(60)
        .mockResolvedValueOnce(40);
      mockPrisma.payment.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(15);

      const funnel = await service.getFunnel("t-1");

      expect(funnel).toEqual({
        conversations: 100,
        catalog_viewed: 60,
        cart_started: 40,
        payment_generated: 20,
        payment_confirmed: 15,
      });
    });
  });

  describe("getHeatmap", () => {
    it("retorna 168 buckets (7 dias x 24 horas)", async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);

      const heatmap = await service.getHeatmap("t-1");

      expect(heatmap).toHaveLength(168);
      expect(heatmap[0]).toEqual({ day: 0, hour: 0, value: 0 });
    });

    it("incrementa o bucket correto por dia/hora", async () => {
      // Segunda-feira (day=1) às 10h
      const date = new Date("2024-01-08T10:30:00");
      mockPrisma.message.findMany.mockResolvedValue([{ sentAt: date }, { sentAt: date }]);

      const heatmap = await service.getHeatmap("t-1");
      const bucket = heatmap.find((b) => b.day === date.getDay() && b.hour === 10);

      expect(bucket?.value).toBe(2);
    });
  });

  describe("getHandoffReasons", () => {
    it("agrupa razoes de handoff em um objeto", async () => {
      mockPrisma.handoffEvent.groupBy.mockResolvedValue([
        { reason: "GUARD_RAIL", _count: { id: 5 } },
        { reason: "MANUAL", _count: { id: 3 } },
      ]);

      const result = await service.getHandoffReasons("t-1");

      expect(result).toEqual({ GUARD_RAIL: 5, MANUAL: 3 });
    });
  });

  describe("getMessagingCost", () => {
    it("agrega custo estimado por canal/categoria com isEstimate=true", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          channel_id: "ch-1",
          channel_label: "Vendas",
          category: "marketing",
          message_count: 2n,
        },
        {
          channel_id: "ch-1",
          channel_label: "Vendas",
          category: "utility",
          message_count: 3n,
        },
        {
          channel_id: null,
          channel_label: "Sem canal",
          category: "service",
          message_count: 1n,
        },
      ]);
      mockPrisma.messagePricingRate.findMany.mockResolvedValue([
        { tenantId: null, category: "marketing", priceBrlCents: 250 },
        { tenantId: null, category: "utility", priceBrlCents: 40 },
        { tenantId: null, category: "service", priceBrlCents: 0 },
        { tenantId: "t-1", category: "marketing", priceBrlCents: 200 }, // override
      ]);

      const from = new Date("2026-07-01T00:00:00.000Z");
      const to = new Date("2026-07-23T00:00:00.000Z");
      const result = await service.getMessagingCost("t-1", from, to);

      // marketing: 2*200=400, utility: 3*40=120, service: 1*0=0 → 520
      expect(result.isEstimate).toBe(true);
      expect(result.totalMessages).toBe(6);
      expect(result.totalBrlCents).toBe(520);
      // 22-day period (Jul 1 → Jul 23): 520 * 30 / 22 ≈ 709
      expect(result.projectedMonthlyBrlCents).toBe(709);
      expect(result.byCategory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: "marketing", messageCount: 2, costBrlCents: 400 }),
          expect.objectContaining({ category: "utility", messageCount: 3, costBrlCents: 120 }),
        ]),
      );
      expect(result.byChannel[0]).toEqual(
        expect.objectContaining({ channelId: "ch-1", channelLabel: "Vendas", costBrlCents: 520 }),
      );
    });

    it("retorna totais zerados quando nao ha mensagens precificadas", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.messagePricingRate.findMany.mockResolvedValue([]);

      const result = await service.getMessagingCost(
        "t-1",
        new Date("2026-07-01"),
        new Date("2026-07-23"),
      );

      expect(result).toEqual(
        expect.objectContaining({
          byChannel: [],
          byCategory: [],
          totalMessages: 0,
          totalBrlCents: 0,
          projectedMonthlyBrlCents: 0,
          isEstimate: true,
        }),
      );
    });

    it("extrapola projeção mensal com mínimo de 1 dia no período", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          channel_id: "ch-1",
          channel_label: "Vendas",
          category: "marketing",
          message_count: 1n,
        },
      ]);
      mockPrisma.messagePricingRate.findMany.mockResolvedValue([
        { tenantId: null, category: "marketing", priceBrlCents: 3000 },
      ]);

      const from = new Date("2026-07-23T12:00:00.000Z");
      const to = new Date("2026-07-23T18:00:00.000Z"); // 6h → daysInPeriod capped at 1
      const result = await service.getMessagingCost("t-1", from, to);

      expect(result.totalBrlCents).toBe(3000);
      expect(result.projectedMonthlyBrlCents).toBe(90000); // 3000 * 30 / 1
    });
  });
});
