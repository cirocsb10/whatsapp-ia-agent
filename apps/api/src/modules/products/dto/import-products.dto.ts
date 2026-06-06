import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ImportProductItemDto {
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
  priceCents!: number;

  @IsInt()
  @Min(0)
  stockQty!: number;

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}

export class ImportProductsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportProductItemDto)
  products!: ImportProductItemDto[];
}
