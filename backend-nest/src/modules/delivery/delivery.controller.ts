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
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import {
  AdminJwtAuthGuard,
  SellerJwtAuthGuard,
} from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CalculateDeliveryOffersDto } from './dto/calculate-delivery-offers.dto';
import { CancelDeliveryShipmentDto } from './dto/cancel-delivery-shipment.dto';
import { CreateDeliveryShipmentDto } from './dto/create-delivery-shipment.dto';
import { DeliveryDetailResponseDto } from './dto/delivery-detail-response.dto';
import { DeliveryOffersResponseDto } from './dto/delivery-offers-response.dto';
import { DeliverySettingsResponseDto } from './dto/delivery-settings-response.dto';
import { DeliveryShipmentResponseDto } from './dto/delivery-shipment-response.dto';
import { ListAdminDeliveriesQueryDto } from './dto/list-admin-deliveries-query.dto';
import {
  AdminUpdateManualDeliveryDto,
  DeliveryCommentDto,
  DeliveryTransitionDto,
  MarkDeliveryExceptionDto,
  UpdateCustomerDeliveryMessageDto,
  UpsertManualDeliveryDto,
} from './dto/manual-delivery.dto';
import { UpdateDeliverySettingsDto } from './dto/update-delivery-settings.dto';
import { DeliveryService } from './delivery.service';

@ApiTags('delivery')
@ApiBearerAuth()
@Controller('api/shops/:shopId')
@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('delivery/settings')
  @ApiOperation({ summary: 'Get delivery settings for a seller shop.' })
  @ApiOkResponse({ type: DeliverySettingsResponseDto })
  getSettings(@Param('shopId') shopId: string) {
    return this.deliveryService.getSettings(shopId);
  }

  @Patch('delivery/settings')
  @ApiOperation({
    summary: 'Create or update delivery settings for a seller shop.',
  })
  @ApiOkResponse({ type: DeliverySettingsResponseDto })
  updateSettings(
    @Param('shopId') shopId: string,
    @Body() dto: UpdateDeliverySettingsDto,
  ) {
    return this.deliveryService.updateSettings(shopId, dto);
  }

  @Post('orders/:orderId/delivery/offers')
  @ApiOperation({ summary: 'Calculate delivery offers for an order.' })
  @ApiOkResponse({ type: DeliveryOffersResponseDto })
  calculateOffers(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Body() dto: CalculateDeliveryOffersDto,
  ) {
    return this.deliveryService.calculateOffers(shopId, orderId, dto);
  }

  @Post('orders/:orderId/delivery/shipments')
  @ApiOperation({ summary: 'Create a delivery shipment for a paid order.' })
  @ApiOkResponse({ type: DeliveryShipmentResponseDto })
  createShipment(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Body() dto: CreateDeliveryShipmentDto,
  ) {
    return this.deliveryService.createShipment(shopId, orderId, dto);
  }

  @Post('orders/:orderId/delivery/manual')
  @ApiOperation({
    summary: 'Create seller-managed manual delivery for a paid order.',
  })
  @ApiOkResponse({ type: DeliveryShipmentResponseDto })
  createManualDelivery(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertManualDeliveryDto,
  ) {
    return this.deliveryService.createManualDelivery(
      shopId,
      orderId,
      user,
      dto,
    );
  }

  @Get('orders/:orderId/delivery')
  @ApiOperation({ summary: 'Get delivery detail for an order.' })
  @ApiOkResponse({ type: DeliveryDetailResponseDto })
  getDelivery(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.deliveryService.getDelivery(shopId, orderId);
  }

  @Patch('orders/:orderId/delivery/shipments/:shipmentId/manual')
  @ApiOperation({ summary: 'Update seller-managed manual delivery details.' })
  @ApiOkResponse({ type: DeliveryShipmentResponseDto })
  updateManualDelivery(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Param('shipmentId') shipmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertManualDeliveryDto,
  ) {
    return this.deliveryService.updateManualDelivery(
      shopId,
      orderId,
      shipmentId,
      user,
      dto,
    );
  }

  @Post('orders/:orderId/delivery/shipments/:shipmentId/mark-in-transit')
  @ApiOperation({ summary: 'Mark seller-managed delivery in transit.' })
  @ApiOkResponse({ type: DeliveryShipmentResponseDto })
  markManualInTransit(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Param('shipmentId') shipmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeliveryTransitionDto,
  ) {
    return this.deliveryService.markManualInTransit(
      shopId,
      orderId,
      shipmentId,
      user,
      dto,
    );
  }

  @Post('orders/:orderId/delivery/shipments/:shipmentId/mark-courier-assigned')
  @ApiOperation({ summary: 'Mark seller-managed Yandex courier assigned.' })
  @ApiOkResponse({ type: DeliveryShipmentResponseDto })
  markManualCourierAssigned(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Param('shipmentId') shipmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeliveryTransitionDto,
  ) {
    return this.deliveryService.markManualCourierAssigned(
      shopId,
      orderId,
      shipmentId,
      user,
      dto,
    );
  }

  @Post('orders/:orderId/delivery/shipments/:shipmentId/mark-picked-up')
  @ApiOperation({ summary: 'Mark seller-managed Yandex package picked up.' })
  @ApiOkResponse({ type: DeliveryShipmentResponseDto })
  markManualPickedUp(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Param('shipmentId') shipmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeliveryTransitionDto,
  ) {
    return this.deliveryService.markManualPickedUp(
      shopId,
      orderId,
      shipmentId,
      user,
      dto,
    );
  }

  @Post('orders/:orderId/delivery/shipments/:shipmentId/mark-delivered')
  @ApiOperation({ summary: 'Mark seller-managed delivery delivered.' })
  @ApiOkResponse({ type: DeliveryShipmentResponseDto })
  markManualDelivered(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Param('shipmentId') shipmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeliveryTransitionDto,
  ) {
    return this.deliveryService.markManualDelivered(
      shopId,
      orderId,
      shipmentId,
      user,
      dto,
    );
  }

  @Post('orders/:orderId/delivery/shipments/:shipmentId/mark-failed')
  @ApiOperation({ summary: 'Report seller-managed delivery failure.' })
  @ApiOkResponse({ type: DeliveryShipmentResponseDto })
  markFailed(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Param('shipmentId') shipmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarkDeliveryExceptionDto,
  ) {
    return this.deliveryService.markDeliveryFailed(
      shopId,
      orderId,
      shipmentId,
      user,
      dto,
    );
  }

  @Post('orders/:orderId/delivery/shipments/:shipmentId/comments')
  @ApiOperation({ summary: 'Add a delivery comment.' })
  addComment(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Param('shipmentId') shipmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeliveryCommentDto,
  ) {
    return this.deliveryService.addDeliveryComment(
      shopId,
      orderId,
      shipmentId,
      user,
      dto,
    );
  }

  @Post('orders/:orderId/delivery/shipments/:shipmentId/refresh')
  @ApiOperation({
    summary: 'Refresh shipment status from the active provider.',
  })
  @ApiOkResponse({ type: DeliveryShipmentResponseDto })
  refreshShipment(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Param('shipmentId') shipmentId: string,
  ) {
    return this.deliveryService.refreshShipment(shopId, orderId, shipmentId);
  }

  @Post('orders/:orderId/delivery/shipments/:shipmentId/accept')
  @ApiOperation({
    summary: 'Accept a created delivery shipment or Yandex claim.',
  })
  @ApiOkResponse({ type: DeliveryShipmentResponseDto })
  acceptShipment(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Param('shipmentId') shipmentId: string,
  ) {
    return this.deliveryService.acceptShipment(shopId, orderId, shipmentId);
  }

  @Post('orders/:orderId/delivery/shipments/:shipmentId/cancel')
  @ApiOperation({ summary: 'Cancel a shipment in the active provider.' })
  @ApiOkResponse({ type: DeliveryShipmentResponseDto })
  cancelShipment(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
    @Param('shipmentId') shipmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelDeliveryShipmentDto,
  ) {
    return this.deliveryService.cancelShipment(
      shopId,
      orderId,
      shipmentId,
      user,
      dto,
    );
  }
}

@ApiTags('admin deliveries')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/deliveries')
export class AdminDeliveriesController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get()
  @ApiOperation({ summary: 'List deliveries across all shops for admins.' })
  listDeliveries(@Query() query: ListAdminDeliveriesQueryDto) {
    return this.deliveryService.listAdminDeliveries(query);
  }

  @Get(':deliveryShipmentId')
  @ApiOperation({ summary: 'Get one delivery shipment for admin review.' })
  getDelivery(@Param('deliveryShipmentId') deliveryShipmentId: string) {
    return this.deliveryService.getAdminDelivery(deliveryShipmentId);
  }

  @Patch(':deliveryShipmentId')
  @ApiOperation({ summary: 'Admin override for manual delivery details.' })
  updateDelivery(
    @Param('deliveryShipmentId') deliveryShipmentId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: AdminUpdateManualDeliveryDto,
  ) {
    return this.deliveryService.adminUpdateDelivery(
      deliveryShipmentId,
      admin,
      dto,
    );
  }

  @Post(':deliveryShipmentId/mark-in-transit')
  @ApiOperation({ summary: 'Admin marks delivery in transit.' })
  markInTransit(
    @Param('deliveryShipmentId') deliveryShipmentId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: DeliveryTransitionDto,
  ) {
    return this.deliveryService.adminMarkInTransit(
      deliveryShipmentId,
      admin,
      dto,
    );
  }

  @Post(':deliveryShipmentId/mark-courier-assigned')
  @ApiOperation({ summary: 'Admin marks courier assigned.' })
  markCourierAssigned(
    @Param('deliveryShipmentId') deliveryShipmentId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: DeliveryTransitionDto,
  ) {
    return this.deliveryService.adminMarkCourierAssigned(
      deliveryShipmentId,
      admin,
      dto,
    );
  }

  @Post(':deliveryShipmentId/mark-picked-up')
  @ApiOperation({ summary: 'Admin marks package picked up.' })
  markPickedUp(
    @Param('deliveryShipmentId') deliveryShipmentId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: DeliveryTransitionDto,
  ) {
    return this.deliveryService.adminMarkPickedUp(
      deliveryShipmentId,
      admin,
      dto,
    );
  }

  @Post(':deliveryShipmentId/mark-delivered')
  @ApiOperation({ summary: 'Admin marks delivery delivered.' })
  markDelivered(
    @Param('deliveryShipmentId') deliveryShipmentId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: DeliveryTransitionDto,
  ) {
    return this.deliveryService.adminMarkDelivered(
      deliveryShipmentId,
      admin,
      dto,
    );
  }

  @Post(':deliveryShipmentId/cancel')
  @ApiOperation({ summary: 'Admin cancels delivery.' })
  cancelDelivery(
    @Param('deliveryShipmentId') deliveryShipmentId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: DeliveryTransitionDto,
  ) {
    return this.deliveryService.adminCancelDelivery(
      deliveryShipmentId,
      admin,
      dto,
    );
  }

  @Post(':deliveryShipmentId/mark-failed')
  @ApiOperation({ summary: 'Admin marks delivery failed.' })
  markFailed(
    @Param('deliveryShipmentId') deliveryShipmentId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: MarkDeliveryExceptionDto,
  ) {
    return this.deliveryService.adminMarkFailed(deliveryShipmentId, admin, dto);
  }

  @Post(':deliveryShipmentId/comments')
  @ApiOperation({ summary: 'Admin adds delivery comment.' })
  addComment(
    @Param('deliveryShipmentId') deliveryShipmentId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: DeliveryCommentDto,
  ) {
    return this.deliveryService.adminAddComment(deliveryShipmentId, admin, dto);
  }

  @Patch(':deliveryShipmentId/customer-message')
  @ApiOperation({ summary: 'Admin updates customer-visible delivery message.' })
  updateCustomerMessage(
    @Param('deliveryShipmentId') deliveryShipmentId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdateCustomerDeliveryMessageDto,
  ) {
    return this.deliveryService.adminUpdateCustomerMessage(
      deliveryShipmentId,
      admin,
      dto,
    );
  }

  @Post(':orderId/remind-yandex')
  @ApiOperation({
    summary:
      'Create an internal admin reminder for the seller to create manual Yandex delivery.',
  })
  remindYandex(
    @Param('orderId') orderId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.deliveryService.adminRemindYandex(orderId, admin);
  }
}
