import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: ['NEW', 'ASSEMBLING', 'SHIPPING', 'DELIVERED', 'CANCELLED'],
  })
  @IsString()
  @IsIn(['NEW', 'ASSEMBLING', 'SHIPPING', 'DELIVERED', 'CANCELLED'])
  status!: 'NEW' | 'ASSEMBLING' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';
}
