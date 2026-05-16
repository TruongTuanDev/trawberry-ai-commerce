import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SyncAllProductsDto {
  @IsOptional()
  @IsIn(['PREVIEW', 'IMPORT'])
  mode?: 'PREVIEW' | 'IMPORT';

  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE_IF_VALID'])
  publishMode?: 'DRAFT' | 'ACTIVE_IF_VALID';

  @IsOptional()
  @IsIn(['REMOTE_URL'])
  imageMode?: 'REMOTE_URL';
}
