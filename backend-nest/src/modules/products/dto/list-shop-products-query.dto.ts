import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListShopProductsQueryDto {
  @ApiPropertyOptional({ example: 'shoe' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: 'shoe' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'IMPORTED',
    enum: [
      'IMPORTED',
      'DRAFT',
      'READY',
      'PUBLISHED',
      'UNPUBLISHED',
      'ARCHIVED',
    ],
  })
  @IsOptional()
  @IsString()
  @IsIn(['IMPORTED', 'DRAFT', 'READY', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'])
  catalogStatus?:
    | 'IMPORTED'
    | 'DRAFT'
    | 'READY'
    | 'PUBLISHED'
    | 'UNPUBLISHED'
    | 'ARCHIVED';

  @ApiPropertyOptional({
    example: 'WILDBERRIES_API',
    enum: ['MANUAL', 'WILDBERRIES_EXCEL', 'WILDBERRIES_API'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['MANUAL', 'WILDBERRIES_EXCEL', 'WILDBERRIES_API'])
  source?: 'MANUAL' | 'WILDBERRIES_EXCEL' | 'WILDBERRIES_API';

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  visibility?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  missingPrice?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  missingStock?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  missingCategory?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  readyToPublish?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  needsReview?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional({
    example: 'LOW_STOCK',
    enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'])
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

  @ApiPropertyOptional({ example: 42 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ example: 'updatedAt_desc' })
  @IsOptional()
  @IsString()
  @IsIn(['updatedAt_desc', 'updatedAt_asc', 'title_asc', 'title_desc'])
  sort?: 'updatedAt_desc' | 'updatedAt_asc' | 'title_asc' | 'title_desc';

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size = 20;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
