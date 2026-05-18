import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @ApiPropertyOptional({ example: 'customer@example.com' })
  @IsOptional()
  @ValidateIf(
    (_, value) => value !== undefined && value !== null && value !== '',
  )
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+79990000001' })
  @IsOptional()
  @ValidateIf(
    (_, value) => value !== undefined && value !== null && value !== '',
  )
  @IsString()
  @MinLength(5)
  phone?: string;

  @ApiProperty({ minLength: 6, example: 'password123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @ApiPropertyOptional({
    example: 'CUSTOMER',
    enum: ['CUSTOMER', 'SELLER', 'USER'],
    default: 'CUSTOMER',
  })
  @IsOptional()
  @IsString()
  @IsIn(['CUSTOMER', 'SELLER', 'USER'])
  role?: string;
}
