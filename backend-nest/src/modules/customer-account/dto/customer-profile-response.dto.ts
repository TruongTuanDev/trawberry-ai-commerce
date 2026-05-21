import { ApiProperty } from '@nestjs/swagger';

export class CustomerProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  createdAt!: string;
}
