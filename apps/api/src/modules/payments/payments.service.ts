import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma/prisma.service";
import { randomUUID } from "crypto";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getMpClient() {
    const { MercadoPagoConfig, Payment } = require("mercadopago");
    const mp = new MercadoPagoConfig({
      accessToken: this.config.get<string>("MERCADO_PAGO_ACCESS_TOKEN") ?? "",
    });
    return new Payment(mp);
  }

  async generatePix(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { contact: true, items: true },
    });
    if (!order) throw new NotFoundException("Order not found");

    const totalBrl = order.totalCents / 100;
    const mpClient = this.getMpClient();

    const mpPayment = await mpClient.create({
      body: {
        transaction_amount: totalBrl,
        description: `Pedido ${order.orderNumber}`,
        payment_method_id: "pix",
        payer: {
          email: order.contact.email ?? `${order.contact.phone}@whatsagent.com.br`,
          first_name: order.contact.name?.split(" ")[0] ?? "Cliente",
          last_name: order.contact.name?.split(" ").slice(1).join(" ") ?? "",
          identification: { type: "CPF", number: "00000000000" },
        },
        external_reference: orderId,
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
      requestOptions: { idempotencyKey: randomUUID() },
    });

    const transactionData = mpPayment.point_of_interaction?.transaction_data;

    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        tenantId,
        method: "PIX",
        status: "PENDING",
        amountCents: order.totalCents,
        gatewayId: String(mpPayment.id),
        gatewayResponse: mpPayment as object,
        pixCopyPaste: transactionData?.qr_code ?? null,
        pixExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: "AWAITING_PAYMENT" },
    });

    return {
      paymentId: payment.id,
      pixCopyPaste: payment.pixCopyPaste,
      pixQrCodeBase64: transactionData?.qr_code_base64,
      expiresAt: payment.pixExpiresAt,
      totalCents: order.totalCents,
    };
  }

  async handleWebhook(body: { type: string; data: { id: string } }): Promise<void> {
    if (body.type !== "payment") return;

    const mpClient = this.getMpClient();
    const mpPayment = await mpClient.get({ id: body.data.id });
    const orderId = mpPayment.external_reference as string;
    if (!orderId) return;

    const payment = await this.prisma.payment.findFirst({
      where: { gatewayId: String(body.data.id) },
    });
    if (!payment) return;

    const newStatus = mpPayment.status === "approved" ? "APPROVED" :
      mpPayment.status === "rejected" ? "REJECTED" : "PENDING";

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        paidAt: mpPayment.status === "approved" ? new Date() : null,
        gatewayResponse: mpPayment as object,
      },
    });

    if (mpPayment.status === "approved") {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: "PAYMENT_CONFIRMED", confirmedAt: new Date() },
      });
      this.logger.log(`Payment confirmed for order: ${orderId}`);
    }
  }
}
