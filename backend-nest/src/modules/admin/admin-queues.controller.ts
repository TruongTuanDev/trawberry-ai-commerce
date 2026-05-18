import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminQueuesService } from './admin-queues.service';
import {
  AdminDeliveryQueueQueryDto,
  AdminInventoryQueueQueryDto,
  AdminPaymentQueueQueryDto,
  AdminSellerQueueQueryDto,
} from './dto/admin-queues-query.dto';

@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/queues')
export class AdminQueuesController {
  constructor(private readonly queuesService: AdminQueuesService) {}

  @Get('sellers')
  listSellers(@Query() query: AdminSellerQueueQueryDto) {
    return this.queuesService.listSellers(query);
  }

  @Get('payments')
  listPayments(@Query() query: AdminPaymentQueueQueryDto) {
    return this.queuesService.listPayments(query);
  }

  @Get('deliveries')
  listDeliveries(@Query() query: AdminDeliveryQueueQueryDto) {
    return this.queuesService.listDeliveries(query);
  }

  @Get('inventory')
  listInventory(@Query() query: AdminInventoryQueueQueryDto) {
    return this.queuesService.listInventory(query);
  }
}
