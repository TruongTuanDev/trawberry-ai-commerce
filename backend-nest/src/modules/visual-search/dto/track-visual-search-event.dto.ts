import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class TrackVisualSearchEventDto {
  @ApiProperty({ enum: ['impression', 'click'] })
  @IsString()
  @IsIn(['impression', 'click'])
  type!: 'impression' | 'click';

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  visualSearchLogId?: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  rank?: number;

  @ApiPropertyOptional({ nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  guestSessionId?: string;
}
