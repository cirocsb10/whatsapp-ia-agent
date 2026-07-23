import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Prisma } from "@prisma/client";
import { Queue } from "bullmq";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AudienceService } from "./audience.service";
import {
  CAMPAIGN_DISPATCH_QUEUE,
  type AudienceQuery,
} from "./campaign.constants";
import { CreateCampaignDto } from "./dto/create-campaign.dto";

export interface CampaignDispatchJobData {
  campaignId: string;
  tenantId: string;
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audience: AudienceService,
    @InjectQueue(CAMPAIGN_DISPATCH_QUEUE) private readonly dispatchQueue: Queue,
  ) {}

  async list(tenantId: string) {
    return this.prisma.campaign.findMany({
      where: { tenantId },
      include: {
        channel: { select: { id: true, displayName: true, whatsappNumber: true } },
        template: {
          select: { id: true, name: true, language: true, status: true, category: true },
        },
        _count: { select: { recipients: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(tenantId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, tenantId },
      include: {
        channel: { select: { id: true, displayName: true, whatsappNumber: true } },
        template: true,
        recipients: {
          include: {
            contact: { select: { id: true, phone: true, name: true } },
          },
          orderBy: { status: "asc" },
        },
      },
    });
    if (!campaign) throw new NotFoundException(`Campanha ${id} não encontrada`);
    return campaign;
  }

  async create(tenantId: string, dto: CreateCampaignDto) {
    const audienceQuery = this.normalizeAudience(dto.audienceQuery);

    const channel = await this.prisma.whatsappChannel.findFirst({
      where: { id: dto.channelId, tenantId },
      select: { id: true, metaAccessToken: true, whatsappPhoneId: true },
    });
    if (!channel) throw new NotFoundException(`Canal ${dto.channelId} não encontrado`);
    if (!channel.metaAccessToken?.trim()) {
      throw new BadRequestException("Canal sem token Meta");
    }

    const template = await this.prisma.messageTemplate.findFirst({
      where: { id: dto.templateId, tenantId, channelId: dto.channelId },
    });
    if (!template) throw new NotFoundException(`Template ${dto.templateId} não encontrado`);
    if (template.status !== "APPROVED") {
      throw new BadRequestException(
        `Apenas templates APPROVED podem ser usados em campanhas (status atual: ${template.status})`,
      );
    }
    this.assertTemplateHasNoVariables(template.bodyText);

    return this.prisma.campaign.create({
      data: {
        tenantId,
        channelId: dto.channelId,
        templateId: dto.templateId,
        name: dto.name.trim(),
        audienceQuery: audienceQuery as Prisma.InputJsonValue,
        status: "DRAFT",
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      },
      include: {
        channel: { select: { id: true, displayName: true } },
        template: { select: { id: true, name: true, language: true, status: true } },
      },
    });
  }

  async dispatch(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: { template: true, channel: true },
    });
    if (!campaign) throw new NotFoundException(`Campanha ${campaignId} não encontrada`);

    if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
      throw new BadRequestException(
        `Campanha não pode ser disparada no status ${campaign.status}`,
      );
    }

    if (campaign.template.status !== "APPROVED") {
      throw new BadRequestException(
        `Template não está APPROVED (status: ${campaign.template.status})`,
      );
    }
    this.assertTemplateHasNoVariables(campaign.template.bodyText);

    if (!campaign.channel.metaAccessToken?.trim()) {
      throw new BadRequestException("Canal sem token Meta");
    }

    const audienceQuery = this.parseAudienceQuery(campaign.audienceQuery);
    const contacts = await this.audience.buildAudience(tenantId, audienceQuery);

    if (contacts.length === 0) {
      throw new BadRequestException("Audiência vazia (verifique opt-outs e filtros)");
    }

    // Recipients first; keep DRAFT until queue.add succeeds (avoid stuck SENDING).
    await this.prisma.$transaction(async (tx) => {
      await tx.campaignRecipient.deleteMany({ where: { campaignId } });
      await tx.campaignRecipient.createMany({
        data: contacts.map((c) => ({
          campaignId,
          contactId: c.id,
          status: "PENDING" as const,
        })),
      });
    });

    try {
      await this.dispatchQueue.add(
        "dispatch",
        { campaignId, tenantId } satisfies CampaignDispatchJobData,
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
    } catch (err) {
      this.logger.error(`Failed to enqueue campaign ${campaignId} — left as DRAFT`, err);
      throw err;
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "SENDING", startedAt: new Date() },
    });

    this.logger.log(`Campaign ${campaignId} enqueued (${contacts.length} recipients)`);
    return this.findOne(tenantId, campaignId);
  }

  async cancel(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
    });
    if (!campaign) throw new NotFoundException(`Campanha ${campaignId} não encontrada`);
    if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
      throw new BadRequestException("Só é possível cancelar campanhas DRAFT ou SCHEDULED");
    }
    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "CANCELLED" },
    });
  }

  /** v1: block templates with {{n}} body placeholders (no param substitution yet). */
  private assertTemplateHasNoVariables(bodyText: string | null | undefined): void {
    if (bodyText?.includes("{{")) {
      throw new BadRequestException(
        "Templates com variáveis ({{n}}) não são suportados nesta versão. Use um template sem placeholders no corpo.",
      );
    }
  }

  private normalizeAudience(query: CreateCampaignDto["audienceQuery"]): AudienceQuery {
    if (query.type === "all") return { type: "all" };
    if (query.type === "crm_stage") {
      if (!query.stageId) {
        throw new BadRequestException("stageId é obrigatório para audiência crm_stage");
      }
      return { type: "crm_stage", stageId: query.stageId };
    }
    throw new BadRequestException("audienceQuery inválido");
  }

  private parseAudienceQuery(raw: Prisma.JsonValue): AudienceQuery {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new BadRequestException("audienceQuery inválido na campanha");
    }
    const obj = raw as Record<string, unknown>;
    if (obj["type"] === "all") return { type: "all" };
    if (obj["type"] === "crm_stage" && typeof obj["stageId"] === "string") {
      return { type: "crm_stage", stageId: obj["stageId"] };
    }
    throw new BadRequestException("audienceQuery inválido na campanha");
  }
}
