import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Min,
  IsNumber,
  IsInt,
} from 'class-validator';
import { DELIVERY_AUTOMATED_CARRIERS } from '../delivery.constants';

export class UpdateDeliverySettingsDto {
  @ApiPropertyOptional({ default: 'RU' })
  @IsOptional()
  @IsString()
  pickupCountry?: string;

  @ApiProperty()
  @IsString()
  pickupAddress!: string;

  @ApiProperty()
  @IsString()
  pickupCity!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickupPostalCode?: string;

  @ApiProperty()
  @IsString()
  pickupContactPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pickupLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pickupLongitude?: number;

  @ApiProperty()
  @IsString()
  pickupContactName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickupWorkingHours?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pickupComment?: string;

  @ApiProperty({ type: [String], enum: DELIVERY_AUTOMATED_CARRIERS })
  @IsArray()
  @IsIn(DELIVERY_AUTOMATED_CARRIERS, { each: true })
  enabledCarriers!: Array<'CDEK' | 'YANDEX'>;

  @ApiProperty({ enum: DELIVERY_AUTOMATED_CARRIERS })
  @IsIn(DELIVERY_AUTOMATED_CARRIERS)
  defaultCarrier!: 'CDEK' | 'YANDEX';

  @ApiProperty()
  @IsIn(DELIVERY_AUTOMATED_CARRIERS)
  sameCityPreferredCarrier!: 'CDEK' | 'YANDEX';

  @ApiProperty()
  @IsIn(DELIVERY_AUTOMATED_CARRIERS)
  interCityPreferredCarrier!: 'CDEK' | 'YANDEX';

  @ApiProperty()
  @IsIn(DELIVERY_AUTOMATED_CARRIERS)
  fallbackCarrier!: 'CDEK' | 'YANDEX';

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultWeightGram!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultLengthCm!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultWidthCm!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultHeightCm!: number;
}
