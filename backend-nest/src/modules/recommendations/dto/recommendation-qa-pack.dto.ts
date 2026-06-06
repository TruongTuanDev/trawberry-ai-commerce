import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RecommendationQaSnapshotDto } from './recommendation-qa-diff.dto';

class RecommendationQaPackThresholdsDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  maxMovedDownCount?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAddedCount?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  maxRemovedCount?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  maxScoreDelta?: number;
}

export class RecommendationQaPackDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  packName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ enum: ['home', 'similar', 'search'] })
  @IsString()
  scenarioType!: 'home' | 'similar' | 'search';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string | null;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit!: number;

  @ApiProperty({ type: RecommendationQaSnapshotDto })
  @ValidateNested()
  @Type(() => RecommendationQaSnapshotDto)
  baselineSnapshot!: RecommendationQaSnapshotDto;

  @ApiProperty({ type: RecommendationQaSnapshotDto })
  @ValidateNested()
  @Type(() => RecommendationQaSnapshotDto)
  candidateSnapshot!: RecommendationQaSnapshotDto;

  @ApiPropertyOptional({ type: RecommendationQaPackThresholdsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecommendationQaPackThresholdsDto)
  expectedSummaryThresholds?: RecommendationQaPackThresholdsDto;
}

export class RecommendationQaPackValidationResponseDto {
  @ApiProperty()
  valid!: boolean;

  @ApiProperty({ type: RecommendationQaPackDto })
  pack!: RecommendationQaPackDto;

  @ApiProperty({ type: String, isArray: true })
  notices!: string[];
}
