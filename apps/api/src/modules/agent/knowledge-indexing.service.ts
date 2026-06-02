import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { KNOWLEDGE_EMBEDDING_QUEUE } from "../../queue/queue.constants";

@Injectable()
export class KnowledgeIndexingService {
  private readonly logger = new Logger(KnowledgeIndexingService.name);

  constructor(
    @InjectQueue(KNOWLEDGE_EMBEDDING_QUEUE)
    private readonly embeddingQueue: Queue,
  ) {}

  async enqueueIndexing(knowledgeBaseId: string, tenantId: string): Promise<void> {
    await this.embeddingQueue.add(
      "index-knowledge",
      { knowledgeBaseId, tenantId },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );
    this.logger.log(`Enqueued indexing for KB ${knowledgeBaseId}`);
  }
}
