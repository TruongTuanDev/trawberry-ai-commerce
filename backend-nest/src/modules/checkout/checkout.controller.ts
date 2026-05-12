import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CheckoutOrderResponseDto } from './dto/checkout-order-response.dto';
import { CreateCheckoutOrderDto } from './dto/create-checkout-order.dto';
import { CheckoutService } from './checkout.service';

@ApiTags('checkout')
@Controller('api/checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('orders')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Create a customer checkout order without trusting frontend totals.',
  })
  @ApiCreatedResponse({ type: CheckoutOrderResponseDto })
  createOrder(
    @Body() dto: CreateCheckoutOrderDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.checkoutService.createOrder(dto, user);
  }
}
