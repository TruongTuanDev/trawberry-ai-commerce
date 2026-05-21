import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

class CheckoutOrderItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  variantId?: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

class CheckoutCustomerDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateIf(
    (_, value) => value !== undefined && value !== null && value !== '',
  )
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateIf(
    (_, value) => value !== undefined && value !== null && value !== '',
  )
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ nullable: true, required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateIf(
    (_, value) => value !== undefined && value !== null && value !== '',
  )
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ nullable: true, required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateCheckoutOrderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  shopId!: string;

  @ApiProperty({ type: [CheckoutOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutOrderItemDto)
  items!: CheckoutOrderItemDto[];

  @ApiProperty({ type: CheckoutCustomerDto })
  @ValidateNested()
  @Type(() => CheckoutCustomerDto)
  customer!: CheckoutCustomerDto;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  addressId?: string;

  @ApiProperty({ enum: ['MANUAL_TRANSFER', 'CASH_ON_DELIVERY'] })
  @IsString()
  @IsIn(['MANUAL_TRANSFER', 'CASH_ON_DELIVERY'])
  paymentMethod!: 'MANUAL_TRANSFER' | 'CASH_ON_DELIVERY';
}
