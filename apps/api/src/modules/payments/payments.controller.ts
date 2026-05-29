import { Controller, Post, Body, UseGuards, Headers, HttpCode, Get, Param } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post("generate")
  @UseGuards(ClerkAuthGuard)
  generatePix(@CurrentTenantId() tenantId: string, @Body("orderId") orderId: string) {
    return this.service.generatePix(tenantId, orderId);
  }

  @Post("generate-internal")
  @HttpCode(200)
  generatePixInternal(
    @Headers("x-internal-token") token: string,
    @Body() body: { orderId: string; tenantId: string; paymentMethod: string },
  ) {
    if (token !== process.env.INTERNAL_API_TOKEN) {
      throw new Error("Unauthorized");
    }
    return this.service.generatePix(body.tenantId, body.orderId);
  }

  @Post("webhooks/mercadopago")
  @HttpCode(200)
  mercadoPagoWebhook(@Body() body: { type: string; data: { id: string } }) {
    return this.service.handleWebhook(body);
  }
}
