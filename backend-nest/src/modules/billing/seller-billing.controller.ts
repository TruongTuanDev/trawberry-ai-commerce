import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { BillingService } from './billing.service';
import { BillingLedgerEntryResponseDto } from './dto/billing-ledger-entry-response.dto';
import { SellerWalletResponseDto } from './dto/seller-wallet-response.dto';

@ApiTags('seller-billing')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
@Controller('api/seller/shops/:shopId/billing')
export class SellerBillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('wallet')
  @ApiOperation({
    summary: 'Get or create the seller wallet foundation for a shop.',
  })
  @ApiOkResponse({ type: SellerWalletResponseDto })
  getWallet(@Param('shopId') shopId: string) {
    return this.billingService.getOrCreateWalletForShop(shopId);
  }

  @Get('ledger')
  @ApiOperation({ summary: 'List seller billing ledger entries for a shop.' })
  @ApiOkResponse({ type: BillingLedgerEntryResponseDto, isArray: true })
  listLedger(@Param('shopId') shopId: string) {
    return this.billingService.listLedgerForShop(shopId);
  }
}
