import { ApiProperty } from '@nestjs/swagger';

export class AiCreditResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  totalCredits!: number;

  @ApiProperty()
  usedCredits!: number;

  @ApiProperty()
  remainingCredits!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
