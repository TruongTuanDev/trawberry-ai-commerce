import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { SellerFinanceService } from './seller-finance.service';

@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/finance')
export class AdminSellerFinanceController {
  constructor(private readonly sellerFinanceService: SellerFinanceService) {}

  @Get('seller-fees')
  listSellerFees() {
    return this.sellerFinanceService.listAdminSellerFees();
  }

  @Patch('shops/:shopId/commission')
  @HttpCode(200)
  updateCommission(
    @Param('shopId') shopId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: { commissionPercent: number },
  ) {
    return this.sellerFinanceService.updateShopCommission(
      shopId,
      admin.userId,
      dto.commissionPercent,
    );
  }

  @Post('shops/:shopId/invoices/generate')
  @HttpCode(200)
  generateInvoice(
    @Param('shopId') shopId: string,
    @Body() dto: { billingPeriod: string },
  ) {
    return this.sellerFinanceService.generateInvoice(shopId, dto.billingPeriod);
  }

  @Post('invoices/:invoiceId/mark-paid')
  @HttpCode(200)
  markInvoicePaid(@Param('invoiceId') invoiceId: string) {
    return this.sellerFinanceService.markInvoicePaid(invoiceId);
  }

  @Get('invoices')
  listInvoices() {
    return this.sellerFinanceService.listInvoicesForAdmin();
  }
}
