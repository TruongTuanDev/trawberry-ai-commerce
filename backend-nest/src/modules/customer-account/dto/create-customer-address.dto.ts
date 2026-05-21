import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateCustomerAddressDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone!: string;

  @ApiPropertyOptional({ default: 'RU' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  country?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  city!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  region!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  street!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf(
    (_, value) => value !== undefined && value !== null && value !== '',
  )
  @IsString()
  @MaxLength(255)
  apartment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf(
    (_, value) => value !== undefined && value !== null && value !== '',
  )
  @IsString()
  @MaxLength(50)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf(
    (_, value) => value !== undefined && value !== null && value !== '',
  )
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
