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
  UseGuards,
} from "@nestjs/common";
import { AgentConfigService } from "./agent-config.service";
import { UpdateAgentConfigDto } from "./dto/update-agent-config.dto";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";
import { KnowledgeService } from "./knowledge.service";
import { CreateKnowledgeDto } from "./dto/create-knowledge.dto";
import { GuardRulesService } from "./guard-rules.service";
import { CreateGuardRuleDto, UpdateGuardRuleDto } from "./dto/create-guard-rule.dto";
import { ChatSimulatorService } from "./chat-simulator.service";

@Controller("agent")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class AgentConfigController {
  constructor(
    private readonly config: AgentConfigService,
    private readonly knowledge: KnowledgeService,
    private readonly rules: GuardRulesService,
    private readonly chat: ChatSimulatorService,
  ) {}

  @Get("config")
  getConfig(@CurrentTenantId() tenantId: string) {
    return this.config.getConfig(tenantId);
  }

  @Patch("config")
  @Roles("OWNER", "ADMIN")
  updateConfig(@CurrentTenantId() tenantId: string, @Body() dto: UpdateAgentConfigDto) {
    return this.config.updateConfig(tenantId, dto);
  }

  @Get("knowledge")
  getKnowledge(@CurrentTenantId() tenantId: string) {
    return this.knowledge.findAll(tenantId);
  }

  @Post("knowledge")
  @Roles("OWNER", "ADMIN")
  createKnowledge(@CurrentTenantId() tenantId: string, @Body() dto: CreateKnowledgeDto) {
    return this.knowledge.create(tenantId, dto);
  }

  @Delete("knowledge/:id")
  @Roles("OWNER", "ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteKnowledge(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.knowledge.remove(tenantId, id);
  }

  @Get("rules")
  getRules(@CurrentTenantId() tenantId: string) {
    return this.rules.findAll(tenantId);
  }

  @Post("rules")
  @Roles("OWNER", "ADMIN")
  createRule(@CurrentTenantId() tenantId: string, @Body() dto: CreateGuardRuleDto) {
    return this.rules.create(tenantId, dto);
  }

  @Patch("rules/:id")
  @Roles("OWNER", "ADMIN")
  updateRule(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateGuardRuleDto,
  ) {
    return this.rules.update(tenantId, id, dto);
  }

  @Delete("rules/:id")
  @Roles("OWNER", "ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRule(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.rules.remove(tenantId, id);
  }

  @Post("chat")
  chatReply(@CurrentTenantId() tenantId: string, @Body("message") message: string) {
    return this.chat.reply(tenantId, message);
  }
}
