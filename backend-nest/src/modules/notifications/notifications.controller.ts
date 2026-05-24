import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CustomerJwtAuthGuard,
  SellerJwtAuthGuard,
  AdminJwtAuthGuard,
} from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { NotificationsService } from './notifications.service';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';

@ApiTags('customer-notifications')
@Controller('api/customer/notifications')
@UseGuards(CustomerJwtAuthGuard)
@ApiBearerAuth()
export class CustomerNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current customer.' })
  getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetNotificationsQueryDto,
  ) {
    return this.notificationsService.listForCurrentUser(user, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get count of unread notifications for customer.' })
  getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.unreadCount(user);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a customer notification as read.' })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user, id);
  }

  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all unread customer notifications as read.' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a customer notification.' })
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.archive(user, id);
  }
}

@ApiTags('seller-notifications')
@Controller('api/seller/notifications')
@UseGuards(SellerJwtAuthGuard)
@ApiBearerAuth()
export class SellerNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current seller.' })
  getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetNotificationsQueryDto,
  ) {
    return this.notificationsService.listForCurrentUser(user, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get count of unread notifications for seller.' })
  getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.unreadCount(user);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a seller notification as read.' })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user, id);
  }

  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all unread seller notifications as read.' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a seller notification.' })
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.archive(user, id);
  }
}

@ApiTags('admin-notifications')
@Controller('api/admin/notifications')
@UseGuards(AdminJwtAuthGuard)
@ApiBearerAuth()
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current admin.' })
  getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetNotificationsQueryDto,
  ) {
    return this.notificationsService.listForCurrentUser(user, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get count of unread notifications for admin.' })
  getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.unreadCount(user);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an admin notification as read.' })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user, id);
  }

  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all unread admin notifications as read.' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive an admin notification.' })
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.archive(user, id);
  }
}
