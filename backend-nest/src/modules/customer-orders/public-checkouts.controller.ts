import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerOrdersService } from './customer-orders.service';

@ApiTags('public-checkouts')
@Controller('api/public/checkouts')
export class PublicCheckoutsController {
  constructor(private readonly customerOrdersService: CustomerOrdersService) {}

  @Get(':checkoutCode')
  @ApiOperation({
    summary: 'Lookup a marketplace checkout receipt by code and phone.',
  })
  lookup(
    @Param('checkoutCode') checkoutCode: string,
    @Query('phone') phone = '',
  ) {
    return this.customerOrdersService.getPublicReceipt(checkoutCode, phone);
  }
}
