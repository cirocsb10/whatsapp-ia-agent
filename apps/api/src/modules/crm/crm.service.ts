import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateStageDto } from "./dto/create-stage.dto";
import { UpdateStageDto } from "./dto/update-stage.dto";
import { CreateDealDto, ListDealsDto } from "./dto/create-deal.dto";
import { UpdateDealDto } from "./dto/update-deal.dto";
import { MoveDealDto } from "./dto/move-deal.dto";

const DEFAULT_STAGES = [
  { name: "Novo Lead",        color: "#6366F1", position: 0, isWon: false, isLost: false },
  { name: "Contato Feito",    color: "#06B6D4", position: 1, isWon: false, isLost: false },
  { name: "Qualificado",      color: "#F59E0B", position: 2, isWon: false, isLost: false },
  { name: "Proposta Enviada", color: "#8B5CF6", position: 3, isWon: false, isLost: false },
  { name: "Negociação",       color: "#F97316", position: 4, isWon: false, isLost: false },
  { name: "Ganho",            color: "#22C55E", position: 5, isWon: true,  isLost: false },
  { name: "Perdido",          color: "#EF4444", position: 6, isWon: false, isLost: true  },
];

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Stages ─────────────────────────────────────────────────────────────

  async findAllStages(tenantId: string) {
    const count = await this.prisma.funnelStage.count({ where: { tenantId } });
    if (count === 0) {
      await this.prisma.funnelStage.createMany({
        data: DEFAULT_STAGES.map((s) => ({ ...s, tenantId })),
      });
    }
    return this.prisma.funnelStage.findMany({
      where: { tenantId },
      orderBy: { position: "asc" },
    });
  }

  async createStage(tenantId: string, dto: CreateStageDto) {
    return this.prisma.funnelStage.create({
      data: {
        tenantId,
        name: dto.name,
        color: dto.color ?? "#6366F1",
        position: dto.position,
        isWon: dto.isWon ?? false,
        isLost: dto.isLost ?? false,
      },
    });
  }

  async updateStage(tenantId: string, id: string, dto: UpdateStageDto) {
    await this._findStageOrThrow(tenantId, id);
    return this.prisma.funnelStage.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.isWon !== undefined && { isWon: dto.isWon }),
        ...(dto.isLost !== undefined && { isLost: dto.isLost }),
      },
    });
  }

  async removeStage(tenantId: string, id: string) {
    await this._findStageOrThrow(tenantId, id);
    const dealCount = await this.prisma.deal.count({ where: { stageId: id, tenantId } });
    if (dealCount > 0) {
      throw new BadRequestException(
        `Não é possível excluir a etapa pois ela contém ${dealCount} negócio(s). Mova-os antes de excluir.`,
      );
    }
    await this.prisma.funnelStage.delete({ where: { id } });
  }

  private async _findStageOrThrow(tenantId: string, id: string) {
    const stage = await this.prisma.funnelStage.findFirst({ where: { id, tenantId } });
    if (!stage) throw new NotFoundException(`Etapa ${id} não encontrada`);
    return stage;
  }

  // ─── Deals ───────────────────────────────────────────────────────────────

  async findAllDeals(tenantId: string, query: ListDealsDto) {
    return this.prisma.deal.findMany({
      where: {
        tenantId,
        ...(query.stageId && { stageId: query.stageId }),
      },
      orderBy: { createdAt: "asc" },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        stage:   { select: { id: true, name: true, color: true } },
      },
    });
  }

  async createDeal(tenantId: string, dto: CreateDealDto) {
    await this._findStageOrThrow(tenantId, dto.stageId);
    return this.prisma.deal.create({
      data: {
        tenantId,
        title: dto.title,
        stageId: dto.stageId,
        valueCents: dto.valueCents ?? 0,
        notes: dto.notes ?? null,
        contactId: dto.contactId ?? null,
      },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        stage:   { select: { id: true, name: true, color: true } },
      },
    });
  }

  async updateDeal(tenantId: string, id: string, dto: UpdateDealDto) {
    await this._findDealOrThrow(tenantId, id);
    if (dto.stageId) await this._findStageOrThrow(tenantId, dto.stageId);
    return this.prisma.deal.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.stageId !== undefined && { stageId: dto.stageId }),
        ...(dto.valueCents !== undefined && { valueCents: dto.valueCents }),
        ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
        ...(dto.contactId !== undefined && { contactId: dto.contactId ?? null }),
      },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        stage:   { select: { id: true, name: true, color: true } },
      },
    });
  }

  async moveDeal(tenantId: string, id: string, dto: MoveDealDto) {
    await this._findDealOrThrow(tenantId, id);
    await this._findStageOrThrow(tenantId, dto.stageId);
    return this.prisma.deal.update({
      where: { id },
      data: { stageId: dto.stageId },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        stage:   { select: { id: true, name: true, color: true } },
      },
    });
  }

  async removeDeal(tenantId: string, id: string) {
    await this._findDealOrThrow(tenantId, id);
    await this.prisma.deal.delete({ where: { id } });
  }

  private async _findDealOrThrow(tenantId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({ where: { id, tenantId } });
    if (!deal) throw new NotFoundException(`Negócio ${id} não encontrado`);
    return deal;
  }

  // ─── Stats ───────────────────────────────────────────────────────────────

  async getStats(tenantId: string) {
    const openStages = await this.prisma.funnelStage.findMany({
      where: { tenantId, isWon: false, isLost: false },
      select: { id: true },
    });
    const openStageIds = openStages.map((s) => s.id);

    const [pipelineAgg, openCount, byStageGroups, allStages] = await Promise.all([
      this.prisma.deal.aggregate({
        where: { tenantId, stageId: { in: openStageIds } },
        _sum: { valueCents: true },
      }),
      this.prisma.deal.count({ where: { tenantId, stageId: { in: openStageIds } } }),
      this.prisma.deal.groupBy({
        by: ["stageId"],
        where: { tenantId },
        _count: { _all: true },
        _sum: { valueCents: true },
      }),
      this.prisma.funnelStage.findMany({
        where: { tenantId },
        select: { id: true, name: true, color: true },
      }),
    ]);

    const stageMap = new Map(allStages.map((s) => [s.id, s]));
    const byStage = byStageGroups.map((g) => ({
      stageId:    g.stageId,
      stageName:  stageMap.get(g.stageId)?.name ?? "",
      stageColor: stageMap.get(g.stageId)?.color ?? "#6366F1",
      count:      g._count._all,
      valueCents: g._sum.valueCents ?? 0,
    }));

    return {
      pipelineValueCents: pipelineAgg._sum.valueCents ?? 0,
      openCount,
      byStage,
    };
  }

  // ─── Contact search (for deal modal) ────────────────────────────────────

  async searchContacts(tenantId: string, q: string) {
    return this.prisma.contact.findMany({
      where: {
        tenantId,
        ...(q.trim() && {
          OR: [
            { name: { contains: q.trim(), mode: "insensitive" } },
            { phone: { contains: q.trim() } },
          ],
        }),
      },
      select: { id: true, name: true, phone: true },
      take: 20,
      orderBy: { name: "asc" },
    });
  }
}
