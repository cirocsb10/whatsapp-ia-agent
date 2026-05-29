import { Controller, Get, Post, Param, Query, UseGuards } from "@nestjs/common";
import { SuperAdminService } from "./super-admin.service";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@Controller("super-admin")
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles("OWNER")
export class SuperAdminController {
  constructor(private readonly service: SuperAdminService) {}
  @Get("tenants") getAllTenants(@Query("page") page?: string, @Query("limit") limit?: string) { return this.service.getAllTenants(Number(page??1), Number(limit??25)); }
  @Get("kpis") getPlatformKpis() { return this.service.getPlatformKpis(); }
  @Post("tenants/:id/suspend") suspendTenant(@Param("id") id: string) { return this.service.suspendTenant(id); }
  @Post("tenants/:id/activate") activateTenant(@Param("id") id: string) { return this.service.activateTenant(id); }
}
