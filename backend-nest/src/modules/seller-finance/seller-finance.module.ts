import { Module } from '@nestjs/common';
import { AdminSellerFinanceController } from './admin-seller-finance.controller';
import { SellerFinanceController } from './seller-finance.controller';
import { SellerFinanceService } from './seller-finance.service';

@Module({
  controllers: [AdminSellerFinanceController, SellerFinanceController],
  providers: [SellerFinanceService],
  exports: [SellerFinanceService],
})
export class SellerFinanceModule {}
