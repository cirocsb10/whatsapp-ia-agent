import { Controller, Post, UseGuards, Body, Headers, HttpCode, Req, Logger } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";
import { CreateCheckoutDto } from "./dto/create-checkout.dto";

@Controller("billing")
export class BillingController {
  private readonly logger = new Logger(BillingController.name);
  constructor(private readonly billingService: BillingService) {}

  @Post("checkout")
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles("OWNER", "ADMIN")
  createCheckout(@CurrentTenantId() tenantId: string, @Body() body: CreateCheckoutDto) {
    return this.billingService.createCheckoutSession(tenantId, body.plan);
  }

  @Post("webhooks/stripe")
  @HttpCode(200)
  async stripeWebhook(@Req() req: any, @Headers("stripe-signature") sig: string) {
    try {
      await this.billingService.handleWebhook(req.rawBody, sig);
    } catch (err) {
      this.logger.error("Stripe webhook error", err);
    }
  }
}
