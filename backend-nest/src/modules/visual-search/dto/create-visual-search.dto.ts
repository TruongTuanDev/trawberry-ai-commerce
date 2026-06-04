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
  @ApiProperty({ nullable: true })
  category!: string | null;

  @ApiProperty({ nullable: true })
  color!: string | null;

  @ApiProperty({ nullable: true })
  gender!: string | null;

  @ApiProperty({ type: String, isArray: true })
  keywords!: string[];
}

export class VisualSearchResponseDto {
  @ApiProperty({ type: VisualSearchAnalysisDto })
  analysis!: VisualSearchAnalysisDto;

  @ApiProperty({ type: PublicProductResponseDto, isArray: true })
  products!: PublicProductResponseDto[];

  @ApiProperty()
  algorithm!: string;

  @ApiPropertyOptional()
  visualSearchLogId?: string | null;

  @ApiPropertyOptional()
  disabled?: boolean;
}
