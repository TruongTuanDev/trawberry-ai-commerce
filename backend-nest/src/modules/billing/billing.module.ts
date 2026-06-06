import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { SellerBillingController } from './seller-billing.controller';

@Module({
  controllers: [SellerBillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
