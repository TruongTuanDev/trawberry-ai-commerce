import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecommendationQaSnapshotDto } from './recommendation-qa-diff.dto';

class RecommendationQaThresholdsDto {
  @ApiPropertyOptional()
  maxMovedDownCount?: number;

  @ApiPropertyOptional()
  maxMovedUpCount?: number;

  @ApiPropertyOptional()
  maxAddedCount?: number;

  @ApiPropertyOptional()
  maxRemovedCount?: number;

  @ApiPropertyOptional()
  maxScoreDelta?: number;

  @ApiPropertyOptional()
  maxAbsoluteRankMovement?: number;

  @ApiPropertyOptional()
  minUnchangedCount?: number;

  @ApiPropertyOptional()
  maxTotalChangedCount?: number;
}

class RecommendationQaThresholdPresetDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  version!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty()
  owner!: string;

  @ApiProperty()
  notes!: string;

  @ApiProperty({ enum: ['experimental', 'stable', 'deprecated'] })
  stability!: 'experimental' | 'stable' | 'deprecated';

  @ApiProperty({ type: RecommendationQaThresholdsDto })
  thresholds!: RecommendationQaThresholdsDto;
}

class RecommendationQaBaselineCatalogMockPackDto {
  @ApiProperty()
  packName!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  thresholdPresetId!: string;

  @ApiProperty({ type: RecommendationQaSnapshotDto })
  baselineSnapshot!: RecommendationQaSnapshotDto;

  @ApiProperty({ type: RecommendationQaSnapshotDto })
  candidateSnapshot!: RecommendationQaSnapshotDto;
}

class RecommendationQaBaselineCatalogEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  version!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty()
  owner!: string;

  @ApiProperty()
  notes!: string;

  @ApiProperty({ enum: ['experimental', 'stable', 'deprecated'] })
  stability!: 'experimental' | 'stable' | 'deprecated';

  @ApiProperty({ enum: ['home', 'similar', 'search'] })
  scenarioType!: 'home' | 'similar' | 'search';

  @ApiProperty({ nullable: true })
  query!: string | null;

  @ApiProperty({ nullable: true })
  productId!: string | null;

  @ApiProperty()
  defaultLimit!: number;

  @ApiProperty()
  recommendedThresholdPresetId!: string;

  @ApiProperty({
    type: RecommendationQaBaselineCatalogMockPackDto,
    nullable: true,
  })
  mockPack!: RecommendationQaBaselineCatalogMockPackDto | null;
}

export class RecommendationQaThresholdPresetListResponseDto {
  @ApiProperty({ type: RecommendationQaThresholdPresetDto, isArray: true })
  presets!: RecommendationQaThresholdPresetDto[];
}

export class RecommendationQaBaselineCatalogResponseDto {
  @ApiProperty({
    type: RecommendationQaBaselineCatalogEntryDto,
    isArray: true,
  })
  catalog!: RecommendationQaBaselineCatalogEntryDto[];
}
