import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

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
}
