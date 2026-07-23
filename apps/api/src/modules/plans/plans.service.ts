import { Injectable, NotFoundException } from "@nestjs/common";
import { PlanType } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  DEFAULT_PLAN_LIMITS,
  PlatformSettingsService,
} from "../platform-settings/platform-settings.service";
import { OverridePlanDto } from "./dto/override-plan.dto";

const STRIPE_WARNING =
  "Assinatura Stripe não alterada. O override afeta apenas o plano interno do tenant.";

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async getOverview(page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const [items, total, settings] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          planType: true,
          stripeSubId: true,
          stripeCustomerId: true,
          createdAt: true,
          billing: {
            select: {
              currentPlan: true,
              conversationsThisMonth: true,
              conversationsLimit: true,
            },
          },
        },
      }),
      this.prisma.tenant.count(),
      this.platformSettings.getSettings(),
    ]);

    const limits = settings.planConversationLimits;

    return {
      items: items.map((tenant) => {
        const conversationsThisMonth = tenant.billing?.conversationsThisMonth ?? 0;
        const conversationsLimit =
          tenant.billing?.conversationsLimit ??
          limits[tenant.planType] ??
          DEFAULT_PLAN_LIMITS[tenant.planType] ??
          settings.defaultConversationsLimit;

        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          planType: tenant.planType,
          hasStripeSubscription: Boolean(tenant.stripeSubId),
          billing: tenant.billing
            ? {
                currentPlan: tenant.billing.currentPlan,
                conversationsThisMonth,
                conversationsLimit: tenant.billing.conversationsLimit,
              }
            : null,
          usage: {
            conversationsThisMonth,
            conversationsLimit,
          },
        };
      }),
      total,
      page,
      limit,
      planLimits: limits,
    };
  }

  async overridePlan(tenantId: string, dto: OverridePlanDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { billing: true },
    });

    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado");
    }

    const settings = await this.platformSettings.getSettings();
    const conversationsLimit =
      settings.planConversationLimits[dto.planType] ??
      DEFAULT_PLAN_LIMITS[dto.planType] ??
      settings.defaultConversationsLimit;

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextTenant = await tx.tenant.update({
        where: { id: tenantId },
        data: { planType: dto.planType },
      });

      let billing = tenant.billing;
      if (billing) {
        billing = await tx.platformBilling.update({
          where: { tenantId },
          data: {
            currentPlan: dto.planType,
            conversationsLimit,
          },
        });
      }

      return { tenant: nextTenant, billing };
    });

    return {
      tenantId,
      previousPlan: tenant.planType,
      planType: updated.tenant.planType as PlanType,
      billing: updated.billing
        ? {
            currentPlan: updated.billing.currentPlan,
            conversationsLimit: updated.billing.conversationsLimit,
            conversationsThisMonth: updated.billing.conversationsThisMonth,
          }
        : null,
      reason: dto.reason ?? null,
      warning: STRIPE_WARNING,
    };
  }
}
