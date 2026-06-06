import { Injectable, Inject } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Redis } from "ioredis";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UpdateAgentConfigDto } from "./dto/update-agent-config.dto";

@Injectable()
export class AgentConfigService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("REDIS_CLIENT") private readonly redis: Redis,
  ) {}

  async getConfig(tenantId: string) {
    return this.prisma.agentConfig.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }

  async updateConfig(tenantId: string, dto: UpdateAgentConfigDto) {
    const data: Prisma.AgentConfigUncheckedUpdateInput = {
      ...dto,
    };
    if (dto.isPublished) {
      data.publishedAt = new Date();
    } else if (dto.isPublished === false) {
      data.publishedAt = null;
    }

    const result = await this.prisma.agentConfig.upsert({
      where: { tenantId },
      create: { ...(data as Prisma.AgentConfigUncheckedCreateInput), tenantId },
      update: data,
    });

    if (dto.isPublished !== undefined) {
      await this.redis.del(`agent:published:${tenantId}`);
    }

    return result;
  }
}
