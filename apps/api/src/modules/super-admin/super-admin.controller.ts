import { Controller, Get, Post, Param, Query, UseGuards } from "@nestjs/common";
import { SuperAdminService } from "./super-admin.service";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";

@Controller("super-admin")
@UseGuards(ClerkAuthGuard, SuperAdminGuard)
export class SuperAdminController {
  constructor(private readonly service: SuperAdminService) {}
  @Get("tenants") getAllTenants(@Query("page") page?: string, @Query("limit") limit?: string) { return this.service.getAllTenants(Number(page??1), Number(limit??25)); }
  @Get("kpis") getPlatformKpis() { return this.service.getPlatformKpis(); }
  @Post("tenants/:id/suspend") suspendTenant(@Param("id") id: string) { return this.service.suspendTenant(id); }
  @Post("tenants/:id/activate") activateTenant(@Param("id") id: string) { return this.service.activateTenant(id); }
}
