import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ConfirmWildberriesImportDto {
  @ApiProperty()
  @IsUUID()
  importId!: string;
}
