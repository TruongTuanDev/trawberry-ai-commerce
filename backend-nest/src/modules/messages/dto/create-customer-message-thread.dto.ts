import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCustomerMessageThreadDto {
  @IsOptional()
  @IsUUID()
  shopId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  shopSlug?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @IsString()
  @MaxLength(2000)
  message!: string;
}
