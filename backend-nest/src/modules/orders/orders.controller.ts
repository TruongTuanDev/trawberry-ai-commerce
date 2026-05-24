import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
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
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import {
  AdminJwtAuthGuard,
  SellerJwtAuthGuard,
} from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { OrdersService } from './orders.service';
import { AdminFulfillmentOrdersResponseDto } from './dto/admin-fulfillment-order-response.dto';
import { ListAdminFulfillmentOrdersQueryDto } from './dto/list-admin-fulfillment-orders-query.dto';
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

  @Post(':orderId/archive')
  @ApiOperation({ summary: 'Archive a completed or cancelled order.' })
  @ApiOkResponse({ type: OrderResponseDto })
  archive(@Param('shopId') shopId: string, @Param('orderId') orderId: string) {
    return this.ordersService.archive(shopId, orderId);
  }
}

@ApiTags('admin orders')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('fulfillment')
  @ApiOperation({
    summary:
      'List marketplace fulfillment orders using seller-friendly buckets.',
  })
  @ApiOkResponse({ type: AdminFulfillmentOrdersResponseDto })
  listFulfillment(@Query() query: ListAdminFulfillmentOrdersQueryDto) {
    return this.ordersService.listAdminFulfillment(query);
  }

  @Post(':orderId/move-to-assembling')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin override to move an order into assembling.' })
  @ApiOkResponse({ type: OrderResponseDto })
  moveToAssembling(@Param('orderId') orderId: string) {
    return this.ordersService.adminMoveToAssembling(orderId);
  }

  @Post(':orderId/archive')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Admin archive for a completed or cancelled order.',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  archive(@Param('orderId') orderId: string) {
    return this.ordersService.adminArchive(orderId);
  }
}
