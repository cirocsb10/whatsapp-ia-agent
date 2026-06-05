import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@Controller("conversations")
@UseGuards(ClerkAuthGuard)
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  findAll(@CurrentTenantId() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(":id/messages")
  findMessages(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
  ) {
    return this.service.findMessages(tenantId, id);
  }

  @Patch(":id/assume")
  assume(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: { id: string },
    @Param("id") id: string,
  ) {
    return this.service.assumeConversation(tenantId, id, user.id);
  }

  @Patch(":id/release")
  release(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: { id: string },
    @Param("id") id: string,
  ) {
    return this.service.releaseConversation(tenantId, id, user.id);
  }

  @Post(":id/messages")
  sendMessage(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: { id: string },
    @Param("id") id: string,
    @Body() body: { text: string },
  ) {
    return this.service.sendOperatorMessage(tenantId, id, user.id, body.text);
  }
}
