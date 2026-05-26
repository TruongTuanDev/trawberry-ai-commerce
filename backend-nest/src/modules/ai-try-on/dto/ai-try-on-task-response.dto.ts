import { ApiProperty } from '@nestjs/swagger';

class AiTryOnResultImageDto {
  @ApiProperty()
  url!: string;

  @ApiProperty({ nullable: true })
  storageKey!: string | null;

  @ApiProperty({ nullable: true })
  mimeType!: string | null;

  @ApiProperty({ nullable: true })
  width!: number | null;

  @ApiProperty({ nullable: true })
  height!: number | null;
}

class AiTryOnSizeRecommendationDto {
  @ApiProperty({ nullable: true })
  recommendedSize!: string | null;

  @ApiProperty({ nullable: true })
  recommendedRussianSize!: string | null;

  @ApiProperty({ nullable: true })
  note!: string | null;

  @ApiProperty({ nullable: true })
  noteRu!: string | null;

  @ApiProperty({ nullable: true })
  noteEn!: string | null;

  @ApiProperty({ nullable: true })
  confidence!: string | null;
}

export class AiTryOnTaskResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  customerId!: string | null;

  @ApiProperty({ nullable: true })
  guestSessionId!: string | null;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty({ nullable: true })
  selectedSize!: string | null;

  @ApiProperty({ nullable: true })
  selectedRussianSize!: string | null;

  @ApiProperty()
  providerMode!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true })
  errorCode!: string | null;

  @ApiProperty({ nullable: true })
  errorMessage!: string | null;

  @ApiProperty({ type: AiTryOnResultImageDto, nullable: true })
  resultImage!: AiTryOnResultImageDto | null;

  @ApiProperty({ type: AiTryOnSizeRecommendationDto })
  sizeRecommendation!: AiTryOnSizeRecommendationDto;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ nullable: true })
  completedAt!: string | null;
}
