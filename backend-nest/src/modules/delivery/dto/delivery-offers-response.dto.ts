import { ApiProperty } from '@nestjs/swagger';
import { DeliveryOfferDto } from './delivery-offer.dto';

export class DeliveryOffersResponseDto {
  @ApiProperty({ type: DeliveryOfferDto, isArray: true })
  offers!: DeliveryOfferDto[];
}
