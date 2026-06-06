import {
  IsString, IsInt, IsOptional, IsArray, Min, MaxLength,
  IsEnum, IsNumber,
} from "class-validator";
import { Type } from "class-transformer";

export type ProductStatus = "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";

export class CreateProductDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  priceCents!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  comparePriceCents?: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockQty!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  status?: ProductStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  variations?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  weight?: number;
}

export class ListProductsDto {
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
