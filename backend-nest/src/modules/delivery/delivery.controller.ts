import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { CalculateDeliveryOffersDto } from './dto/calculate-delivery-offers.dto';
import { CancelDeliveryShipmentDto } from './dto/cancel-delivery-shipment.dto';
import { CreateDeliveryShipmentDto } from './dto/create-delivery-shipment.dto';
import { DeliveryDetailResponseDto } from './dto/delivery-detail-response.dto';
import { DeliveryOffersResponseDto } from './dto/delivery-offers-response.dto';
import { DeliverySettingsResponseDto } from './dto/delivery-settings-response.dto';
import { DeliveryShipmentResponseDto } from './dto/delivery-shipment-response.dto';
import { UpdateDeliverySettingsDto } from './dto/update-delivery-settings.dto';
import { DeliveryService } from './delivery.service';

@ApiTags('delivery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ShopAccessGuard)
@Controller('api/shops/:shopId')
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

  @Get('orders/:orderId/delivery')
  @ApiOperation({ summary: 'Get delivery detail for an order.' })
  @ApiOkResponse({ type: DeliveryDetailResponseDto })
  getDelivery(
    @Param('shopId') shopId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.deliveryService.getDelivery(shopId, orderId);
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
    @Body() dto: CancelDeliveryShipmentDto,
  ) {
    return this.deliveryService.cancelShipment(
      shopId,
      orderId,
      shipmentId,
      dto,
    );
  }
}
