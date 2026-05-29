import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateProductDto, UpdateProductDto, ListProductsDto } from "./dto/create-product.dto";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description ?? null,
        sku: dto.sku ?? null,
        priceCents: dto.priceCents,
        comparePriceCents: dto.comparePriceCents ?? null,
        stockQty: dto.stockQty,
        lowStockThreshold: dto.lowStockThreshold ?? 5,
        categoryId: dto.categoryId ?? null,
        status: (dto.status ?? "ACTIVE") as any,
        tags: dto.tags ?? [],
        imageUrls: dto.imageUrls ?? [],
        weight: dto.weight ?? null,
      },
    });
  }

  async findAll(tenantId: string, query: ListProductsDto) {
    const { page = 1, limit = 20, search, status, categoryId } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    await this.findOne(tenantId, id);
    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description ?? null,
        sku: dto.sku ?? null,
        priceCents: dto.priceCents,
        comparePriceCents: dto.comparePriceCents ?? null,
        stockQty: dto.stockQty,
        ...(dto.lowStockThreshold !== undefined && { lowStockThreshold: dto.lowStockThreshold }),
        categoryId: dto.categoryId ?? null,
        status: dto.status as any,
        tags: dto.tags ?? [],
        imageUrls: dto.imageUrls ?? [],
        weight: dto.weight ?? null,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.product.delete({ where: { id } });
  }

  async bulkImportFromCsv(tenantId: string, rows: Array<Record<string, string>>) {
    let created = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const priceCents = Math.round(parseFloat(row["preco"] ?? "0") * 100);
        const stockQty = parseInt(row["estoque"] ?? "0", 10);
        if (!row["nome"] || priceCents <= 0) {
          errors.push(`Linha inválida: ${JSON.stringify(row)}`);
          continue;
        }
        const createDto: CreateProductDto = {
          name: row["nome"] ?? "",
          priceCents,
          stockQty,
          tags: row["tags"]?.split(",").map((t) => t.trim()) ?? [],
        };
        if (row["descricao"] !== undefined) createDto.description = row["descricao"];
        if (row["sku"] !== undefined) createDto.sku = row["sku"];
        await this.create(tenantId, createDto);
        created++;
      } catch (err) {
        errors.push(`Erro: ${err}`);
      }
    }

    return { created, errors };
  }
}
