import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class TrackRecommendationEventDto {
  @ApiProperty({ enum: ['impression', 'click'] })
  @IsString()
  @IsIn(['impression', 'click'])
  type!: 'impression' | 'click';

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  placement!: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  sourceProductId?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  algorithm?: string;

  @ApiProperty({ required: false, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @Min(0)
  rank?: number;

  @ApiProperty({ required: false, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  guestSessionId?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsBoolean()
  sponsored?: boolean;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsBoolean()
  personalized?: boolean;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  trackingToken?: string;
}
