import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AI_TRY_ON_PROVIDER_MODES } from '../ai-try-on.constants';

export class UpdateAiTryOnSettingsDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ enum: AI_TRY_ON_PROVIDER_MODES })
  @IsString()
  @IsIn(AI_TRY_ON_PROVIDER_MODES)
  providerMode!: (typeof AI_TRY_ON_PROVIDER_MODES)[number];

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  guestDailyLimit!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  customerDailyLimit!: number;

  @ApiProperty()
  @IsBoolean()
  requireConsent!: boolean;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  supportedCategories!: string[];
}

export class AiTryOnSettingsResponseDto extends UpdateAiTryOnSettingsDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class PublicAiTryOnConfigResponseDto extends UpdateAiTryOnSettingsDto {
  @ApiProperty({ type: [Object] })
  builtInModels!: Array<{
    modelId: string;
    gender: string;
    bodyType: string;
    heightCm: number;
    imageUrl: string;
    labelRu: string;
    labelEn: string;
  }>;
}

export class UploadAiTryOnReferenceResponseDto {
  @ApiProperty()
  url!: string;

  @ApiProperty()
  storageKey!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  size!: number;
}
