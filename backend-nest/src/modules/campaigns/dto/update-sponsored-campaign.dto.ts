import { PartialType } from '@nestjs/swagger';
import { CreateSponsoredCampaignDto } from './create-sponsored-campaign.dto';

export class UpdateSponsoredCampaignDto extends PartialType(
  CreateSponsoredCampaignDto,
) {}
