import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiGeneratedImageResponseDto } from './ai-generated-image-response.dto';

export class AiImageTaskResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  requestedBy!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  taskType!: string;

  @ApiProperty()
  mode!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  prompt!: string;

  @ApiPropertyOptional({ nullable: true })
  stylePreset!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sourceImageId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  inputFrontImageId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  inputBackImageId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  inputModelImageId!: string | null;

  @ApiProperty()
  creditCost!: number;

  @ApiPropertyOptional({ nullable: true })
  creditRefundedAt!: string | null;

  @ApiProperty()
  attemptCount!: number;

  @ApiPropertyOptional({ nullable: true })
  queueJobId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  providerTaskId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  errorMessage!: string | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: AiGeneratedImageResponseDto, isArray: true })
  generatedImages!: AiGeneratedImageResponseDto[];
}
