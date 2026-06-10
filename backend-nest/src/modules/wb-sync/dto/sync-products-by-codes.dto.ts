import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MANUAL_PRODUCT_CODES_MAX_LENGTH } from '../manual-product-code-parser';

export class SyncProductsByCodesDto {
  @IsString()
  @MaxLength(MANUAL_PRODUCT_CODES_MAX_LENGTH)
  codes!: string;

  @IsOptional()
  @IsIn(['PREVIEW', 'IMPORT'])
  mode?: 'PREVIEW' | 'IMPORT';

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE_IF_VALID'])
  publishMode?: 'DRAFT' | 'ACTIVE_IF_VALID';

  @IsOptional()
  @IsIn(['REMOTE_URL'])
  imageMode?: 'REMOTE_URL';
}
