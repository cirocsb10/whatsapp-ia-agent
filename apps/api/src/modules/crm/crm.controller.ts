import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from "@nestjs/common";
import { CrmService } from "./crm.service";
import { CreateStageDto } from "./dto/create-stage.dto";
import { UpdateStageDto } from "./dto/update-stage.dto";
import { CreateDealDto, ListDealsDto } from "./dto/create-deal.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";
import { MoveDealDto } from "./dto/move-deal.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("crm")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrmController {
  constructor(private readonly service: CrmService) {}

  @Get("stages")
  findStages(@CurrentTenantId() tenantId: string) {
    return this.service.findAllStages(tenantId);
  }

  @Post("stages")
  @Roles("OWNER", "ADMIN")
  createStage(@CurrentTenantId() tenantId: string, @Body() dto: CreateStageDto) {
    return this.service.createStage(tenantId, dto);
  }

  @Put("stages/:id")
  @Roles("OWNER", "ADMIN")
  updateStage(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.service.updateStage(tenantId, id, dto);
  }

  @Delete("stages/:id")
  @Roles("OWNER", "ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeStage(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.service.removeStage(tenantId, id);
  }

  @Get("deals")
  findDeals(@CurrentTenantId() tenantId: string, @Query() query: ListDealsDto) {
    return this.service.findAllDeals(tenantId, query);
  }

  @Post("deals")
  @Roles("OWNER", "ADMIN", "AGENT")
  createDeal(@CurrentTenantId() tenantId: string, @Body() dto: CreateDealDto) {
    return this.service.createDeal(tenantId, dto);
  }

  @Put("deals/:id")
  @Roles("OWNER", "ADMIN", "AGENT")
  updateDeal(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.service.updateDeal(tenantId, id, dto);
  }

  @Patch("deals/:id/stage")
  @Roles("OWNER", "ADMIN", "AGENT")
  moveDeal(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: MoveDealDto,
  ) {
    return this.service.moveDeal(tenantId, id, dto);
  }

  @Delete("deals/:id")
  @Roles("OWNER", "ADMIN", "AGENT")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDeal(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.service.removeDeal(tenantId, id);
  }

  @Get("stats")
  getStats(@CurrentTenantId() tenantId: string) {
    return this.service.getStats(tenantId);
  }

  @Get("contacts/search")
  searchContacts(
    @CurrentTenantId() tenantId: string,
    @Query("q") q: string = "",
  ) {
    return this.service.searchContacts(tenantId, q);
  }
}
