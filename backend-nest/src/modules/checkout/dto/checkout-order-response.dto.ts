import { ApiProperty } from '@nestjs/swagger';

export class CheckoutOrderResponseDto {
  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  orderCode!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  paymentStatus!: string;

  @ApiProperty()
  totalAmount!: string;

  @ApiProperty({ nullable: true })
  paymentInstructions!: string | null;
}
