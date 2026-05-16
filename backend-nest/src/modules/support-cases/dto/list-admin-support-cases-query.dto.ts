import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  SUPPORT_CASE_ISSUE_TYPES,
  SUPPORT_CASE_PRIORITIES,
  SUPPORT_CASE_STATUSES,
} from '../support-cases.constants';

export class ListAdminSupportCasesQueryDto {
  @IsOptional()
  @IsIn(SUPPORT_CASE_STATUSES)
  status?: (typeof SUPPORT_CASE_STATUSES)[number];

  @IsOptional()
  @IsIn(SUPPORT_CASE_ISSUE_TYPES)
  issueType?: (typeof SUPPORT_CASE_ISSUE_TYPES)[number];

  @IsOptional()
  @IsIn(SUPPORT_CASE_PRIORITIES)
  priority?: (typeof SUPPORT_CASE_PRIORITIES)[number];

  @IsOptional()
  @IsString()
  checkoutCode?: string;

  @IsOptional()
  @IsUUID()
  shopId?: string;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
