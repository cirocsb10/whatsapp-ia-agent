import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsString, MaxLength, MinLength } from "class-validator";
import { ConversationsService } from "./conversations.service";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  text!: string;
}

@Controller("conversations")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  @Roles("OWNER", "ADMIN", "AGENT", "VIEWER")
  findAll(@CurrentTenantId() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(":id/messages")
  @Roles("OWNER", "ADMIN", "AGENT", "VIEWER")
  findMessages(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
  ) {
    return this.service.findMessages(tenantId, id);
  }

  @Patch(":id/assume")
  @Roles("OWNER", "ADMIN", "AGENT")
  assume(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: { id: string },
    @Param("id") id: string,
  ) {
    return this.service.assumeConversation(tenantId, id, user.id);
  }

  @Patch(":id/release")
  @Roles("OWNER", "ADMIN", "AGENT")
  release(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: { id: string },
    @Param("id") id: string,
  ) {
    return this.service.releaseConversation(tenantId, id, user.id);
  }

  @Post(":id/messages")
  @Roles("OWNER", "ADMIN", "AGENT")
  sendMessage(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: { id: string },
    @Param("id") id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendOperatorMessage(tenantId, id, user.id, dto.text);
  }
}
