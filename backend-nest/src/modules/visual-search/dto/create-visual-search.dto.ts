import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PublicProductResponseDto } from '../../public-products/dto/public-product-response.dto';

export class CreateVisualSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  categoryHint?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  cropX?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  cropY?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  cropWidth?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  cropHeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  guestSessionId?: string;
}

class VisualSearchAnalysisDto {
  @ApiProperty()
  productDetected!: boolean;

  @ApiProperty({ nullable: true })
  category!: string | null;

  @ApiProperty({ nullable: true })
  color!: string | null;

  @ApiProperty({ nullable: true })
  gender!: string | null;

  @ApiProperty({ nullable: true })
  material!: string | null;

  @ApiProperty({ nullable: true })
  pattern!: string | null;

  @ApiProperty({ nullable: true })
  style!: string | null;

  @ApiProperty({ type: String, isArray: true })
  keywords!: string[];

  @ApiProperty({ minimum: 0, maximum: 1 })
  confidence!: number;
}

class VisualSearchMatchDto {
  @ApiProperty({ type: PublicProductResponseDto })
  product!: PublicProductResponseDto;

  @ApiProperty()
  score!: number;

  @ApiProperty({ type: String, isArray: true })
  reasons!: string[];
}

export class VisualSearchResponseDto {
  @ApiProperty({ type: VisualSearchAnalysisDto })
  analysis!: VisualSearchAnalysisDto;

  @ApiProperty({ type: PublicProductResponseDto, isArray: true })
  products!: PublicProductResponseDto[];

  @ApiProperty({ type: VisualSearchMatchDto, isArray: true })
  matches!: VisualSearchMatchDto[];

  @ApiProperty()
  algorithm!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  fallbackUsed!: boolean;

  @ApiProperty()
  vectorUsed!: boolean;

  @ApiPropertyOptional()
  visualSearchLogId?: string | null;

  @ApiPropertyOptional()
  disabled?: boolean;
}
