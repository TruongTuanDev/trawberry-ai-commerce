import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { BillingService } from './billing.service';
import { BillingLedgerEntryResponseDto } from './dto/billing-ledger-entry-response.dto';
import { DevCreditWalletDto } from './dto/dev-credit-wallet.dto';
import { DevCreditWalletResponseDto } from './dto/dev-credit-wallet-response.dto';
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

  @Post('wallet/dev-credit')
  @ApiOperation({
    summary: 'Credit the current seller wallet for local dev/demo use only.',
  })
  @ApiCreatedResponse({ type: DevCreditWalletResponseDto })
  devCredit(
    @Param('shopId') shopId: string,
    @Body() dto: DevCreditWalletDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billingService.devCreditWallet(shopId, dto.amount, user);
  }
}
