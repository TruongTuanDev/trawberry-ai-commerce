import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DELIVERY_COMMENT_VISIBILITIES,
  DELIVERY_CARRIERS,
  DELIVERY_EXCEPTION_REASON_CODES,
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
  manualYandexOrderId?: string | null;

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
  @MaxLength(255)
  courierName?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  pickupAddress?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  packagePreset?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  packageWeightGram?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  packageLengthCm?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  packageWidthCm?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  packageHeightCm?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  pickupLatitude?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  pickupLongitude?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  dropoffLatitude?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  dropoffLongitude?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  recipientName?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  recipientPhone?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  deliveryPrice?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  yandexClaimId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  yandexStatus?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  yandexTrackingLink?: string | null;

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

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  courierName?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  courierPhone?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  estimatedDeliveryAt?: string | null;
}

export class MarkDeliveryExceptionDto {
  @ApiProperty({ enum: DELIVERY_EXCEPTION_REASON_CODES })
  @IsIn(DELIVERY_EXCEPTION_REASON_CODES)
  reasonCode!: (typeof DELIVERY_EXCEPTION_REASON_CODES)[number];

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reasonText?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customerVisibleMessage?: string | null;
}

export class DeliveryCommentDto {
  @ApiProperty({ enum: DELIVERY_COMMENT_VISIBILITIES })
  @IsIn(DELIVERY_COMMENT_VISIBILITIES)
  visibility!: (typeof DELIVERY_COMMENT_VISIBILITIES)[number];

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  message!: string;
}

export class UpdateCustomerDeliveryMessageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  customerVisibleMessage!: string;
}
