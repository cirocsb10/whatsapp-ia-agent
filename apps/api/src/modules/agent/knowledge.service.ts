import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateKnowledgeDto } from "./dto/create-knowledge.dto";
import { KnowledgeIndexingService } from "./knowledge-indexing.service";

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeIndexingService: KnowledgeIndexingService,
  ) {}

  findAll(tenantId: string) {
    return this.prisma.knowledgeBase.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        isIndexed: true,
        chunkCount: true,
        createdAt: true,
      },
    });
  }

  async create(tenantId: string, dto: CreateKnowledgeDto) {
    const data = {
      tenantId,
      name: dto.name,
      type: dto.type,
      content: dto.content,
      isIndexed: false,
      ...(dto.fileUrl !== undefined && { fileUrl: dto.fileUrl }),
    };

    const created = await this.prisma.knowledgeBase.create({ data });
    await this.knowledgeIndexingService.enqueueIndexing(created.id, tenantId);
    return created;
  }

  async remove(tenantId: string, id: string) {
    const item = await this.prisma.knowledgeBase.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException("Knowledge base not found");
    await this.prisma.knowledgeBase.delete({ where: { id } });
  }
}
