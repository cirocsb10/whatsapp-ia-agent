import { Controller, Get, UseGuards } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("categories")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(@CurrentTenantId() tenantId: string) {
    return this.categoriesService.findAll(tenantId);
  }
}
