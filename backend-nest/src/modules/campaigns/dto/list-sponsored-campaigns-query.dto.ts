import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  SPONSORED_CAMPAIGN_SCENARIO_TYPES,
  SPONSORED_CAMPAIGN_STATUSES,
  type SponsoredCampaignScenarioType,
  type SponsoredCampaignStatus,
} from '../campaigns.constants';

export class ListSponsoredCampaignsQueryDto {
  @ApiPropertyOptional({
    enum: SPONSORED_CAMPAIGN_STATUSES,
    example: 'active',
  })
  @IsOptional()
  @IsIn(SPONSORED_CAMPAIGN_STATUSES)
  status?: SponsoredCampaignStatus;

  @ApiPropertyOptional({
    enum: SPONSORED_CAMPAIGN_SCENARIO_TYPES,
    example: 'home',
  })
  @IsOptional()
  @IsIn(SPONSORED_CAMPAIGN_SCENARIO_TYPES)
  scenarioType?: SponsoredCampaignScenarioType;
}
