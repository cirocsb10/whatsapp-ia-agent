import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("analytics")
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get("dashboard")
  getDashboard(@CurrentTenantId() tenantId: string, @Query("days") days?: string) {
    return this.service.getDashboard(tenantId, Number(days ?? 30));
  }

  @Get("kpis")
  getKpis(@CurrentTenantId() tenantId: string) {
    return this.service.getKpis(tenantId);
  }

  @Get("kpi-trends")
  getKpiTrends(@CurrentTenantId() tenantId: string) {
    return this.service.getKpiTrends(tenantId);
  }

  @Get("setup-status")
  getSetupStatus(@CurrentTenantId() tenantId: string) {
    return this.service.getSetupStatus(tenantId);
  }

  @Get("conversations-chart")
  getConversationsChart(
    @CurrentTenantId() tenantId: string,
    @Query("days") days?: string,
  ) {
    return this.service.getConversationsChart(tenantId, Number(days ?? 30));
  }

  @Get("funnel")
  getFunnel(@CurrentTenantId() tenantId: string, @Query("days") days?: string) {
    return this.service.getFunnel(tenantId, Number(days ?? 30));
  }

  @Get("heatmap")
  getHeatmap(@CurrentTenantId() tenantId: string, @Query("days") days?: string) {
    return this.service.getHeatmap(tenantId, Number(days ?? 30));
  }

  @Get("handoff-reasons")
  getHandoffReasons(@CurrentTenantId() tenantId: string, @Query("days") days?: string) {
    return this.service.getHandoffReasons(tenantId, Number(days ?? 30));
  }
}
