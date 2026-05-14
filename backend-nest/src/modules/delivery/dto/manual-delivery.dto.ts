import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import {
  DELIVERY_CARRIERS,
  MANUAL_DELIVERY_STATUSES,
} from '../delivery.constants';

export class UpsertManualDeliveryDto {
  @ApiProperty({ enum: DELIVERY_CARRIERS })
  @IsIn(DELIVERY_CARRIERS)
  provider!: (typeof DELIVERY_CARRIERS)[number];

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  providerShipmentId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  providerOrderNumber?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  trackingNumber?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  trackingUrl?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  pickupAddress?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  courierPhone?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  estimatedDeliveryAt?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  deliveryNote?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class AdminUpdateManualDeliveryDto extends UpsertManualDeliveryDto {
  @ApiProperty({ enum: MANUAL_DELIVERY_STATUSES, required: false })
  @IsOptional()
  @IsIn(MANUAL_DELIVERY_STATUSES)
  internalStatus?: (typeof MANUAL_DELIVERY_STATUSES)[number];
}

export class DeliveryTransitionDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}
