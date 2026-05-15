import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminQueueTasksController } from './admin-queue-tasks.controller';
import { AdminQueueTasksService } from './admin-queue-tasks.service';
import { AdminQueuesController } from './admin-queues.controller';
import { AdminQueuesService } from './admin-queues.service';
import { AdminSellersController } from './admin-sellers.controller';
import { AdminSellersService } from './admin-sellers.service';

@Module({
  controllers: [
    AdminSellersController,
    AdminDashboardController,
    AdminQueuesController,
    AdminQueueTasksController,
  ],
  providers: [
    AdminSellersService,
    AdminDashboardService,
    AdminQueuesService,
    AdminQueueTasksService,
  ],
})
export class AdminModule {}
