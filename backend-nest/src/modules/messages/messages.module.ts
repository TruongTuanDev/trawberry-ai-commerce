import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  AdminMessagesController,
  CustomerMessagesController,
  SellerMessagesController,
} from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [NotificationsModule],
  controllers: [
    CustomerMessagesController,
    SellerMessagesController,
    AdminMessagesController,
  ],
  providers: [MessagesService, PrismaService],
  exports: [MessagesService],
})
export class MessagesModule {}
