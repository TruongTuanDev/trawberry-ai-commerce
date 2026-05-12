import { ApiProperty } from '@nestjs/swagger';

export class ProductImageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty()
  wbUrl!: string;

  @ApiProperty({ nullable: true })
  localUrl!: string | null;

  @ApiProperty({ nullable: true })
  storageKey!: string | null;

  @ApiProperty({ nullable: true })
  originalName!: string | null;

  @ApiProperty({ nullable: true })
  mimeType!: string | null;

  @ApiProperty({ nullable: true })
  size!: number | null;

  @ApiProperty({
    enum: [
      'ORIGINAL',
      'AI_GENERATED',
      'MODEL_REFERENCE',
      'FRONT',
      'BACK',
      'DETAIL',
    ],
  })
  imageType!: string;

  @ApiProperty()
  isMain!: boolean;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
