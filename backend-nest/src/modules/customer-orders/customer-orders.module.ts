import { Module } from '@nestjs/common';
import { CustomerOrdersController } from './customer-orders.controller';
import { PublicCheckoutsController } from './public-checkouts.controller';
import { CustomerOrdersService } from './customer-orders.service';

@Module({
  controllers: [CustomerOrdersController, PublicCheckoutsController],
  providers: [CustomerOrdersService],
})
export class CustomerOrdersModule {}
