import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class AdminQueueBaseQueryDto {
  @IsOptional()
  @IsString()
  ageBucket?: 'OK' | 'WARNING' | 'BREACHED';

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

export class AdminSellerQueueQueryDto extends AdminQueueBaseQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'REJECTED', 'APPROVED'])
  status?: 'PENDING' | 'REJECTED' | 'APPROVED';

  @IsOptional()
  @IsString()
  q?: string;
}

export class AdminPaymentQueueQueryDto extends AdminQueueBaseQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'PAID', 'REJECTED'])
  status?: 'PENDING' | 'PAID' | 'REJECTED';

  @IsOptional()
  @IsUUID()
  shopId?: string;

  @IsOptional()
  @IsUUID()
  sellerId?: string;
}

export class AdminDeliveryQueueQueryDto extends AdminQueueBaseQueryDto {
  @IsOptional()
  @IsIn(['PAID_WITHOUT_DELIVERY', 'EXCEPTION', 'IN_TRANSIT', 'DELIVERED'])
  queueType?:
    | 'PAID_WITHOUT_DELIVERY'
    | 'EXCEPTION'
    | 'IN_TRANSIT'
    | 'DELIVERED';

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsUUID()
  shopId?: string;

  @IsOptional()
  @IsUUID()
  sellerId?: string;
}

export class AdminInventoryQueueQueryDto extends AdminQueueBaseQueryDto {
  @IsOptional()
  @IsIn(['LOW_STOCK', 'OUT_OF_STOCK'])
  stockStatus?: 'LOW_STOCK' | 'OUT_OF_STOCK';

  @IsOptional()
  @IsUUID()
  shopId?: string;

  @IsOptional()
  @IsUUID()
  sellerId?: string;
}
