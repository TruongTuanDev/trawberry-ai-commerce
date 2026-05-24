import { Module } from '@nestjs/common';
import { AdminSellerFinanceController } from './admin-seller-finance.controller';
import { SellerFinanceController } from './seller-finance.controller';
import { SellerFinanceService } from './seller-finance.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AdminSellerFinanceController, SellerFinanceController],
  providers: [SellerFinanceService],
  exports: [SellerFinanceService],
})
export class SellerFinanceModule {}
