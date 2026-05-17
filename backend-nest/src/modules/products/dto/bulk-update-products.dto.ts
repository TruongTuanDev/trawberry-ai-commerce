import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class BulkUpdateProductValuesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({
    description:
      'Sets manual seller price. The current MVP applies the same value to basePrice and discountPrice.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  trackInventory?: boolean;
}

class BulkUpdateScopeDto {
  @ApiPropertyOptional({
    enum: ['ALL_VARIANTS', 'MISSING_ONLY', 'FIRST_VARIANT_ONLY'],
    default: 'ALL_VARIANTS',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ALL_VARIANTS', 'MISSING_ONLY', 'FIRST_VARIANT_ONLY'])
  variantMode?: 'ALL_VARIANTS' | 'MISSING_ONLY' | 'FIRST_VARIANT_ONLY';
}

export class BulkUpdateProductsDto {
  @ApiProperty({ isArray: true, type: String })
  @IsArray()
  @IsString({ each: true })
  productIds!: string[];

  @ApiProperty({ type: BulkUpdateProductValuesDto })
  @ValidateNested()
  @Type(() => BulkUpdateProductValuesDto)
  updates!: BulkUpdateProductValuesDto;

  @ApiPropertyOptional({ type: BulkUpdateScopeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BulkUpdateScopeDto)
  scope?: BulkUpdateScopeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  publishIfReady?: boolean;
}
