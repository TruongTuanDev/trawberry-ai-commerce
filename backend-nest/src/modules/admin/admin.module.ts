import { Module } from '@nestjs/common';
import { SellerFinanceModule } from '../seller-finance/seller-finance.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminQueueTasksController } from './admin-queue-tasks.controller';
import { AdminQueueTasksService } from './admin-queue-tasks.service';
import { AdminQueuesController } from './admin-queues.controller';
import { AdminQueuesService } from './admin-queues.service';
import { AdminReportsController } from './admin-reports.controller';
import { AdminReportsService } from './admin-reports.service';
import { AdminSellersController } from './admin-sellers.controller';
import { AdminSellersService } from './admin-sellers.service';

@Module({
  imports: [SellerFinanceModule],
  controllers: [
    AdminSellersController,
    AdminDashboardController,
    AdminQueuesController,
    AdminQueueTasksController,
    AdminReportsController,
  ],
  providers: [
    AdminSellersService,
    AdminDashboardService,
    AdminQueuesService,
    AdminQueueTasksService,
    AdminReportsService,
  ],
})
export class AdminModule {}
