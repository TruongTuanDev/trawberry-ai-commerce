import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
