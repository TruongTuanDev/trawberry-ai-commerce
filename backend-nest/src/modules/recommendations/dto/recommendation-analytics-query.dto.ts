import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export const RECOMMENDATION_ANALYTICS_RANGE_PRESETS = [
  'today',
  'last7d',
  'last30d',
  'custom',
] as const;

export type RecommendationAnalyticsRangePreset =
  (typeof RECOMMENDATION_ANALYTICS_RANGE_PRESETS)[number];

export class RecommendationAnalyticsQueryDto {
  @ApiPropertyOptional({
    enum: RECOMMENDATION_ANALYTICS_RANGE_PRESETS,
    default: 'last7d',
  })
  @IsOptional()
  @IsIn(RECOMMENDATION_ANALYTICS_RANGE_PRESETS)
  range?: RecommendationAnalyticsRangePreset;

  @ApiPropertyOptional({
    description:
      'Optional custom inclusive start date in ISO format when range=custom.',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Optional custom inclusive end date in ISO format when range=custom.',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Top item limit for product tables.',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;
}
