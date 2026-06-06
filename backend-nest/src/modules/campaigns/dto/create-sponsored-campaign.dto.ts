import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SPONSORED_CAMPAIGN_BILLING_MODES,
  SPONSORED_CAMPAIGN_LIMITS,
  SPONSORED_CAMPAIGN_SCENARIO_TYPES,
  SPONSORED_CAMPAIGN_STATUSES,
  type SponsoredCampaignBillingMode,
  type SponsoredCampaignScenarioType,
  type SponsoredCampaignStatus,
} from '../campaigns.constants';

export class CreateSponsoredCampaignDto {
  @ApiProperty({ example: 'Summer visibility push' })
  @IsString()
  @MaxLength(SPONSORED_CAMPAIGN_LIMITS.maxNameLength)
  name!: string;

  @ApiPropertyOptional({ example: 'Internal launch campaign for top dresses.' })
  @IsOptional()
  @IsString()
  @MaxLength(SPONSORED_CAMPAIGN_LIMITS.maxDescriptionLength)
  description?: string;

  @ApiPropertyOptional({
    enum: SPONSORED_CAMPAIGN_STATUSES,
    example: 'draft',
    default: 'draft',
  })
  @IsOptional()
  @IsIn(SPONSORED_CAMPAIGN_STATUSES)
  status?: SponsoredCampaignStatus;

  @ApiProperty({
    type: [String],
    enum: SPONSORED_CAMPAIGN_SCENARIO_TYPES,
    example: ['home', 'similar'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(3)
  @IsIn(SPONSORED_CAMPAIGN_SCENARIO_TYPES, { each: true })
  scenarioTypes!: SponsoredCampaignScenarioType[];

  @ApiPropertyOptional({ example: '2026-06-10T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(SPONSORED_CAMPAIGN_LIMITS.maxBudgetLimit)
  budgetLimit?: number | null;

  @ApiPropertyOptional({
    enum: SPONSORED_CAMPAIGN_BILLING_MODES,
    example: 'none',
    default: 'none',
  })
  @IsOptional()
  @IsIn(SPONSORED_CAMPAIGN_BILLING_MODES)
  billingMode?: SponsoredCampaignBillingMode;

  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(SPONSORED_CAMPAIGN_LIMITS.maxBoost)
  maxBoost!: number;
}
