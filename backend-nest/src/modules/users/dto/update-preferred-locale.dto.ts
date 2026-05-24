import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class UpdatePreferredLocaleDto {
  @ApiPropertyOptional({ enum: ['en', 'ru', 'vi'] })
  @IsOptional()
  @IsIn(['en', 'ru', 'vi'])
  preferredLocale?: 'en' | 'ru' | 'vi';
}
