import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  SPONSORED_CAMPAIGN_LIMITS,
  SPONSORED_CAMPAIGN_TARGET_STATUSES,
  type SponsoredCampaignTargetStatus,
} from '../campaigns.constants';

export class UpsertSponsoredCampaignTargetDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(SPONSORED_CAMPAIGN_LIMITS.maxBoost)
  boost!: number;

  @ApiPropertyOptional({
    enum: SPONSORED_CAMPAIGN_TARGET_STATUSES,
    example: 'active',
    default: 'active',
  })
  @IsOptional()
  @IsIn(SPONSORED_CAMPAIGN_TARGET_STATUSES)
  status?: SponsoredCampaignTargetStatus;
}
