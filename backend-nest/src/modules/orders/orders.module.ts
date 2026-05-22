import { Module } from '@nestjs/common';
import { SellerFinanceModule } from '../seller-finance/seller-finance.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [SellerFinanceModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
