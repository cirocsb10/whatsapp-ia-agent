import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { MessageTemplateStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { META_GRAPH_API } from "./campaign.constants";

interface MetaTemplateComponent {
  type?: string;
  text?: string;
  format?: string;
  buttons?: unknown[];
  example?: unknown;
}

interface MetaMessageTemplate {
  id?: string;
  name: string;
  language: string;
  status: string;
  category?: string;
  components?: MetaTemplateComponent[];
}

interface MetaTemplatesResponse {
  data?: MetaMessageTemplate[];
  paging?: { next?: string };
  error?: { message?: string };
}

const STATUS_MAP: Record<string, MessageTemplateStatus> = {
  APPROVED: "APPROVED",
  PENDING: "PENDING",
  REJECTED: "REJECTED",
  PAUSED: "PAUSED",
  DISABLED: "DISABLED",
};

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, channelId?: string, approvedOnly = false) {
    return this.prisma.messageTemplate.findMany({
      where: {
        tenantId,
        ...(channelId ? { channelId } : {}),
        ...(approvedOnly ? { status: "APPROVED" } : {}),
      },
      orderBy: [{ name: "asc" }, { language: "asc" }],
    });
  }

  async syncFromMeta(tenantId: string, channelId: string) {
    const channel = await this.prisma.whatsappChannel.findFirst({
      where: { id: channelId, tenantId },
    });
    if (!channel) throw new NotFoundException(`Canal ${channelId} não encontrado`);

    const wabaId = channel.wabaId?.trim();
    const token = channel.metaAccessToken?.trim();
    if (!wabaId) {
      throw new BadRequestException("Canal sem wabaId — configure o ID da conta WhatsApp Business");
    }
    if (!token) {
      throw new BadRequestException("Canal sem token Meta — configure metaAccessToken");
    }

    const remote = await this.fetchAllTemplates(wabaId, token);
    const now = new Date();
    let upserted = 0;

    for (const tpl of remote) {
      const status = STATUS_MAP[tpl.status?.toUpperCase() ?? ""] ?? "PENDING";
      const bodyText = this.extractBodyText(tpl.components);
      const variables = this.extractVariables(tpl.components);

      await this.prisma.messageTemplate.upsert({
        where: {
          channelId_name_language: {
            channelId,
            name: tpl.name,
            language: tpl.language,
          },
        },
        create: {
          tenantId,
          channelId,
          name: tpl.name,
          language: tpl.language,
          category: tpl.category ?? null,
          status,
          bodyText,
          variables: variables as Prisma.InputJsonValue,
          metaId: tpl.id ?? null,
          lastSyncedAt: now,
        },
        update: {
          category: tpl.category ?? null,
          status,
          bodyText,
          variables: variables as Prisma.InputJsonValue,
          metaId: tpl.id ?? null,
          lastSyncedAt: now,
        },
      });
      upserted += 1;
    }

    this.logger.log(`Synced ${upserted} templates for channel ${channelId}`);
    return this.list(tenantId, channelId);
  }

  private async fetchAllTemplates(wabaId: string, token: string): Promise<MetaMessageTemplate[]> {
    const results: MetaMessageTemplate[] = [];
    let url: string | null =
      `${META_GRAPH_API}/${wabaId}/message_templates?limit=100&fields=id,name,language,status,category,components`;

    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as MetaTemplatesResponse;
      if (!res.ok) {
        const msg = json.error?.message ?? `HTTP ${res.status}`;
        throw new BadRequestException(`Falha ao sincronizar templates Meta: ${msg}`);
      }
      if (json.data?.length) results.push(...json.data);
      url = json.paging?.next ?? null;
    }

    return results;
  }

  private extractBodyText(components?: MetaTemplateComponent[]): string | null {
    const body = components?.find((c) => c.type?.toUpperCase() === "BODY");
    return body?.text ?? null;
  }

  private extractVariables(components?: MetaTemplateComponent[]): Prisma.JsonValue {
    if (!components?.length) return [];
    return components.map((c) => ({
      type: c.type ?? null,
      text: c.text ?? null,
      format: c.format ?? null,
      example: c.example ?? null,
    })) as Prisma.JsonValue;
  }
}
