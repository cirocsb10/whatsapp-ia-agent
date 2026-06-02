import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { AgentConfigController } from "./agent-config.controller";
import { AgentConfigService } from "./agent-config.service";
import { KnowledgeService } from "./knowledge.service";
import { GuardRulesService } from "./guard-rules.service";
import { ChatSimulatorService } from "./chat-simulator.service";

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AgentConfigController],
  providers: [AgentConfigService, KnowledgeService, GuardRulesService, ChatSimulatorService],
})
export class AgentModule {}
