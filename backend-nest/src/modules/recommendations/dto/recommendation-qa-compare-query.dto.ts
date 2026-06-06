import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class RecommendationQaCompareQueryDto {
  @ApiPropertyOptional({
    default: 'home',
    enum: ['home', 'product_detail', 'search'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['home', 'product_detail', 'search'])
  placement: 'home' | 'product_detail' | 'search' = 'home';

  @ApiPropertyOptional({ default: 12 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  limit = 12;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  guestSessionId?: string;

  @ApiPropertyOptional()
  @ValidateIf(
    (value: RecommendationQaCompareQueryDto) => value.placement === 'search',
  )
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional()
  @ValidateIf(
    (value: RecommendationQaCompareQueryDto) =>
      value.placement === 'product_detail',
  )
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ default: false })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  debug?: boolean;

  @ApiPropertyOptional({ default: false })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  export?: boolean;

  @ApiPropertyOptional({ enum: ['json'] })
  @IsOptional()
  @IsString()
  @IsIn(['json'])
  format?: 'json';
}
