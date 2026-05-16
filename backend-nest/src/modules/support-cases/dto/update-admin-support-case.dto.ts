import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  SUPPORT_CASE_PRIORITIES,
  SUPPORT_CASE_STATUSES,
} from '../support-cases.constants';

export class UpdateAdminSupportCaseDto {
  @ApiProperty({ required: false, enum: SUPPORT_CASE_STATUSES })
  @IsOptional()
  @IsIn(SUPPORT_CASE_STATUSES)
  status?: (typeof SUPPORT_CASE_STATUSES)[number];

  @ApiProperty({ required: false, enum: SUPPORT_CASE_PRIORITIES })
  @IsOptional()
  @IsIn(SUPPORT_CASE_PRIORITIES)
  priority?: (typeof SUPPORT_CASE_PRIORITIES)[number];

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  resolutionNote?: string | null;
}
