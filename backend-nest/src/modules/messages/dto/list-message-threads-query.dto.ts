import { IsOptional, IsString } from 'class-validator';

export class ListMessageThreadsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  filter?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
