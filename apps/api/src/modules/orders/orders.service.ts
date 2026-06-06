import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createInternal(body: {
    tenantId: string;
    contactPhone: string;
    items: Array<{
      productId: string;
      productName: string;
      priceCents: number;
      quantity: number;
      variationSelected?: Record<string, string>;
    }>;
  }) {
    const productIds = body.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, tenantId: body.tenantId },
      select: { id: true, priceCents: true, name: true },
    });

    if (products.length !== productIds.length) {
      const missing = productIds.filter((id) => !products.find((p) => p.id === id));
      throw new NotFoundException(`Produtos não encontrados: ${missing.join(", ")}`);
    }

    const priceMap = new Map(products.map((p) => [p.id, p.priceCents]));
    const resolvedItems = body.items.map((i) => ({
      ...i,
      priceCents: priceMap.get(i.productId)!,
    }));

    const subtotal = resolvedItems.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

    const contact = await this.prisma.contact.upsert({
      where: { tenantId_phone: { tenantId: body.tenantId, phone: body.contactPhone } },
      create: { tenantId: body.tenantId, phone: body.contactPhone },
      update: {},
    });

    const orderNumber = `ORD-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    return this.prisma.order.create({
      data: {
        tenantId: body.tenantId,
        contactId: contact.id,
        orderNumber,
        subtotalCents: subtotal,
        totalCents: subtotal,
        status: "DRAFT",
        items: {
          create: resolvedItems.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            priceCents: i.priceCents,
            quantity: i.quantity,
            subtotalCents: i.priceCents * i.quantity,
            variationSelected: i.variationSelected ?? {},
          })),
        },
      },
    });
  }

  async findAll(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { tenantId };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { contact: { select: { phone: true, name: true } }, items: true },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: { contact: true, items: true, payments: true },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    const valid = Object.values(OrderStatus);
    if (!valid.includes(status as OrderStatus)) {
      throw new BadRequestException(`Status inválido: ${status}`);
    }
    const order = await this.prisma.order.findFirst({ where: { id, tenantId } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return this.prisma.order.update({
      where: { id },
      data: {
        status: status as OrderStatus,
        ...(status === OrderStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
        ...(status === OrderStatus.CANCELLED ? { cancelledAt: new Date() } : {}),
      },
    });
  }

  async cancelOrder(tenantId: string, id: string) {
    return this.updateStatus(tenantId, id, "CANCELLED");
  }
}
