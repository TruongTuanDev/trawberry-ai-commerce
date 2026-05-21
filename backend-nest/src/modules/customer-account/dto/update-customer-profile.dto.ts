import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateCustomerProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf(
    (_, value) => value !== undefined && value !== null && value !== '',
  )
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf(
    (_, value) => value !== undefined && value !== null && value !== '',
  )
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone?: string;
}
