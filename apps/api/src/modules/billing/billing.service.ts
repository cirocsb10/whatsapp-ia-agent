import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma/prisma.service";

const STRIPE_PRICE_MAP: Record<string, string> = {
  STARTER: process.env.STRIPE_PRICE_STARTER ?? "price_starter",
  GROWTH: process.env.STRIPE_PRICE_GROWTH ?? "price_growth",
  SCALE: process.env.STRIPE_PRICE_SCALE ?? "price_scale",
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  private getStripe() {
    const Stripe = require("stripe");
    return new Stripe(this.config.get<string>("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-11-20.acacia" });
  }

  async createCheckoutSession(tenantId: string, plan: string): Promise<{ checkoutUrl: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    const stripe = this.getStripe();
    const customer = await stripe.customers.create({ name: tenant.name, metadata: { tenantId } });
    const frontendUrl = this.config.get<string>("FRONTEND_URL") ?? "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      customer: customer.id, mode: "subscription", payment_method_types: ["card"],
      line_items: [{ price: STRIPE_PRICE_MAP[plan] ?? "price_starter", quantity: 1 }],
      success_url: `${frontendUrl}/overview?checkout=success`, cancel_url: `${frontendUrl}/setup/plan?canceled=true`,
      metadata: { tenantId, plan }, subscription_data: { metadata: { tenantId }, trial_period_days: 14 },
    });
    return { checkoutUrl: session.url as string };
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const stripe = this.getStripe();
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET") ?? "";
    let event: any;
    try { event = stripe.webhooks.constructEvent(payload, signature, secret); } catch { throw new Error("Invalid Stripe webhook signature"); }
    this.logger.log(`Stripe webhook: ${event.type}`);
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const tenantId = sub.metadata?.tenantId;
      if (!tenantId) return;
      const priceId = sub.items?.data?.[0]?.price?.id;
      const plan = Object.entries(STRIPE_PRICE_MAP).find(([, v]) => v === priceId)?.[0];
      if (plan) await this.prisma.tenant.update({ where: { id: tenantId }, data: { planType: plan as any, status: sub.status === "active" || sub.status === "trialing" ? "ACTIVE" : "SUSPENDED" } });
    } else if (event.type === "customer.subscription.deleted") {
      const tenantId = event.data.object.metadata?.tenantId;
      if (tenantId) await this.prisma.tenant.update({ where: { id: tenantId }, data: { status: "CANCELLED" } });
    }
  }
}
