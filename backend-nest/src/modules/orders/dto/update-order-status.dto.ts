import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: [
      'PENDING',
      'NEW',
      'ASSEMBLING',
      'SHIPPING',
      'DELIVERED',
      'CANCELLED',
    ],
  })
  @IsString()
  @IsIn(['PENDING', 'NEW', 'ASSEMBLING', 'SHIPPING', 'DELIVERED', 'CANCELLED'])
  status!:
    | 'PENDING'
    | 'NEW'
    | 'ASSEMBLING'
    | 'SHIPPING'
    | 'DELIVERED'
    | 'CANCELLED';
}
