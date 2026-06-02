import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UpdateAgentConfigDto } from "./dto/update-agent-config.dto";

@Injectable()
export class AgentConfigService {
  constructor(private readonly prisma: PrismaService) {}

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
    if (dto.isPublished) data.publishedAt = new Date();

    return this.prisma.agentConfig.upsert({
      where: { tenantId },
      create: { ...(data as Prisma.AgentConfigUncheckedCreateInput), tenantId },
      update: data,
    });
  }
}
