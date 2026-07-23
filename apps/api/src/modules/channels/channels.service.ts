import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Redis } from "ioredis";
import { PrismaService } from "../../common/prisma/prisma.service";
import { REDIS_CLIENT } from "../../common/redis/redis.module";
import { CreateChannelDto } from "./dto/create-channel.dto";
import { UpdateChannelDto } from "./dto/update-channel.dto";

const CHANNEL_INCLUDE = {
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  },
} as const;

type ChannelWithMembers = Prisma.WhatsappChannelGetPayload<{
  include: typeof CHANNEL_INCLUDE;
}>;

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async findAll(tenantId: string) {
    const channels = await this.prisma.whatsappChannel.findMany({
      where: { tenantId },
      include: CHANNEL_INCLUDE,
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    return channels.map((c) => this.toPublic(c));
  }

  async findOne(tenantId: string, id: string) {
    const channel = await this.prisma.whatsappChannel.findFirst({
      where: { id, tenantId },
      include: CHANNEL_INCLUDE,
    });
    if (!channel) throw new NotFoundException(`Canal ${id} não encontrado`);
    return this.toPublic(channel);
  }

  async listTenantUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
  }

  async create(tenantId: string, dto: CreateChannelDto) {
    const displayName = dto.displayName.trim();
    if (!displayName) {
      throw new BadRequestException("displayName é obrigatório");
    }

    const phoneId = dto.whatsappPhoneId.trim();
    await this.assertPhoneIdAvailable(phoneId);

    if (dto.memberUserIds?.length) {
      await this.assertUsersBelongToTenant(tenantId, dto.memberUserIds);
    }

    const existingCount = await this.prisma.whatsappChannel.count({
      where: { tenantId },
    });
    const isFirst = existingCount === 0;

    try {
      const channel = await this.prisma.whatsappChannel.create({
        data: {
          tenantId,
          displayName,
          whatsappPhoneId: phoneId,
          whatsappNumber: dto.whatsappNumber?.trim() || null,
          metaAccessToken: dto.metaAccessToken?.trim() || null,
          wabaId: dto.wabaId?.trim() || null,
          isAiEnabled: dto.isAiEnabled ?? false,
          isDefault: isFirst,
          status: "ACTIVE",
          ...(dto.memberUserIds?.length
            ? {
                members: {
                  create: dto.memberUserIds.map((userId) => ({ userId })),
                },
              }
            : {}),
        },
        include: CHANNEL_INCLUDE,
      });

      this.logger.log(
        `Channel created tenant=${tenantId} id=${channel.id} phoneId=${phoneId}`,
      );
      return this.toPublic(channel);
    } catch (err) {
      this.rethrowUniquePhoneConflict(err);
      throw err;
    }
  }

  async update(tenantId: string, id: string, dto: UpdateChannelDto) {
    const existing = await this.requireChannel(tenantId, id);
    const previousPhoneId = existing.whatsappPhoneId;

    if (dto.whatsappPhoneId !== undefined) {
      const phoneId = dto.whatsappPhoneId.trim();
      if (phoneId !== existing.whatsappPhoneId) {
        await this.assertPhoneIdAvailable(phoneId, id);
      }
    }

    if (dto.isDefault === true && !existing.isDefault) {
      await this.prisma.whatsappChannel.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const data: Prisma.WhatsappChannelUpdateInput = {};
    if (dto.displayName !== undefined) {
      const name = dto.displayName.trim();
      if (!name) throw new BadRequestException("displayName é obrigatório");
      data.displayName = name;
    }
    if (dto.whatsappPhoneId !== undefined) {
      data.whatsappPhoneId = dto.whatsappPhoneId.trim();
    }
    if (dto.whatsappNumber !== undefined) {
      data.whatsappNumber = dto.whatsappNumber?.trim() || null;
    }
    if (dto.metaAccessToken !== undefined) {
      data.metaAccessToken = dto.metaAccessToken?.trim() || null;
    }
    if (dto.wabaId !== undefined) {
      data.wabaId = dto.wabaId?.trim() || null;
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.isAiEnabled !== undefined) data.isAiEnabled = dto.isAiEnabled;

    try {
      const channel = await this.prisma.whatsappChannel.update({
        where: { id },
        data,
        include: CHANNEL_INCLUDE,
      });

      const tokenChanged = dto.metaAccessToken !== undefined;
      const phoneChanged =
        dto.whatsappPhoneId !== undefined &&
        channel.whatsappPhoneId !== previousPhoneId;

      if (tokenChanged || phoneChanged) {
        await this.invalidateChannelCache(previousPhoneId);
        if (phoneChanged) {
          await this.invalidateChannelCache(channel.whatsappPhoneId);
        }
      }

      return this.toPublic(channel);
    } catch (err) {
      this.rethrowUniquePhoneConflict(err);
      throw err;
    }
  }

  async remove(tenantId: string, id: string) {
    const channel = await this.requireChannel(tenantId, id);

    const total = await this.prisma.whatsappChannel.count({ where: { tenantId } });
    if (total === 1) {
      const openConversations = await this.prisma.conversation.count({
        where: {
          tenantId,
          channelId: id,
          status: { in: ["ACTIVE", "PAUSED", "HUMAN_HANDOFF"] },
        },
      });
      if (openConversations > 0) {
        throw new BadRequestException(
          "Não é possível remover o único canal enquanto houver conversas ativas. Reatribua ou encerre as conversas primeiro.",
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.whatsappChannel.delete({ where: { id } });

      if (channel.isDefault && total > 1) {
        const next = await tx.whatsappChannel.findFirst({
          where: { tenantId },
          orderBy: { createdAt: "asc" },
        });
        if (next) {
          await tx.whatsappChannel.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });

    await this.invalidateChannelCache(channel.whatsappPhoneId);
    this.logger.log(`Channel deleted tenant=${tenantId} id=${id}`);
  }

  async replaceMembers(tenantId: string, id: string, userIds: string[]) {
    await this.requireChannel(tenantId, id);
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length) {
      await this.assertUsersBelongToTenant(tenantId, uniqueIds);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.whatsappChannelMember.deleteMany({ where: { channelId: id } });
      if (uniqueIds.length) {
        await tx.whatsappChannelMember.createMany({
          data: uniqueIds.map((userId) => ({ channelId: id, userId })),
        });
      }
    });

    return this.findOne(tenantId, id);
  }

  async toggleAi(tenantId: string, id: string, enabled: boolean) {
    await this.requireChannel(tenantId, id);
    const channel = await this.prisma.whatsappChannel.update({
      where: { id },
      data: { isAiEnabled: enabled },
      include: CHANNEL_INCLUDE,
    });
    // AI flag is read from DB on each inbound (and cached channel payload);
    // invalidate so channel-service picks up the new isAiEnabled promptly.
    await this.invalidateChannelCache(channel.whatsappPhoneId);
    return this.toPublic(channel);
  }

  private async requireChannel(tenantId: string, id: string) {
    const channel = await this.prisma.whatsappChannel.findFirst({
      where: { id, tenantId },
    });
    if (!channel) throw new NotFoundException(`Canal ${id} não encontrado`);
    return channel;
  }

  private async assertPhoneIdAvailable(phoneId: string, excludeId?: string) {
    const existing = await this.prisma.whatsappChannel.findUnique({
      where: { whatsappPhoneId: phoneId },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `whatsappPhoneId "${phoneId}" já está em uso por outro canal`,
      );
    }
  }

  private async assertUsersBelongToTenant(tenantId: string, userIds: string[]) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, id: { in: userIds }, isActive: true },
      select: { id: true },
    });
    if (users.length !== userIds.length) {
      throw new BadRequestException(
        "Um ou mais userIds não pertencem a este tenant ou estão inativos",
      );
    }
  }

  private async invalidateChannelCache(phoneId: string) {
    try {
      await this.redis.del(`channel:phone:${phoneId}`);
    } catch (err) {
      this.logger.warn(
        `Falha ao invalidar cache channel:phone:${phoneId}: ${(err as Error).message}`,
      );
    }
  }

  private rethrowUniquePhoneConflict(err: unknown): void {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ConflictException("whatsappPhoneId já está em uso");
    }
  }

  private toPublic(channel: ChannelWithMembers) {
    const { metaAccessToken, ...rest } = channel;
    return {
      ...rest,
      hasMetaAccessToken: Boolean(metaAccessToken),
    };
  }
}
