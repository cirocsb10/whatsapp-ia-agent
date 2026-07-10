import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { IsString, MaxLength, MinLength } from "class-validator";
import { ConversationsService } from "./conversations.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
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
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  @Roles("OWNER", "ADMIN", "AGENT", "VIEWER")
  findAll(@CurrentTenantId() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(":id/messages")
  @Roles("OWNER", "ADMIN", "AGENT", "VIEWER")
  async findMessages(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Query("limit") limit?: string,
    @Query("before") before?: string,
    @Res({ passthrough: true }) res?: { setHeader(name: string, value: string): void },
  ) {
    // Sem `limit` = comportamento legado (array com todas as mensagens, asc).
    if (limit === undefined) {
      return this.service.findMessages(tenantId, id);
    }

    // Paginado (B2): corpo segue array (asc); meta vai em headers para não
    // quebrar o contrato atual do frontend.
    const page = await this.service.findMessagesPage(tenantId, id, {
      limit: Number(limit),
      ...(before ? { before } : {}),
    });
    res?.setHeader("X-Has-More", String(page.hasMore));
    res?.setHeader("Access-Control-Expose-Headers", "X-Has-More, X-Next-Cursor");
    if (page.nextCursor) res?.setHeader("X-Next-Cursor", page.nextCursor);
    return page.messages;
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
