import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TryOnDto {
  @ApiProperty({ example: 'https://example.com/model.jpg' })
  @IsString()
  personImageUrl!: string;

  @ApiProperty({ example: 'https://example.com/product.png' })
  @IsString()
  garmentImageUrl!: string;
}
