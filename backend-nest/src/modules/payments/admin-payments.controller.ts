import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { MarkPaymentPaidDto } from './dto/mark-payment-paid.dto';
import { ListShopPaymentsQueryDto } from './dto/list-shop-payments-query.dto';
import { PaginatedPaymentsResponseDto } from './dto/paginated-payments-response.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('admin-payments')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/payments')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'List marketplace payments for admin supervision.' })
  @ApiOkResponse({ type: PaginatedPaymentsResponseDto })
  list(@Query() query: ListShopPaymentsQueryDto & { shopId?: string }) {
    return this.paymentsService.listForAdmin(query);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get one payment detail for admin supervision.' })
  @ApiOkResponse({ type: PaymentResponseDto })
  findOne(@Param('orderId') orderId: string) {
    return this.paymentsService.findOneForAdmin(orderId);
  }

  @Post(':orderId/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin confirms a direct seller payment.' })
  @ApiOkResponse({ type: PaymentResponseDto })
  confirm(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarkPaymentPaidDto,
  ) {
    return this.paymentsService.adminConfirm(orderId, user, dto);
  }

  @Post(':orderId/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin rejects a direct seller payment.' })
  @ApiOkResponse({ type: PaymentResponseDto })
  reject(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectPaymentDto,
  ) {
    return this.paymentsService.adminReject(orderId, user, dto);
  }
}
