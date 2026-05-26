import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class ReorderHomepageSlidesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  slideIds: string[];
}
