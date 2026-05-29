import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
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
    const subtotal = body.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

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
          create: body.items.map((i) => ({
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
}
