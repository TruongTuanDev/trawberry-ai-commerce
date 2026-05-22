import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { SellerFinanceService } from './seller-finance.service';

@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
@Controller('api/seller/shops/:shopId')
export class SellerFinanceController {
  constructor(private readonly sellerFinanceService: SellerFinanceService) {}

  @Get('dashboard-metrics')
  getDashboardMetrics(@Param('shopId') shopId: string) {
    return this.sellerFinanceService.getSellerDashboardMetrics(shopId);
  }

  @Get('finance-ledger')
  listLedger(@Param('shopId') shopId: string) {
    return this.sellerFinanceService.listSellerLedger(shopId);
  }

  @Get('invoices')
  listInvoices(@Param('shopId') shopId: string) {
    return this.sellerFinanceService.listSellerInvoices(shopId);
  }
}
