import { Module } from '@nestjs/common';
import { AdminSellersController } from './admin-sellers.controller';
import { AdminSellersService } from './admin-sellers.service';

@Module({
  controllers: [AdminSellersController],
  providers: [AdminSellersService],
})
export class AdminModule {}
