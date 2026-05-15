import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminQueuesController } from './admin-queues.controller';
import { AdminQueuesService } from './admin-queues.service';
import { AdminSellersController } from './admin-sellers.controller';
import { AdminSellersService } from './admin-sellers.service';

@Module({
  controllers: [
    AdminSellersController,
    AdminDashboardController,
    AdminQueuesController,
  ],
  providers: [AdminSellersService, AdminDashboardService, AdminQueuesService],
})
export class AdminModule {}
