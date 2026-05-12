import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateUploadUrlDto {
  @ApiProperty({ example: 'products/raw-image.png' })
  @IsString()
  filename!: string;

  @ApiPropertyOptional({ example: 'image/png' })
  @IsOptional()
  @IsString()
  contentType?: string;
}
