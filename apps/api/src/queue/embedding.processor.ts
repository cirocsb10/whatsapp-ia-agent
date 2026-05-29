import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

export const EMBEDDING_QUEUE = "product-embeddings";

@Injectable()
export class EmbeddingProcessor {
  private readonly logger = new Logger(EmbeddingProcessor.name);
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async process(job: { name: string; data: { productId: string; tenantId: string } }): Promise<void> {
    const { productId } = job.data;
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) return;
    const embeddingText = [product.name, product.description ?? "", (product.tags as string[]).join(", ")].filter(Boolean).join(". ");
    await this.prisma.product.update({ where: { id: productId }, data: { isEmbedded: true, embeddingText } });
    this.logger.log(`Embedding saved for product ${product.name}`);
  }
}
