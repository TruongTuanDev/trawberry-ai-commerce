import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AI_TASK_TYPES } from '../ai-images.constants';

const TASK_TYPES = Object.values(AI_TASK_TYPES);

export class CreateAiImageTaskDto {
  @ApiPropertyOptional({
    enum: ['generate', 'try_on'],
    default: 'generate',
  })
  @IsOptional()
  @IsString()
  @IsIn(['generate', 'try_on'])
  mode?: 'generate' | 'try_on';

  @ApiPropertyOptional({
    enum: TASK_TYPES,
    default: AI_TASK_TYPES.PRODUCT_MODEL_IMAGE,
  })
  @IsOptional()
  @IsString()
  @IsIn(TASK_TYPES)
  taskType?: string;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  quantity?: number;

  @ApiProperty({
    example:
      'Create a clean studio product hero image with soft natural light.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  prompt!: string;

  @ApiPropertyOptional({
    example: 'studio-editorial',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  stylePreset?: string;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'Backward-compatible alias for the main input image.',
  })
  @IsOptional()
  @IsUUID()
  sourceImageId?: string;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID()
  inputFrontImageId?: string;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afb1',
  })
  @IsOptional()
  @IsUUID()
  inputBackImageId?: string;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afb2',
  })
  @IsOptional()
  @IsUUID()
  inputModelImageId?: string;
}
