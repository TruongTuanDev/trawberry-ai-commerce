import { Module } from '@nestjs/common';
import { AdminCampaignModerationController } from './admin-campaign-moderation.controller';
import { SellerCampaignsController } from './seller-campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  controllers: [SellerCampaignsController, AdminCampaignModerationController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
