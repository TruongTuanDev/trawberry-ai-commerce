import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminSellersController } from './admin-sellers.controller';
import { AdminSellersService } from './admin-sellers.service';

@Module({
  controllers: [AdminSellersController, AdminDashboardController],
  providers: [AdminSellersService, AdminDashboardService],
})
export class AdminModule {}
