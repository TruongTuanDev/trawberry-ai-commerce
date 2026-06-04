import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class ListAdminUsersQueryDto {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED', 'DELETED', 'ALL'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED', 'DELETED', 'ALL'])
  status?: 'ACTIVE' | 'DISABLED' | 'DELETED' | 'ALL';

  @ApiPropertyOptional({ enum: ['ADMIN', 'SELLER', 'CUSTOMER', 'ALL'] })
  @IsOptional()
  @IsIn(['ADMIN', 'SELLER', 'CUSTOMER', 'ALL'])
  role?: 'ADMIN' | 'SELLER' | 'CUSTOMER' | 'ALL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class CreateAdminUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ enum: ['ADMIN', 'SELLER', 'CUSTOMER'] })
  @IsIn(['ADMIN', 'SELLER', 'CUSTOMER'])
  role: 'ADMIN' | 'SELLER' | 'CUSTOMER';

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED' = 'ACTIVE';
}

export class UpdateAdminUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: ['ADMIN', 'SELLER', 'CUSTOMER'] })
  @IsOptional()
  @IsIn(['ADMIN', 'SELLER', 'CUSTOMER'])
  role?: 'ADMIN' | 'SELLER' | 'CUSTOMER';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';
}
