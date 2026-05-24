import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { SellerFinanceModule } from '../seller-finance/seller-finance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminReturnRefundsController } from './admin-return-refunds.controller';
import { CustomerReturnRefundsController } from './customer-return-refunds.controller';
import { SellerReturnRefundsController } from './seller-return-refunds.controller';
import { ReturnRefundsService } from './return-refunds.service';

@Module({
  imports: [FilesModule, SellerFinanceModule, NotificationsModule],
  controllers: [
    CustomerReturnRefundsController,
    SellerReturnRefundsController,
    AdminReturnRefundsController,
  ],
  providers: [ReturnRefundsService],
  exports: [ReturnRefundsService],
})
export class ReturnRefundsModule {}
