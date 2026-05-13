import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { DELIVERY_CARRIERS } from '../delivery.constants';
import { DeliveryPackageDto } from './delivery-package.dto';

export class CalculateDeliveryOffersDto {
  @ApiPropertyOptional({ type: [String], enum: DELIVERY_CARRIERS })
  @IsOptional()
  @IsArray()
  @IsIn(DELIVERY_CARRIERS, { each: true })
  carriers?: Array<'CDEK' | 'YANDEX'>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickupAddress?: string;

  @ApiPropertyOptional({ type: DeliveryPackageDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryPackageDto)
  packageInfo?: DeliveryPackageDto;
}
