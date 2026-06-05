import { Test } from "@nestjs/testing";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AnalyticsService } from "./analytics.service";

const mockPrisma = {
  conversation: {
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  order: { count: jest.fn() },
  payment: { aggregate: jest.fn(), count: jest.fn() },
  contact: { count: jest.fn() },
  message: { aggregate: jest.fn(), findMany: jest.fn() },
  analyticsEvent: { count: jest.fn() },
  handoffEvent: { groupBy: jest.fn() },
};

describe("AnalyticsService", () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(AnalyticsService);
    jest.clearAllMocks();
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
    it("mapeia dados de groupBy para o formato de grafico", async () => {
      const date = new Date("2024-01-15");
      mockPrisma.conversation.groupBy.mockResolvedValue([
        { startedAt: date, _count: { id: 20 } },
      ]);

      const result = await service.getConversationsChart("t-1", 30);

      expect(result).toHaveLength(1);
      expect(result[0]!.total).toBe(20);
      expect(result[0]!.ai_resolved).toBe(17);
      expect(result[0]!.handoffs).toBe(3);
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
});
