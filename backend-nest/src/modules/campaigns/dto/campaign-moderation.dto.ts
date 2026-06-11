import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  SPONSORED_CAMPAIGN_MODERATION_STATUSES,
  type SponsoredCampaignModerationStatus,
} from '../campaigns.constants';

export class ListCampaignModerationQueryDto {
  @ApiPropertyOptional({ enum: SPONSORED_CAMPAIGN_MODERATION_STATUSES })
  @IsOptional()
  @IsIn(SPONSORED_CAMPAIGN_MODERATION_STATUSES)
  moderationStatus?: SponsoredCampaignModerationStatus;

  @ApiPropertyOptional({ example: 'summer' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}

export class CampaignModerationReasonDto {
  @ApiProperty({ example: 'Product target needs clearer disclosure.' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class CampaignModerationOptionalReasonDto {
  @ApiPropertyOptional({ example: 'Approved after policy review.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
