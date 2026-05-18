import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'seller@example.com or +79990000000',
    description: 'Email or phone identifier.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  identifier?: string;

  @ApiPropertyOptional({
    example: 'seller@example.com',
    description: 'Legacy compatibility field for email-based login.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsEmail()
  email?: string;

  @ApiProperty({ minLength: 8, example: 'password123' })
  @IsString()
  @MinLength(8)
  password!: string;
}
