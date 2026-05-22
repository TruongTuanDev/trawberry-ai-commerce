import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CreateReturnRefundMessageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  message!: string;
}
