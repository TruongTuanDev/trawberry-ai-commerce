import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class AdminReportDateRangeDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class AdminOpsSummaryReportQueryDto extends AdminReportDateRangeDto {
  @IsOptional()
  @IsUUID()
  shopId?: string;

  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}

export class AdminPagedReportQueryDto extends AdminReportDateRangeDto {
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AdminSlaBreachesReportQueryDto extends AdminPagedReportQueryDto {
  @IsOptional()
  @IsIn(['SELLER', 'PAYMENT', 'DELIVERY', 'INVENTORY', 'ORDER'])
  entityType?: 'SELLER' | 'PAYMENT' | 'DELIVERY' | 'INVENTORY' | 'ORDER';

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;
}

export class AdminWorkloadReportQueryDto extends AdminReportDateRangeDto {}

export class AdminDeliveryExceptionsReportQueryDto extends AdminPagedReportQueryDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsUUID()
  shopId?: string;
}

export class AdminPaymentAgingReportQueryDto extends AdminPagedReportQueryDto {
  @IsOptional()
  @IsIn(['0-4h', '4-24h', '24-72h', '72h+'])
  ageBucket?: '0-4h' | '4-24h' | '24-72h' | '72h+';

  @IsOptional()
  @IsUUID()
  shopId?: string;
}
