import { Module } from '@nestjs/common';
import { SellerFinanceModule } from '../seller-finance/seller-finance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [SellerFinanceModule, NotificationsModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
