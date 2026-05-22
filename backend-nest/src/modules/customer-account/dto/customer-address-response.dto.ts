import { ApiProperty } from '@nestjs/swagger';

export class CustomerAddressResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  country!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  region!: string;

  @ApiProperty()
  street!: string;

  @ApiProperty({ nullable: true })
  apartment!: string | null;

  @ApiProperty({ nullable: true })
  postalCode!: string | null;

  @ApiProperty({ nullable: true })
  comment!: string | null;

  @ApiProperty({ nullable: true })
  latitude!: string | null;

  @ApiProperty({ nullable: true })
  longitude!: string | null;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
