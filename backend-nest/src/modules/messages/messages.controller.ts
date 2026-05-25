import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import {
  AdminJwtAuthGuard,
  CustomerJwtAuthGuard,
  SellerJwtAuthGuard,
} from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateCustomerMessageThreadDto } from './dto/create-customer-message-thread.dto';
import { CreateThreadMessageDto } from './dto/create-thread-message.dto';
import { ListMessageThreadsQueryDto } from './dto/list-message-threads-query.dto';
import { ReportThreadDto } from './dto/report-thread.dto';
import { MessagesService } from './messages.service';

@ApiTags('customer-messages')
@ApiBearerAuth()
@UseGuards(CustomerJwtAuthGuard)
@Controller('api/customer/messages')
export class CustomerMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('threads')
  listThreads(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMessageThreadsQueryDto,
  ) {
    return this.messagesService.listCustomerThreads(user, query);
  }

  @Post('threads')
  createThread(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerMessageThreadDto,
  ) {
    return this.messagesService.createCustomerThread(user, dto);
  }

  @Get('threads/:threadId')
  getThread(
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.getCustomerThread(threadId, user);
  }

  @Post('threads/:threadId/messages')
  addMessage(
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateThreadMessageDto,
  ) {
    return this.messagesService.addCustomerMessage(threadId, user, dto.message);
  }

  @Patch('threads/:threadId/read')
  markRead(
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.markCustomerThreadRead(threadId, user);
  }

  @Patch('threads/:threadId/report')
  reportThread(
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReportThreadDto,
  ) {
    return this.messagesService.reportCustomerThread(
      threadId,
      user,
      dto.reason,
    );
  }
}

@ApiTags('seller-messages')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
@Controller('api/shops/:shopId/messages/threads')
export class SellerMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  listThreads(
    @Param('shopId') shopId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMessageThreadsQueryDto,
  ) {
    return this.messagesService.listSellerThreads(shopId, user, query);
  }

  @Get(':threadId')
  getThread(
    @Param('shopId') shopId: string,
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.getSellerThread(shopId, threadId, user);
  }

  @Post(':threadId/messages')
  addMessage(
    @Param('shopId') shopId: string,
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateThreadMessageDto,
  ) {
    return this.messagesService.addSellerMessage(
      shopId,
      threadId,
      user,
      dto.message,
    );
  }

  @Patch(':threadId/read')
  markRead(
    @Param('shopId') shopId: string,
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.markSellerThreadRead(shopId, threadId, user);
  }

  @Patch(':threadId/close')
  closeThread(
    @Param('shopId') shopId: string,
    @Param('threadId') threadId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.closeSellerThread(shopId, threadId, user);
  }
}

@ApiTags('admin-messages')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/messages/threads')
export class AdminMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  listThreads(@Query() query: ListMessageThreadsQueryDto) {
    return this.messagesService.listAdminThreads(query);
  }

  @Get(':threadId')
  getThread(@Param('threadId') threadId: string) {
    return this.messagesService.getAdminThread(threadId);
  }

  @Patch(':threadId/close')
  closeThread(
    @Param('threadId') threadId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.messagesService.closeAdminThread(threadId, admin);
  }

  @Patch(':threadId/reopen')
  reopenThread(
    @Param('threadId') threadId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.messagesService.reopenAdminThread(threadId, admin);
  }
}
