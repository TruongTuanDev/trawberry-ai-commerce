import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class BulkVariantUpdateDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chrtId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discountPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity?: number;
}

class BulkProductUpdatesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  categoryName?: string;

  @ApiPropertyOptional({ type: [BulkVariantUpdateDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkVariantUpdateDto)
  variants?: BulkVariantUpdateDto[];
}

export class BulkProductActionDto {
  @ApiProperty({ isArray: true, type: String })
  @IsArray()
  @IsString({ each: true })
  productIds!: string[];

  @ApiProperty({ enum: ['PUBLISH', 'UNPUBLISH', 'ARCHIVE'] })
  @IsString()
  @IsIn(['PUBLISH', 'UNPUBLISH', 'ARCHIVE'])
  action!: 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE';

  @ApiPropertyOptional({ type: BulkProductUpdatesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BulkProductUpdatesDto)
  updates?: BulkProductUpdatesDto;
}
