import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CustomerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CustomerOrdersService } from './customer-orders.service';

@ApiTags('customer-orders')
@ApiBearerAuth()
@UseGuards(CustomerJwtAuthGuard)
@Controller('api/customer/orders')
export class CustomerOrdersController {
  constructor(private readonly customerOrdersService: CustomerOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List marketplace checkout receipts for customer.' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.customerOrdersService.listForCustomer(user);
  }

  @Get(':checkoutCode')
  @ApiOperation({ summary: 'Get a customer marketplace checkout receipt.' })
  detail(
    @Param('checkoutCode') checkoutCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customerOrdersService.getForCustomer(checkoutCode, user);
  }
}
