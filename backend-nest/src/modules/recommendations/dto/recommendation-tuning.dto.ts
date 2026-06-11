import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { RECOMMENDATION_TUNING_LIMITS } from '../recommendation-tuning-config';

export class RecommendationTuningWeightsDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(RECOMMENDATION_TUNING_LIMITS.coreWeightMin)
  @Max(RECOMMENDATION_TUNING_LIMITS.coreWeightMax)
  categoryScore!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(RECOMMENDATION_TUNING_LIMITS.coreWeightMin)
  @Max(RECOMMENDATION_TUNING_LIMITS.coreWeightMax)
  textScore!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(RECOMMENDATION_TUNING_LIMITS.coreWeightMin)
  @Max(RECOMMENDATION_TUNING_LIMITS.coreWeightMax)
  popularityScore!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(RECOMMENDATION_TUNING_LIMITS.coreWeightMin)
  @Max(RECOMMENDATION_TUNING_LIMITS.coreWeightMax)
  freshnessScore!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(RECOMMENDATION_TUNING_LIMITS.coreWeightMin)
  @Max(RECOMMENDATION_TUNING_LIMITS.coreWeightMax)
  ratingScore!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(RECOMMENDATION_TUNING_LIMITS.coreWeightMin)
  @Max(RECOMMENDATION_TUNING_LIMITS.coreWeightMax)
  stockScore!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(RECOMMENDATION_TUNING_LIMITS.coreWeightMin)
  @Max(RECOMMENDATION_TUNING_LIMITS.coreWeightMax)
  shopScore!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(RECOMMENDATION_TUNING_LIMITS.optionalWeightMin)
  @Max(RECOMMENDATION_TUNING_LIMITS.optionalWeightMax)
  personalizationScore!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(RECOMMENDATION_TUNING_LIMITS.optionalWeightMin)
  @Max(RECOMMENDATION_TUNING_LIMITS.optionalWeightMax)
  analyticsPerformanceScore!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(RECOMMENDATION_TUNING_LIMITS.sponsoredWeightMin)
  @Max(RECOMMENDATION_TUNING_LIMITS.sponsoredWeightMax)
  sponsoredBoost!: number;
}

export class RecommendationTuningGuardrailsDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(RECOMMENDATION_TUNING_LIMITS.maxSponsoredBoostScore)
  maxSponsoredBoostScore!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(RECOMMENDATION_TUNING_LIMITS.maxBusinessBoostScore)
  maxBusinessBoostScore!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(RECOMMENDATION_TUNING_LIMITS.maxAnalyticsPerformanceScore)
  maxAnalyticsPerformanceScore!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(RECOMMENDATION_TUNING_LIMITS.maxPersonalizationScore)
  maxPersonalizationScore!: number;
}

export class CreateRecommendationTuningPresetDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ type: RecommendationTuningWeightsDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => RecommendationTuningWeightsDto)
  weights!: RecommendationTuningWeightsDto;

  @ApiProperty({ type: RecommendationTuningGuardrailsDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => RecommendationTuningGuardrailsDto)
  guardrails!: RecommendationTuningGuardrailsDto;
}

export class UpdateRecommendationTuningWeightsDto extends PartialType(
  RecommendationTuningWeightsDto,
) {}

export class UpdateRecommendationTuningGuardrailsDto extends PartialType(
  RecommendationTuningGuardrailsDto,
) {}

export class UpdateRecommendationTuningPresetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ type: UpdateRecommendationTuningWeightsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateRecommendationTuningWeightsDto)
  weights?: UpdateRecommendationTuningWeightsDto;

  @ApiPropertyOptional({ type: UpdateRecommendationTuningGuardrailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateRecommendationTuningGuardrailsDto)
  guardrails?: UpdateRecommendationTuningGuardrailsDto;
}

export class RecommendationTuningPreviewDto {
  @ApiProperty({ enum: ['home', 'product_detail', 'search'] })
  @IsIn(['home', 'product_detail', 'search'])
  placement!: 'home' | 'product_detail' | 'search';

  @ApiPropertyOptional()
  @ValidateIf(
    (value: RecommendationTuningPreviewDto) => value.placement === 'search',
  )
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional()
  @ValidateIf(
    (value: RecommendationTuningPreviewDto) =>
      value.placement === 'product_detail',
  )
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ default: 8 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  limit = 8;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  guestSessionId?: string;
}

export class RecommendationTuningRollbackDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  targetVersion?: number;
}
