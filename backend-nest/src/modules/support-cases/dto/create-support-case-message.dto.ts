import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSupportCaseMessageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  message!: string;
}

export class AdminCreateSupportCaseMessageDto extends CreateSupportCaseMessageDto {
  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
