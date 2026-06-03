import { ApiProperty } from '@nestjs/swagger';
import { PublicProductResponseDto } from '../../public-products/dto/public-product-response.dto';

export class RecommendationProductsResponseDto {
  @ApiProperty()
  algorithm!: string;

  @ApiProperty({ type: PublicProductResponseDto, isArray: true })
  items!: PublicProductResponseDto[];
}
