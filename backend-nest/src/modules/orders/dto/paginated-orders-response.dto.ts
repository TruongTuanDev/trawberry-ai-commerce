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

class OrdersSummaryDto {
  @ApiProperty()
  ALL!: number;

  @ApiProperty()
  NEW!: number;

  @ApiProperty()
  ASSEMBLING!: number;

  @ApiProperty()
  IN_TRANSIT!: number;

  @ApiProperty()
  COMPLETED!: number;

  @ApiProperty()
  CANCELLED!: number;

  @ApiProperty()
  ARCHIVED!: number;
}

export class PaginatedOrdersResponseDto {
  @ApiProperty({ type: OrderResponseDto, isArray: true })
  items!: OrderResponseDto[];

  @ApiProperty({ type: OrdersPaginationMetaDto })
  meta!: OrdersPaginationMetaDto;

  @ApiProperty({ type: OrdersSummaryDto })
  summary!: OrdersSummaryDto;
}
