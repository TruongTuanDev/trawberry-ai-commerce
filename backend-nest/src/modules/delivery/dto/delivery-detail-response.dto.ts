import { ApiProperty } from '@nestjs/swagger';
import { DeliveryEventDto } from './delivery-event.dto';
import { DeliveryOfferDto } from './delivery-offer.dto';
import { DeliveryShipmentResponseDto } from './delivery-shipment-response.dto';

export class DeliveryDetailResponseDto {
  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty({ nullable: true })
  activeShipment!: DeliveryShipmentResponseDto | null;

  @ApiProperty({ type: DeliveryOfferDto, isArray: true })
  offers!: DeliveryOfferDto[];

  @ApiProperty({ type: DeliveryEventDto, isArray: true })
  events!: DeliveryEventDto[];
}
