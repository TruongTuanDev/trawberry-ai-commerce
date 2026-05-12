import { ApiProperty } from '@nestjs/swagger';
import { OrderResponseDto } from './order-response.dto';

class OrdersPaginationMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  size!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class PaginatedOrdersResponseDto {
  @ApiProperty({ type: OrderResponseDto, isArray: true })
  items!: OrderResponseDto[];

  @ApiProperty({ type: OrdersPaginationMetaDto })
  meta!: OrdersPaginationMetaDto;
}
