import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
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
  maxMovedUpCount?: number;

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
  @IsNumber()
  @Min(0)
  @Max(1000)
  maxScoreDelta?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAbsoluteRankMovement?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  minUnchangedCount?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  maxTotalChangedCount?: number;
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

class RecommendationQaPackEvaluatedSummaryDto {
  @ApiProperty()
  totalItemsCompared!: number;

  @ApiProperty()
  movedUpCount!: number;

  @ApiProperty()
  movedDownCount!: number;

  @ApiProperty()
  addedCount!: number;

  @ApiProperty()
  removedCount!: number;

  @ApiProperty()
  unchangedCount!: number;

  @ApiProperty()
  totalChangedCount!: number;

  @ApiProperty()
  maxScoreDelta!: number;

  @ApiProperty()
  maxAbsoluteRankMovement!: number;
}

class RecommendationQaPackThresholdEvaluationDto {
  @ApiProperty({
    enum: [
      'maxMovedDownCount',
      'maxMovedUpCount',
      'maxAddedCount',
      'maxRemovedCount',
      'maxScoreDelta',
      'maxAbsoluteRankMovement',
      'minUnchangedCount',
      'maxTotalChangedCount',
    ],
  })
  key!:
    | 'maxMovedDownCount'
    | 'maxMovedUpCount'
    | 'maxAddedCount'
    | 'maxRemovedCount'
    | 'maxScoreDelta'
    | 'maxAbsoluteRankMovement'
    | 'minUnchangedCount'
    | 'maxTotalChangedCount';

  @ApiProperty({ enum: ['pass', 'fail'] })
  status!: 'pass' | 'fail';

  @ApiProperty({ enum: ['<=', '>='] })
  operator!: '<=' | '>=';

  @ApiProperty()
  actualValue!: number;

  @ApiProperty()
  expectedValue!: number;

  @ApiProperty()
  message!: string;
}

class RecommendationQaPackEvaluationDto {
  @ApiProperty({ enum: ['pass', 'fail', 'not_evaluated'] })
  overallStatus!: 'pass' | 'fail' | 'not_evaluated';

  @ApiProperty({ type: RecommendationQaPackEvaluatedSummaryDto })
  summary!: RecommendationQaPackEvaluatedSummaryDto;

  @ApiProperty({
    type: RecommendationQaPackThresholdEvaluationDto,
    isArray: true,
  })
  thresholds!: RecommendationQaPackThresholdEvaluationDto[];
}

export class RecommendationQaPackValidationResponseDto {
  @ApiProperty()
  valid!: boolean;

  @ApiProperty({ type: RecommendationQaPackDto })
  pack!: RecommendationQaPackDto;

  @ApiProperty({ type: String, isArray: true })
  notices!: string[];

  @ApiProperty({ type: RecommendationQaPackEvaluationDto })
  evaluation!: RecommendationQaPackEvaluationDto;
}
