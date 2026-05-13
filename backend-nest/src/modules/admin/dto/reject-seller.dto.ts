import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectSellerDto {
  @ApiPropertyOptional({
    maxLength: 500,
    example: 'Business documents are incomplete.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
