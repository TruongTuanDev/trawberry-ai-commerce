import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateCustomerReviewDto {
  @IsUUID()
  orderId!: string;

  @IsUUID()
  orderItemId!: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  fitFeedback?: string;
}
