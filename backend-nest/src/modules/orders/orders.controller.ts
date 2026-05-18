import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { OrdersService } from './orders.service';
import { ListShopOrdersQueryDto } from './dto/list-shop-orders-query.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { PaginatedOrdersResponseDto } from './dto/paginated-orders-response.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
@Controller('api/shops/:shopId/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'List orders for a seller shop with pagination and filters.',
  })
  @ApiOkResponse({ type: PaginatedOrdersResponseDto })
  listByShop(
    @Param('shopId') shopId: string,
    @Query() query: ListShopOrdersQueryDto,
  ) {
    return this.ordersService.listByShop(shopId, query);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get one order for a seller shop.' })
  @ApiOkResponse({ type: OrderResponseDto })
  findOne(@Param('shopId') shopId: string, @Param('orderId') orderId: string) {
    return this.ordersService.findOneByShop(shopId, orderId);
  }

  @Patch(':orderId/status')
  @ApiOperation({ summary: 'Update seller fulfillment status for one order.' })
  @ApiOkResponse({ type: OrderResponseDto })
  updateStatus(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(shopId, orderId, dto);
  }
}
