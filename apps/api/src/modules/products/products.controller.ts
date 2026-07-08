import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { CreateProductDto, ListProductsDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ImportProductsDto } from "./dto/import-products.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("products")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Post()
  @Roles("OWNER", "ADMIN")
  create(@CurrentTenantId() tenantId: string, @Body() dto: CreateProductDto) {
    return this.service.create(tenantId, dto);
  }

  @Post("import")
  @Roles("OWNER", "ADMIN")
  bulkImport(
    @CurrentTenantId() tenantId: string,
    @Body() dto: ImportProductsDto,
  ) {
    return this.service.bulkImport(tenantId, dto.products);
  }

  @Get()
  findAll(@CurrentTenantId() tenantId: string, @Query() query: ListProductsDto) {
    return this.service.findAll(tenantId, query);
  }

  @Get("stats")
  getStats(@CurrentTenantId() tenantId: string) {
    return this.service.getStats(tenantId);
  }

  @Get(":id")
  findOne(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Put(":id")
  @Roles("OWNER", "ADMIN")
  update(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(":id")
  @Roles("OWNER", "ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.service.remove(tenantId, id);
  }
}
