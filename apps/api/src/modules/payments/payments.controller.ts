import { Controller, Post, Body, UseGuards, Headers, HttpCode, UnauthorizedException } from "@nestjs/common";
import { timingSafeEqual } from "crypto";
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
    const expectedToken = process.env.INTERNAL_API_TOKEN;
    if (!expectedToken) {
      throw new Error("INTERNAL_API_TOKEN is not configured");
    }
    const tokenBuf = Buffer.from(token ?? "");
    const expectedBuf = Buffer.from(expectedToken);
    if (tokenBuf.length !== expectedBuf.length || !timingSafeEqual(tokenBuf, expectedBuf)) {
      throw new UnauthorizedException("Unauthorized");
    }
    return this.service.generatePix(body.tenantId, body.orderId);
  }

  @Post("webhooks/mercadopago")
  @HttpCode(200)
  async mercadoPagoWebhook(
    @Body() body: { type: string; data: { id: string } },
    @Headers("x-signature") xSignature?: string,
    @Headers("x-request-id") xRequestId?: string,
  ) {
    this.service.validateMpSignature(xSignature, xRequestId, body.data?.id ?? "");
    return this.service.handleWebhook(body);
  }
}
