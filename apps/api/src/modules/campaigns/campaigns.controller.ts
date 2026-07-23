import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";
import { CampaignsService } from "./campaigns.service";
import { TemplatesService } from "./templates.service";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { SyncTemplatesDto } from "./dto/sync-templates.dto";

@Controller("campaigns")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("OWNER", "ADMIN")
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly templates: TemplatesService,
  ) {}

  @Get("templates")
  listTemplates(
    @CurrentTenantId() tenantId: string,
    @Query("channelId") channelId?: string,
    @Query("approvedOnly") approvedOnly?: string,
  ) {
    return this.templates.list(tenantId, channelId, approvedOnly === "true");
  }

  @Post("templates/sync")
  syncTemplates(
    @CurrentTenantId() tenantId: string,
    @Body() dto: SyncTemplatesDto,
  ) {
    return this.templates.syncFromMeta(tenantId, dto.channelId);
  }

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.campaigns.list(tenantId);
  }

  @Get(":id")
  findOne(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.campaigns.findOne(tenantId, id);
  }

  @Post()
  create(@CurrentTenantId() tenantId: string, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(tenantId, dto);
  }

  @Post(":id/dispatch")
  dispatch(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.campaigns.dispatch(tenantId, id);
  }

  @Post(":id/cancel")
  cancel(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.campaigns.cancel(tenantId, id);
  }
}
