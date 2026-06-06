import { Module } from '@nestjs/common';
import { SellerCampaignsController } from './seller-campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  controllers: [SellerCampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
