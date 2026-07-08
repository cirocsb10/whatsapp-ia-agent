import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { AgentConfigController } from "./agent-config.controller";
import { AgentConfigService } from "./agent-config.service";
import { KnowledgeService } from "./knowledge.service";
import { GuardRulesService } from "./guard-rules.service";
import { ChatSimulatorService } from "./chat-simulator.service";
import { KnowledgeIndexingService } from "./knowledge-indexing.service";
import { KnowledgeEmbeddingProcessor } from "../../queue/knowledge-embedding.processor";
import { KNOWLEDGE_EMBEDDING_QUEUE } from "../../queue/queue.constants";

export { KNOWLEDGE_EMBEDDING_QUEUE };

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue({ name: KNOWLEDGE_EMBEDDING_QUEUE }),
  ],
  controllers: [AgentConfigController],
  providers: [
    AgentConfigService,
    KnowledgeService,
    GuardRulesService,
    ChatSimulatorService,
    KnowledgeIndexingService,
    KnowledgeEmbeddingProcessor,
  ],
})
export class AgentModule {}
