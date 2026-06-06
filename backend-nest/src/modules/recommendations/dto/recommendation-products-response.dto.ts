import { ApiProperty } from '@nestjs/swagger';
import { PublicProductResponseDto } from '../../public-products/dto/public-product-response.dto';

class RecommendationResponseItemDto {
  @ApiProperty({ type: PublicProductResponseDto })
  product!: PublicProductResponseDto;

  @ApiProperty()
  rank!: number;

  @ApiProperty({ nullable: true })
  score!: number | null;

  @ApiProperty({ type: String, isArray: true })
  reasonCodes!: string[];
}

export class RecommendationProductsResponseDto {
  @ApiProperty()
  algorithm!: string;

  @ApiProperty()
  placement!: string;

  @ApiProperty({ type: RecommendationResponseItemDto, isArray: true })
  items!: RecommendationResponseItemDto[];

  @ApiProperty({ type: PublicProductResponseDto, isArray: true })
  products!: PublicProductResponseDto[];
}
