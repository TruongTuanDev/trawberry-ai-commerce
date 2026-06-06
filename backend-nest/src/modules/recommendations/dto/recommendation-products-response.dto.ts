import { ApiProperty } from '@nestjs/swagger';
import { PublicProductResponseDto } from '../../public-products/dto/public-product-response.dto';

class RecommendationScoreBreakdownDto {
  @ApiProperty()
  categoryScore!: number;

  @ApiProperty()
  textScore!: number;

  @ApiProperty()
  popularityScore!: number;

  @ApiProperty()
  freshnessScore!: number;

  @ApiProperty()
  ratingScore!: number;

  @ApiProperty()
  stockScore!: number;

  @ApiProperty()
  shopScore!: number;

  @ApiProperty()
  penaltyScore!: number;

  @ApiProperty()
  sponsoredBoostScore!: number;

  @ApiProperty()
  businessBoostScore!: number;

  @ApiProperty()
  maxSponsoredBoost!: number;
}

class RecommendationScoreExplanationDto {
  @ApiProperty()
  algorithm!: string;

  @ApiProperty({ nullable: true })
  finalScore!: number | null;

  @ApiProperty({ type: String, isArray: true })
  reasons!: string[];

  @ApiProperty({
    type: RecommendationScoreBreakdownDto,
    nullable: true,
    required: false,
  })
  scoreBreakdown?: RecommendationScoreBreakdownDto | null;

  @ApiProperty({ nullable: true, required: false })
  sponsoredReason?: string | null;
}

class RecommendationResponseItemDto {
  @ApiProperty({ type: PublicProductResponseDto })
  product!: PublicProductResponseDto;

  @ApiProperty()
  rank!: number;

  @ApiProperty({ nullable: true })
  score!: number | null;

  @ApiProperty({ type: String, isArray: true })
  reasonCodes!: string[];

  @ApiProperty({
    type: RecommendationScoreExplanationDto,
    required: false,
    nullable: true,
  })
  scoreExplanation?: RecommendationScoreExplanationDto;
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
