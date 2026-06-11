import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ADS_WALLET_TOP_UP_STATUSES,
  type AdsWalletTopUpStatus,
} from '../ads-wallet-top-ups.constants';

const PROOF_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
};

export class CreateAdsWalletTopUpDto {
  @ApiProperty({ example: 5000, minimum: 0.01, maximum: 100000000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100000000)
  amount!: number;

  @ApiPropertyOptional({ example: 'RUB', default: 'RUB' })
  @IsOptional()
  @IsString()
  @IsIn(['RUB'])
  currency?: string;

  @ApiPropertyOptional({ example: 'BANK-TRANSFER-123' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  transferReference?: string;

  @ApiPropertyOptional({ example: 'https://example.com/proof/top-up-123' })
  @IsOptional()
  @IsUrl(PROOF_URL_OPTIONS)
  @MaxLength(1000)
  proofUrl?: string;

  @ApiPropertyOptional({ example: 'Transferred from the company account.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sellerNote?: string;
}

export class UpdateAdsWalletTopUpDto {
  @ApiPropertyOptional({ example: 'BANK-TRANSFER-123' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  transferReference?: string;

  @ApiPropertyOptional({ example: 'https://example.com/proof/top-up-123' })
  @IsOptional()
  @IsUrl(PROOF_URL_OPTIONS)
  @MaxLength(1000)
  proofUrl?: string;

  @ApiPropertyOptional({ example: 'Updated transfer note.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sellerNote?: string;
}

export class ListAdsWalletTopUpsQueryDto {
  @ApiPropertyOptional({ enum: ADS_WALLET_TOP_UP_STATUSES })
  @IsOptional()
  @IsIn(ADS_WALLET_TOP_UP_STATUSES)
  status?: AdsWalletTopUpStatus;

  @ApiPropertyOptional({ example: 'seller@example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}

export class ConfirmAdsWalletTopUpDto {
  @ApiPropertyOptional({ example: 'Bank transfer matched.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}

export class RejectAdsWalletTopUpDto {
  @ApiProperty({ example: 'Transfer reference could not be matched.' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({ example: 'Ask seller to submit a new request.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}
