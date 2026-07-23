import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UpdatePlatformSettingsDto } from "./dto/update-platform-settings.dto";

const SETTINGS_ID = "default";

export const DEFAULT_PLAN_LIMITS: Record<string, number> = {
  STARTER: 100,
  GROWTH: 1000,
  SCALE: 5000,
  ENTERPRISE: 20000,
};

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: SETTINGS_ID },
    });

    if (!settings) {
      return {
        id: SETTINGS_ID,
        maintenanceMode: false,
        maintenanceMessage: null,
        newTenantRegistrationOpen: true,
        defaultTrialDays: 7,
        defaultConversationsLimit: 100,
        planConversationLimits: { ...DEFAULT_PLAN_LIMITS },
        updatedAt: new Date(),
      };
    }

    return {
      ...settings,
      planConversationLimits: normalizePlanLimits(settings.planConversationLimits),
    };
  }

  async updateSettings(dto: UpdatePlatformSettingsDto) {
    const planLimits =
      dto.planConversationLimits !== undefined
        ? {
            ...DEFAULT_PLAN_LIMITS,
            ...Object.fromEntries(
              Object.entries(dto.planConversationLimits).filter(
                ([, v]) => typeof v === "number",
              ),
            ),
          }
        : undefined;

    const updated = await this.prisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        maintenanceMode: dto.maintenanceMode ?? false,
        maintenanceMessage: dto.maintenanceMessage ?? null,
        newTenantRegistrationOpen: dto.newTenantRegistrationOpen ?? true,
        defaultTrialDays: dto.defaultTrialDays ?? 7,
        defaultConversationsLimit: dto.defaultConversationsLimit ?? 100,
        planConversationLimits: (planLimits ?? DEFAULT_PLAN_LIMITS) as Prisma.InputJsonValue,
      },
      update: {
        ...(dto.maintenanceMode !== undefined && {
          maintenanceMode: dto.maintenanceMode,
        }),
        ...(dto.maintenanceMessage !== undefined && {
          maintenanceMessage: dto.maintenanceMessage || null,
        }),
        ...(dto.newTenantRegistrationOpen !== undefined && {
          newTenantRegistrationOpen: dto.newTenantRegistrationOpen,
        }),
        ...(dto.defaultTrialDays !== undefined && {
          defaultTrialDays: dto.defaultTrialDays,
        }),
        ...(dto.defaultConversationsLimit !== undefined && {
          defaultConversationsLimit: dto.defaultConversationsLimit,
        }),
        ...(planLimits !== undefined && {
          planConversationLimits: planLimits as Prisma.InputJsonValue,
        }),
      },
    });

    return {
      ...updated,
      planConversationLimits: normalizePlanLimits(updated.planConversationLimits),
    };
  }
}

function normalizePlanLimits(value: unknown): Record<string, number> {
  const base = { ...DEFAULT_PLAN_LIMITS };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return base;
  }
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      base[key] = Math.floor(raw);
    }
  }
  return base;
}
