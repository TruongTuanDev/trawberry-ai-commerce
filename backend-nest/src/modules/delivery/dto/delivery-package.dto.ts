import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class DeliveryPackageDto {
  @ApiProperty({ example: 1200 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  weightGram!: number;

  @ApiProperty({ example: 30 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  lengthCm!: number;

  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  widthCm!: number;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  heightCm!: number;
}
