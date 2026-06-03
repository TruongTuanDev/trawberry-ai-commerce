import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class TrackSearchDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  query!: string;

  @ApiProperty({ required: false, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  resultCount?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  locale?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  guestSessionId?: string;
}
