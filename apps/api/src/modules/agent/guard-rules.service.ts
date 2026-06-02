import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateGuardRuleDto, UpdateGuardRuleDto } from "./dto/create-guard-rule.dto";

@Injectable()
export class GuardRulesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.guardRule.findMany({
      where: { tenantId },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });
  }

  create(tenantId: string, dto: CreateGuardRuleDto) {
    return this.prisma.guardRule.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type,
        action: dto.action,
        priority: dto.priority ?? 100,
        config: dto.config as Prisma.InputJsonValue,
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.fallbackMessage !== undefined && { fallbackMessage: dto.fallbackMessage }),
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateGuardRuleDto) {
    const rule = await this.prisma.guardRule.findFirst({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException("Guard rule not found");
    const data: Prisma.GuardRuleUncheckedUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.action !== undefined && { action: dto.action }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.config !== undefined && { config: dto.config as Prisma.InputJsonValue }),
      ...(dto.fallbackMessage !== undefined && { fallbackMessage: dto.fallbackMessage }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    };
    return this.prisma.guardRule.update({ where: { id }, data });
  }

  async remove(tenantId: string, id: string) {
    const rule = await this.prisma.guardRule.findFirst({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException("Guard rule not found");
    await this.prisma.guardRule.delete({ where: { id } });
  }
}
