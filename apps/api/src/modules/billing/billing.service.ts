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

  async getSubscription(tenantId: string) {
    const [billing, tenant] = await Promise.all([
      this.prisma.platformBilling.findUnique({ where: { tenantId } }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { planType: true, status: true, stripeCustomerId: true },
      }),
    ]);

    let renewalDate: string | null = null;
    if (tenant?.stripeCustomerId) {
      try {
        const stripe = this.getStripe();
        const subs = await stripe.subscriptions.list({
          customer: tenant.stripeCustomerId,
          status: "active",
          limit: 1,
        });
        if (subs.data.length > 0) {
          renewalDate = new Date(subs.data[0].current_period_end * 1000).toISOString();
        }
      } catch {
        // Stripe indisponível — prosseguir sem renewalDate
      }
    }

    return {
      plan: tenant?.planType ?? "STARTER",
      status: tenant?.status ?? "TRIAL",
      renewalDate,
      usage: {
        conversations: { used: billing?.conversationsThisMonth ?? 0, limit: billing?.conversationsLimit ?? 100 },
        orders: { used: 0, limit: 500 },
        products: { used: 0, limit: 200 },
      },
    };
  }

  async getBillingHistory(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeCustomerId: true },
    });

    if (!tenant?.stripeCustomerId) return { invoices: [] };

    try {
      const stripe = this.getStripe();
      const invoices = await stripe.invoices.list({
        customer: tenant.stripeCustomerId,
        limit: 12,
      });
      return {
        invoices: invoices.data.map((inv: { id: string; created: number; amount_paid: number; currency: string; status: string | null; invoice_pdf: string | null }) => ({
          id: inv.id,
          date: new Date(inv.created * 1000).toISOString(),
          amount: (inv.amount_paid / 100).toFixed(2),
          currency: inv.currency.toUpperCase(),
          status: inv.status,
          pdfUrl: inv.invoice_pdf,
        })),
      };
    } catch {
      return { invoices: [] };
    }
  }
}
