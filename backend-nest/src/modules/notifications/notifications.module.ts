import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import {
  CustomerNotificationsController,
  SellerNotificationsController,
  AdminNotificationsController,
} from './notifications.controller';

@Module({
  controllers: [
    CustomerNotificationsController,
    SellerNotificationsController,
    AdminNotificationsController,
  ],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
