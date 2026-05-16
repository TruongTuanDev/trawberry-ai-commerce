import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SUPPORT_CASE_ISSUE_TYPES } from '../support-cases.constants';

export class CreateCustomerSupportCaseDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiProperty({ enum: SUPPORT_CASE_ISSUE_TYPES })
  @IsIn(SUPPORT_CASE_ISSUE_TYPES)
  issueType!: (typeof SUPPORT_CASE_ISSUE_TYPES)[number];

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  description!: string;
}
