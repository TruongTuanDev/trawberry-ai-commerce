import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AI_TRY_ON_BODY_TRAITS,
  AI_TRY_ON_BODY_TYPES,
  AI_TRY_ON_GENDERS,
} from '../ai-try-on.constants';

export class CreateAiTryOnTaskDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  selectedSize!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  selectedRussianSize?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  heightCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  weightKg?: number;

  @ApiPropertyOptional({ enum: AI_TRY_ON_GENDERS })
  @IsOptional()
  @IsString()
  @IsIn(AI_TRY_ON_GENDERS)
  gender?: (typeof AI_TRY_ON_GENDERS)[number];

  @ApiPropertyOptional({ enum: AI_TRY_ON_BODY_TYPES })
  @IsOptional()
  @IsString()
  @IsIn(AI_TRY_ON_BODY_TYPES)
  bodyType?: (typeof AI_TRY_ON_BODY_TYPES)[number];

  @ApiPropertyOptional({ type: [String], enum: AI_TRY_ON_BODY_TRAITS })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(AI_TRY_ON_BODY_TRAITS, { each: true })
  bodyTraits?: (typeof AI_TRY_ON_BODY_TRAITS)[number][];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customerImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerImageStorageKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  selectedModelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  consentAccepted?: boolean;
}
