import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GenerateImageDto {
  @ApiProperty({
    example: 'Generate a clean white-background product hero shot.',
  })
  @IsString()
  prompt!: string;

  @ApiPropertyOptional({ example: 'shop-123' })
  @IsOptional()
  @IsString()
  shopId?: string;
}
