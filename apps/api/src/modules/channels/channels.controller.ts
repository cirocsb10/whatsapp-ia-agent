import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";
import { ChannelsService } from "./channels.service";
import { CreateChannelDto } from "./dto/create-channel.dto";
import { UpdateChannelDto } from "./dto/update-channel.dto";
import { UpdateMembersDto } from "./dto/update-members.dto";
import { ToggleAiDto } from "./dto/toggle-ai.dto";

@Controller("channels")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("OWNER", "ADMIN")
export class ChannelsController {
  constructor(private readonly service: ChannelsService) {}

  @Get()
  findAll(@CurrentTenantId() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  /** Tenant users for the members multi-select picker. */
  @Get("users")
  listUsers(@CurrentTenantId() tenantId: string) {
    return this.service.listTenantUsers(tenantId);
  }

  @Get(":id")
  findOne(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Post()
  create(@CurrentTenantId() tenantId: string, @Body() dto: CreateChannelDto) {
    return this.service.create(tenantId, dto);
  }

  @Patch(":id")
  update(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.service.remove(tenantId, id);
  }

  @Put(":id/members")
  replaceMembers(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateMembersDto,
  ) {
    return this.service.replaceMembers(tenantId, id, dto.userIds);
  }

  @Patch(":id/ai")
  toggleAi(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: ToggleAiDto,
  ) {
    return this.service.toggleAi(tenantId, id, dto.enabled);
  }
}
