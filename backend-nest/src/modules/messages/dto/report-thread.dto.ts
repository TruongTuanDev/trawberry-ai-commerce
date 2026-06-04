import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportThreadDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
