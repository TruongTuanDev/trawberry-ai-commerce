import { ApiProperty } from '@nestjs/swagger';

class RecommendationQaScoreBreakdownDto {
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
}

class RecommendationQaAlgorithmSnapshotDto {
  @ApiProperty()
  algorithm!: string;

  @ApiProperty({ nullable: true })
  rank!: number | null;

  @ApiProperty({ nullable: true })
  finalScore!: number | null;

  @ApiProperty({ type: String, isArray: true })
  reasons!: string[];

  @ApiProperty({
    type: RecommendationQaScoreBreakdownDto,
    nullable: true,
    required: false,
  })
  scoreBreakdown!: RecommendationQaScoreBreakdownDto | null;
}

class RecommendationQaComparisonItemDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty({ nullable: true })
  rankMovement!: number | null;

  @ApiProperty({
    type: RecommendationQaAlgorithmSnapshotDto,
    nullable: true,
  })
  ruleBasedV1!: RecommendationQaAlgorithmSnapshotDto | null;

  @ApiProperty({
    type: RecommendationQaAlgorithmSnapshotDto,
    nullable: true,
  })
  ruleBasedV2!: RecommendationQaAlgorithmSnapshotDto | null;
}

class RecommendationQaSnapshotProductDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  seoSlug!: string | null;

  @ApiProperty({ nullable: true })
  categoryName!: string | null;

  @ApiProperty({ nullable: true })
  brand!: string | null;

  @ApiProperty({ nullable: true })
  color!: string | null;

  @ApiProperty({ nullable: true })
  price!: string | null;

  @ApiProperty()
  inStock!: boolean;

  @ApiProperty({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ nullable: true })
  shopName!: string | null;

  @ApiProperty({ nullable: true })
  shopSlug!: string | null;
}

class RecommendationQaSnapshotItemDto {
  @ApiProperty({ type: RecommendationQaSnapshotProductDto })
  product!: RecommendationQaSnapshotProductDto;

  @ApiProperty({ nullable: true })
  rankMovement!: number | null;

  @ApiProperty({
    type: RecommendationQaAlgorithmSnapshotDto,
    nullable: true,
  })
  ruleBasedV1!: RecommendationQaAlgorithmSnapshotDto | null;

  @ApiProperty({
    type: RecommendationQaAlgorithmSnapshotDto,
    nullable: true,
  })
  ruleBasedV2!: RecommendationQaAlgorithmSnapshotDto | null;
}

export class RecommendationQaCompareResponseDto {
  @ApiProperty({ enum: ['home', 'product_detail', 'search'] })
  placement!: 'home' | 'product_detail' | 'search';

  @ApiProperty({ type: RecommendationQaComparisonItemDto, isArray: true })
  items!: RecommendationQaComparisonItemDto[];
}

export class RecommendationQaSnapshotResponseDto {
  @ApiProperty({ enum: ['home', 'similar', 'search'] })
  scenarioType!: 'home' | 'similar' | 'search';

  @ApiProperty({ enum: ['home', 'product_detail', 'search'] })
  placement!: 'home' | 'product_detail' | 'search';

  @ApiProperty({ nullable: true })
  productId!: string | null;

  @ApiProperty({ nullable: true })
  query!: string | null;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  generatedAt!: string;

  @ApiProperty({ type: String, isArray: true })
  comparedAlgorithms!: string[];

  @ApiProperty({ type: RecommendationQaSnapshotItemDto, isArray: true })
  items!: RecommendationQaSnapshotItemDto[];
}
