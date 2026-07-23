import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { QuerySystemLogDto } from "./dto/query-system-log.dto";

export interface CreateAccessLogInput {
  tenantId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  method: string;
  endpoint: string;
  statusCode: number;
  payload?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  duration: number;
}

@Injectable()
export class SystemLogService {
  private readonly logger = new Logger(SystemLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget: never throws to the caller. */
  record(input: CreateAccessLogInput): void {
    const data: Prisma.SystemAccessLogCreateInput = {
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      userEmail: input.userEmail ?? null,
      method: input.method,
      endpoint: input.endpoint,
      statusCode: input.statusCode,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      duration: input.duration,
    };
    if (input.payload !== undefined) {
      data.payload = input.payload as Prisma.InputJsonValue;
    }

    void this.prisma.systemAccessLog
      .create({ data })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to persist access log: ${message}`);
      });
  }

  async query(dto: QuerySystemLogDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.SystemAccessLogWhereInput = {};

    if (dto.method) {
      where.method = dto.method.toUpperCase();
    }
    if (dto.endpoint) {
      where.endpoint = { contains: dto.endpoint, mode: "insensitive" };
    }
    if (dto.ip) {
      where.ip = { contains: dto.ip };
    }
    if (dto.userId) {
      where.userId = dto.userId;
    }
    if (dto.tenantId) {
      where.tenantId = dto.tenantId;
    }
    if (dto.from || dto.to) {
      where.createdAt = {
        ...(dto.from ? { gte: new Date(dto.from) } : {}),
        ...(dto.to ? { lte: new Date(dto.to) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.systemAccessLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.systemAccessLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
