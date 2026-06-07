import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateProductDto, ListProductsDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ImportProductItemDto } from "./dto/import-products.dto";

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
    const {
      page = 1,
      limit = 20,
      search,
      status,
      categoryId,
      minPriceCents,
      maxPriceCents,
      minStock,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;
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
      ...((minPriceCents !== undefined || maxPriceCents !== undefined) && {
        priceCents: {
          ...(minPriceCents !== undefined && { gte: minPriceCents }),
          ...(maxPriceCents !== undefined && { lte: maxPriceCents }),
        },
      }),
      ...(minStock !== undefined && { stockQty: { gte: minStock } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getStats(tenantId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    outOfStock: number;
  }> {
    const [total, active, inactive, outOfStock] = await Promise.all([
      this.prisma.product.count({ where: { tenantId } }),
      this.prisma.product.count({ where: { tenantId, status: "ACTIVE" } }),
      this.prisma.product.count({ where: { tenantId, status: "INACTIVE" } }),
      this.prisma.product.count({ where: { tenantId, status: "OUT_OF_STOCK" } }),
    ]);
    return { total, active, inactive, outOfStock };
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

    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.sku !== undefined) data.sku = dto.sku ?? null;
    if (dto.priceCents !== undefined) data.priceCents = dto.priceCents;
    if (dto.comparePriceCents !== undefined) data.comparePriceCents = dto.comparePriceCents ?? null;
    if (dto.stockQty !== undefined) data.stockQty = dto.stockQty;
    if (dto.lowStockThreshold !== undefined) data.lowStockThreshold = dto.lowStockThreshold;
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true };
    }
    if (dto.status !== undefined) data.status = dto.status as any;
    if (dto.tags !== undefined) data.tags = dto.tags ?? [];
    if (dto.imageUrls !== undefined) data.imageUrls = dto.imageUrls ?? [];
    if (dto.weight !== undefined) data.weight = dto.weight ?? null;

    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.product.delete({ where: { id } });
  }

  async bulkImport(
    tenantId: string,
    items: ImportProductItemDto[],
  ): Promise<{ imported: number; errors: Array<{ row: number; message: string }> }> {
    const errors: Array<{ row: number; message: string }> = [];
    let imported = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      try {
        await this.prisma.product.create({
          data: {
            tenantId,
            name: item.name,
            description: item.description ?? null,
            sku: item.sku ?? null,
            priceCents: item.priceCents,
            stockQty: item.stockQty,
            tags: item.tags ?? [],
            status: "ACTIVE",
            lowStockThreshold: 5,
            reservedQty: 0,
          },
        });
        imported++;
      } catch (err) {
        errors.push({ row: i + 2, message: (err as Error).message });
      }
    }

    return { imported, errors };
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
