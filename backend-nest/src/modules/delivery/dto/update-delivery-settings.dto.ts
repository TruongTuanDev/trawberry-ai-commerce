import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Min,
  IsNumber,
} from 'class-validator';
import { DELIVERY_CARRIERS } from '../delivery.constants';

export class UpdateDeliverySettingsDto {
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
  pickupPhone!: string;

  @ApiProperty()
  @IsString()
  pickupContactName!: string;

  @ApiProperty({ type: [String], enum: DELIVERY_CARRIERS })
  @IsArray()
  @IsIn(DELIVERY_CARRIERS, { each: true })
  enabledCarriers!: Array<'CDEK' | 'YANDEX'>;

  @ApiProperty({ enum: DELIVERY_CARRIERS })
  @IsIn(DELIVERY_CARRIERS)
  defaultCarrier!: 'CDEK' | 'YANDEX';

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  defaultWeight!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  defaultLength!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  defaultWidth!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  defaultHeight!: number;
}
