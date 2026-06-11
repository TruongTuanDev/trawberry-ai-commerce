import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AdsWalletTopUpsService } from './ads-wallet-top-ups.service';
import {
  CreateAdsWalletTopUpDto,
  ListAdsWalletTopUpsQueryDto,
  UpdateAdsWalletTopUpDto,
} from './dto/ads-wallet-top-up.dto';

@ApiTags('seller-ads-wallet-top-ups')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
@Controller('api/seller/shops/:shopId/billing/top-ups')
export class SellerAdsWalletTopUpsController {
  constructor(private readonly topUpsService: AdsWalletTopUpsService) {}

  @Get()
  @ApiOperation({ summary: 'List manual ads wallet top-up requests.' })
  list(
    @Param('shopId') shopId: string,
    @Query() query: ListAdsWalletTopUpsQueryDto,
    @CurrentUser() seller: AuthenticatedUser,
  ) {
    return this.topUpsService.listForSeller(shopId, seller.userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a pending manual ads wallet top-up.' })
  create(
    @Param('shopId') shopId: string,
    @Body() dto: CreateAdsWalletTopUpDto,
    @CurrentUser() seller: AuthenticatedUser,
  ) {
    return this.topUpsService.createForSeller(shopId, seller.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update proof or reference for a pending top-up.' })
  update(
    @Param('shopId') shopId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAdsWalletTopUpDto,
    @CurrentUser() seller: AuthenticatedUser,
  ) {
    return this.topUpsService.updateForSeller(shopId, seller.userId, id, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an owned pending top-up request.' })
  cancel(
    @Param('shopId') shopId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() seller: AuthenticatedUser,
  ) {
    return this.topUpsService.cancelForSeller(shopId, seller.userId, id);
  }
}
