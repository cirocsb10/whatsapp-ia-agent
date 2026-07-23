import {
  Controller,
  Get,
  Post,
  UseGuards,
  Body,
  Headers,
  HttpCode,
  Req,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { BillingService } from "./billing.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";
import { CreateCheckoutDto } from "./dto/create-checkout.dto";

@Controller("billing")
export class BillingController {
  private readonly logger = new Logger(BillingController.name);
  constructor(private readonly billingService: BillingService) {}

  @Get("subscription")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "ADMIN")
  getSubscription(@CurrentTenantId() tenantId: string) {
    return this.billingService.getSubscription(tenantId);
  }

  @Get("history")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "ADMIN")
  getBillingHistory(@CurrentTenantId() tenantId: string) {
    return this.billingService.getBillingHistory(tenantId);
  }

  @Post("checkout")
  @UseGuards(JwtAuthGuard, RolesGuard)
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
      // Retorna um erro (não 200) para que o Stripe repita a entrega em caso de
      // assinatura inválida ou falha de processamento, em vez de marcar como entregue.
      throw new BadRequestException("Webhook processing failed");
    }
  }
}
