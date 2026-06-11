import { Module } from '@nestjs/common';
import { AdminAdsMonitoringController } from './admin-ads-monitoring.controller';
import { AdsMonitoringService } from './ads-monitoring.service';

@Module({
  controllers: [AdminAdsMonitoringController],
  providers: [AdsMonitoringService],
  exports: [AdsMonitoringService],
})
export class AdsMonitoringModule {}
