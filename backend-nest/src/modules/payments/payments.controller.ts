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
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AddPaymentNoteDto } from './dto/add-payment-note.dto';
import { ListShopPaymentsQueryDto } from './dto/list-shop-payments-query.dto';
import { MarkPaymentPaidDto } from './dto/mark-payment-paid.dto';
import { PaginatedPaymentsResponseDto } from './dto/paginated-payments-response.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
@Controller('api/shops/:shopId/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'List seller payment review queue for one shop.' })
  @ApiOkResponse({ type: PaginatedPaymentsResponseDto })
  listByShop(
    @Param('shopId') shopId: string,
    @Query() query: ListShopPaymentsQueryDto,
  ) {
    return this.paymentsService.listByShop(shopId, query);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get payment review detail for one order.' })
  @ApiOkResponse({ type: PaymentResponseDto })
  findOne(@Param('shopId') shopId: string, @Param('orderId') orderId: string) {
    return this.paymentsService.findOneByShop(shopId, orderId);
  }

  @Post(':orderId/mark-paid')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a manual payment as paid.' })
  @ApiOkResponse({ type: PaymentResponseDto })
  markPaid(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarkPaymentPaidDto,
  ) {
    return this.paymentsService.markPaid(shopId, orderId, user, dto);
  }

  @Post(':orderId/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject a manual payment.' })
  @ApiOkResponse({ type: PaymentResponseDto })
  reject(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectPaymentDto,
  ) {
    return this.paymentsService.reject(shopId, orderId, user, dto);
  }

  @Post(':orderId/notes')
  @HttpCode(200)
  @ApiOperation({ summary: 'Add a payment review note.' })
  @ApiOkResponse({ type: PaymentResponseDto })
  addNote(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddPaymentNoteDto,
  ) {
    return this.paymentsService.addNote(shopId, orderId, user, dto);
  }
}
