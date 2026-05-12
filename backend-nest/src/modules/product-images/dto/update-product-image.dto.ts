import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

const PRODUCT_IMAGE_TYPES = [
  'ORIGINAL',
  'AI_GENERATED',
  'MODEL_REFERENCE',
  'FRONT',
  'BACK',
  'DETAIL',
] as const;

export class UpdateProductImageDto {
  @ApiPropertyOptional({ enum: PRODUCT_IMAGE_TYPES })
  @IsOptional()
  @IsIn(PRODUCT_IMAGE_TYPES)
  imageType?: (typeof PRODUCT_IMAGE_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}
