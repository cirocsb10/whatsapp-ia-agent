import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class CreateInternalOrderItemDto {
  @IsString()
  productId!: string;

  @IsString()
  productName!: string;

  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsObject()
  variationSelected?: Record<string, string>;
}

export class CreateInternalOrderDto {
  @IsString()
  tenantId!: string;

  @IsString()
  contactPhone!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInternalOrderItemDto)
  items!: CreateInternalOrderItemDto[];
}
