import { ApiProperty } from '@nestjs/swagger';
import { PublicProductResponseDto } from './public-product-response.dto';

class PublicProductsPaginationMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  size!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class PaginatedPublicProductsResponseDto {
  @ApiProperty({ type: PublicProductResponseDto, isArray: true })
  items!: PublicProductResponseDto[];

  @ApiProperty({ type: PublicProductsPaginationMetaDto })
  meta!: PublicProductsPaginationMetaDto;
}
