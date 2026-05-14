import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class WildberriesImportOptionsDto {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultStockQuantity?: number;

  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE'], default: 'DRAFT' })
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE'])
  publishMode?: 'DRAFT' | 'ACTIVE';

  @ApiPropertyOptional({
    enum: ['REMOTE_URL', 'DOWNLOAD_TO_STORAGE'],
    default: 'REMOTE_URL',
  })
  @IsOptional()
  @IsIn(['REMOTE_URL', 'DOWNLOAD_TO_STORAGE'])
  imageMode?: 'REMOTE_URL' | 'DOWNLOAD_TO_STORAGE';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceFallback?: number;
}
