import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../common/prisma/prisma.service";
import { KNOWLEDGE_EMBEDDING_QUEUE } from "./queue.constants";

interface IndexJobData {
  knowledgeBaseId: string;
  tenantId: string;
}

@Processor(KNOWLEDGE_EMBEDDING_QUEUE)
export class KnowledgeEmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeEmbeddingProcessor.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<IndexJobData>): Promise<void> {
    const { knowledgeBaseId, tenantId } = job.data;
    this.logger.log(`Processing indexing job for KB ${knowledgeBaseId}`);

    const orchestratorUrl = this.config.get<string>("AI_ORCHESTRATOR_URL", "http://localhost:8000");
    const internalToken = this.config.get<string>("INTERNAL_API_TOKEN", "");

    const res = await fetch(
      `${orchestratorUrl}/internal/index-knowledge/${knowledgeBaseId}?tenant_id=${tenantId}`,
      {
        method: "POST",
        headers: { "x-internal-token": internalToken },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Indexing failed: ${body}`);
    }

    const result = (await res.json()) as { chunk_count: number };
    this.logger.log(`KB ${knowledgeBaseId} indexed: ${result.chunk_count} chunks`);

    await this.prisma.knowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: { isIndexed: true, chunkCount: result.chunk_count },
    });
  }
}
