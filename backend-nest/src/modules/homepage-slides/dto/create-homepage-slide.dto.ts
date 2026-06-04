import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateHomepageSlideDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  titleRu?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  titleEn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subtitleRu?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subtitleEn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ctaLabelRu?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ctaLabelEn?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ctaUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  altTextRu?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  altTextEn?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  imageDesktopUrl: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageDesktopStorageKey?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageMobileUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageMobileStorageKey?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
