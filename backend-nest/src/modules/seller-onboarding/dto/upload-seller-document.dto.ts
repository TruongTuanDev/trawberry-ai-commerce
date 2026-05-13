import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UploadSellerDocumentDto {
  @ApiProperty({
    enum: [
      'PASSPORT',
      'INN',
      'OGRN',
      'COMPANY_REGISTRATION',
      'BANK_DETAILS',
      'OTHER',
    ],
  })
  @IsIn([
    'PASSPORT',
    'INN',
    'OGRN',
    'COMPANY_REGISTRATION',
    'BANK_DETAILS',
    'OTHER',
  ])
  documentType!:
    | 'PASSPORT'
    | 'INN'
    | 'OGRN'
    | 'COMPANY_REGISTRATION'
    | 'BANK_DETAILS'
    | 'OTHER';
}
