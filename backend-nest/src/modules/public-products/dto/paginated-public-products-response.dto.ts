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

class PublicProductsFacetValueDto {
  @ApiProperty()
  value!: string;

  @ApiProperty()
  count!: number;
}

class PublicProductsFacetCategoryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  count!: number;
}

class PublicProductsFiltersDto {
  @ApiProperty({ type: PublicProductsFacetCategoryDto, isArray: true })
  categories!: PublicProductsFacetCategoryDto[];

  @ApiProperty({ type: PublicProductsFacetValueDto, isArray: true })
  brands!: PublicProductsFacetValueDto[];

  @ApiProperty({ type: PublicProductsFacetValueDto, isArray: true })
  colors!: PublicProductsFacetValueDto[];

  @ApiProperty({ type: PublicProductsFacetValueDto, isArray: true })
  genders!: PublicProductsFacetValueDto[];

  @ApiProperty({ nullable: true })
  priceMin!: string | null;

  @ApiProperty({ nullable: true })
  priceMax!: string | null;
}

export class PaginatedPublicProductsResponseDto {
  @ApiProperty({ type: PublicProductResponseDto, isArray: true })
  items!: PublicProductResponseDto[];

  @ApiProperty({ type: PublicProductsPaginationMetaDto })
  meta!: PublicProductsPaginationMetaDto;

  @ApiProperty({ type: PublicProductsFiltersDto })
  filters!: PublicProductsFiltersDto;
}
