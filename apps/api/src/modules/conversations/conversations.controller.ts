import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { IsString, MaxLength, MinLength } from "class-validator";
import { ConversationsService } from "./conversations.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles, type UserRole } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  text!: string;
}

type AuthUser = { id: string; role: UserRole };

@Controller("conversations")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  @Roles("OWNER", "ADMIN", "AGENT", "VIEWER")
  findAll(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findAll(tenantId, { id: user.id, role: user.role });
  }

  @Get(":id/messages")
  @Roles("OWNER", "ADMIN", "AGENT", "VIEWER")
  async findMessages(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("limit") limit: string | undefined,
    @Query("before") before: string | undefined,
    @Res({ passthrough: true }) res: { setHeader(name: string, value: string): void },
  ) {
    // Paginado (B2): corpo segue array (asc); meta vai em headers para não
    // quebrar o contrato atual do frontend.
    const page = await this.service.findMessagesPage(
      tenantId,
      id,
      {
        limit: limit !== undefined ? Number(limit) : 50,
        ...(before ? { before } : {}),
      },
      { id: user.id, role: user.role },
    );
    res.setHeader("X-Has-More", String(page.hasMore));
    res.setHeader("Access-Control-Expose-Headers", "X-Has-More, X-Next-Cursor");
    if (page.nextCursor) res.setHeader("X-Next-Cursor", page.nextCursor);
    return page.messages;
  }

  @Patch(":id/assume")
  @Roles("OWNER", "ADMIN", "AGENT")
  assume(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ) {
    return this.service.assumeConversation(tenantId, id, { id: user.id, role: user.role });
  }

  @Patch(":id/release")
  @Roles("OWNER", "ADMIN", "AGENT")
  release(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ) {
    return this.service.releaseConversation(tenantId, id, { id: user.id, role: user.role });
  }

  @Post(":id/messages")
  @Roles("OWNER", "ADMIN", "AGENT")
  sendMessage(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendOperatorMessage(
      tenantId,
      id,
      { id: user.id, role: user.role },
      dto.text,
    );
  }
}
