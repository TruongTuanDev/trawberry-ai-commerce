import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CASH_COURIER_COLLECTION_STATUSES,
  YANDEX_CARD_ON_DELIVERY_STATUSES,
} from '../../../common/constants/payment-methods.constant';

export class UpdateShopPaymentSettingsDto {
  @ApiPropertyOptional({ enum: ['STATIC_QR'] })
  @IsOptional()
  @IsString()
  @IsIn(['STATIC_QR'])
  paymentMode?: 'STATIC_QR';

  @ApiPropertyOptional({ enum: ['READY', 'DISABLED', 'PENDING_REVIEW'] })
  @IsOptional()
  @IsString()
  @IsIn(['READY', 'DISABLED', 'PENDING_REVIEW'])
  status?: 'READY' | 'DISABLED' | 'PENDING_REVIEW';

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  recipientName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  recipientPhone?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  recipientAccount?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sbpPhone?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  paymentInstruction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowPrepaidQr?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowPayOnDeliverySellerQr?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowDepositPayment?: boolean;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  depositPercent?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  depositRequiredAboveAmount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  codMaxOrderAmount?: number | null;

  @ApiPropertyOptional({ enum: YANDEX_CARD_ON_DELIVERY_STATUSES })
  @IsOptional()
  @IsString()
  @IsIn(YANDEX_CARD_ON_DELIVERY_STATUSES)
  yandexCardOnDeliveryStatus?: (typeof YANDEX_CARD_ON_DELIVERY_STATUSES)[number];

  @ApiPropertyOptional({ enum: CASH_COURIER_COLLECTION_STATUSES })
  @IsOptional()
  @IsString()
  @IsIn(CASH_COURIER_COLLECTION_STATUSES)
  cashCourierCollectionStatus?: (typeof CASH_COURIER_COLLECTION_STATUSES)[number];
}
