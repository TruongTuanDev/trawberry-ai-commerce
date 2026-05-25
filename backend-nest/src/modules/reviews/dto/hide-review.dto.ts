import { IsOptional, IsString } from 'class-validator';

export class HideReviewDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
