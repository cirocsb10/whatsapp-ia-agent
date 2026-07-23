import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { OverridePlanDto } from "./dto/override-plan.dto";
import { PlansService } from "./plans.service";

@Controller("super-admin/plans")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  getOverview(@Query("page") page?: string, @Query("limit") limit?: string) {
    return this.plans.getOverview(Number(page ?? 1), Number(limit ?? 25));
  }

  @Post(":tenantId/override")
  overridePlan(@Param("tenantId") tenantId: string, @Body() dto: OverridePlanDto) {
    return this.plans.overridePlan(tenantId, dto);
  }
}
