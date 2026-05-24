import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrderTrackingController } from './order-tracking.controller';
import { OrderTrackingService } from './order-tracking.service';

@Module({
  imports: [FilesModule, NotificationsModule],
  controllers: [OrderTrackingController],
  providers: [OrderTrackingService],
})
export class OrderTrackingModule {}
