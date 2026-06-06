import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class DevCreditWalletDto {
  @ApiProperty({
    description: 'Demo-only wallet credit amount in RUB.',
    example: 500,
    minimum: 0.01,
    maximum: 50000,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(50000)
  amount!: number;
}
