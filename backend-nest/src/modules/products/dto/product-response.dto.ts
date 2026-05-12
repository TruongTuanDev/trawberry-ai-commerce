import { ApiProperty } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  wbNmId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true })
  wbTitle!: string | null;

  @ApiProperty({ nullable: true })
  localTitle!: string | null;

  @ApiProperty({ nullable: true })
  brand!: string | null;

  @ApiProperty({ nullable: true })
  visibility!: string | null;

  @ApiProperty({ nullable: true })
  seoSlug!: string | null;

  @ApiProperty({ nullable: true })
  categoryName!: string | null;

  @ApiProperty({ nullable: true })
  wbVendorCode!: string | null;

  @ApiProperty({ nullable: true })
  mainImage!: string | null;

  @ApiProperty()
  inStock!: boolean;
}
