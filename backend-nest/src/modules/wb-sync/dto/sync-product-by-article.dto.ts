import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SyncProductByArticleDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  article!: string;

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
