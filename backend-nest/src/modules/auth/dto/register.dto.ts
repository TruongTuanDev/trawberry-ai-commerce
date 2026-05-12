import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 6, example: 'password123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  fullName!: string;

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
