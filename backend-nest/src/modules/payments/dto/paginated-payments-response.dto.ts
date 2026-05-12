import { ApiProperty } from '@nestjs/swagger';
import { PaymentResponseDto } from './payment-response.dto';

class PaymentsMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  size!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class PaginatedPaymentsResponseDto {
  @ApiProperty({ type: PaymentResponseDto, isArray: true })
  items!: PaymentResponseDto[];

  @ApiProperty({ type: PaymentsMetaDto })
  meta!: PaymentsMetaDto;
}
