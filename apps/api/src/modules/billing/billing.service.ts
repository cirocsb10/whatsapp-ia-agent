import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  private getPriceMap(): Record<string, string> {
    return {
      STARTER: this.config.get("STRIPE_PRICE_STARTER_MONTHLY") ?? "",
      GROWTH: this.config.get("STRIPE_PRICE_GROWTH_MONTHLY") ?? "",
      SCALE: this.config.get("STRIPE_PRICE_SCALE_MONTHLY") ?? "",
    };
  }

  private getStripe() {
    const Stripe = require("stripe");
    return new Stripe(this.config.get<string>("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2024-11-20.acacia" });
  }

  async createCheckoutSession(tenantId: string, plan: string): Promise<{ checkoutUrl: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    const stripe = this.getStripe();
    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ name: tenant.name, metadata: { tenantId } });
      customerId = customer.id;
      await this.prisma.tenant.update({ where: { id: tenantId }, data: { stripeCustomerId: customerId } });
    }
    const frontendUrl = this.config.get<string>("FRONTEND_URL") ?? "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      customer: customerId, mode: "subscription", payment_method_types: ["card"],
      line_items: [{ price: this.getPriceMap()[plan] ?? "", quantity: 1 }],
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
      const plan = Object.entries(this.getPriceMap()).find(([, v]) => v === priceId)?.[0];
      if (plan) await this.prisma.tenant.update({ where: { id: tenantId }, data: { planType: plan as any, status: sub.status === "active" || sub.status === "trialing" ? "ACTIVE" : "SUSPENDED" } });
    } else if (event.type === "customer.subscription.deleted") {
      const tenantId = event.data.object.metadata?.tenantId;
      if (tenantId) await this.prisma.tenant.update({ where: { id: tenantId }, data: { status: "CANCELLED" } });
    }
  }
}
