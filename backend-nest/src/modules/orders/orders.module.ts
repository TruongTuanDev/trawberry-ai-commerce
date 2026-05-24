import { Module } from '@nestjs/common';
import { SellerFinanceModule } from '../seller-finance/seller-finance.module';
import { AdminOrdersController, OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [SellerFinanceModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
