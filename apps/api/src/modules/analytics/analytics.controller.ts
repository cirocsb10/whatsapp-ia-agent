import { Controller, Get, UseGuards } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("analytics")
@UseGuards(ClerkAuthGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get("kpis")
  getKpis(@CurrentTenantId() tenantId: string) {
    return this.service.getKpis(tenantId);
  }

  @Get("conversations-chart")
  getConversationsChart(@CurrentTenantId() tenantId: string) {
    return this.service.getConversationsChart(tenantId);
  }
}
