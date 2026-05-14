import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { DELIVERY_AUTOMATED_CARRIERS } from '../delivery.constants';
import { DeliveryPackageDto } from './delivery-package.dto';

export class CreateDeliveryShipmentDto {
  @ApiPropertyOptional({ enum: DELIVERY_AUTOMATED_CARRIERS })
  @IsOptional()
  @IsIn(DELIVERY_AUTOMATED_CARRIERS)
  provider?: 'CDEK' | 'YANDEX';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  selectedOfferId?: string;

  @ApiPropertyOptional({ type: DeliveryPackageDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryPackageDto)
  packageInfo?: DeliveryPackageDto;
}
