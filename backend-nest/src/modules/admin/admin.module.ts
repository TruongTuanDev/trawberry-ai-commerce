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
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [SellerFinanceModule],
  controllers: [
    AdminSellersController,
    AdminDashboardController,
    AdminQueuesController,
    AdminQueueTasksController,
    AdminReportsController,
    AdminUsersController,
  ],
  providers: [
    AdminSellersService,
    AdminDashboardService,
    AdminQueuesService,
    AdminQueueTasksService,
    AdminReportsService,
    AdminUsersService,
  ],
})
export class AdminModule {}
