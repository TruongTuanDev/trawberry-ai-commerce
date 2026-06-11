import { Module } from '@nestjs/common';
import { AdminAdsWalletTopUpsController } from './admin-ads-wallet-top-ups.controller';
import { AdsWalletTopUpsService } from './ads-wallet-top-ups.service';
import { BillingService } from './billing.service';
import { SellerAdsWalletTopUpsController } from './seller-ads-wallet-top-ups.controller';
import { SellerBillingController } from './seller-billing.controller';

@Module({
  controllers: [
    SellerBillingController,
    SellerAdsWalletTopUpsController,
    AdminAdsWalletTopUpsController,
  ],
  providers: [BillingService, AdsWalletTopUpsService],
  exports: [BillingService],
})
export class BillingModule {}
