import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangeCustomerPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
