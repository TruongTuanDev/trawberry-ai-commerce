import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { OrderTrackingController } from './order-tracking.controller';
import { OrderTrackingService } from './order-tracking.service';

@Module({
  imports: [FilesModule],
  controllers: [OrderTrackingController],
  providers: [OrderTrackingService],
})
export class OrderTrackingModule {}
