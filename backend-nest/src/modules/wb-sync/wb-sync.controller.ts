import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { SyncAllProductsDto } from './dto/sync-all-products.dto';
import { SyncProductByArticleDto } from './dto/sync-product-by-article.dto';
import { UpdateWbCredentialsDto } from './dto/wb-credentials.dto';
import { WbProductSyncService } from './wb-product-sync.service';

@UseGuards(JwtAuthGuard, ShopAccessGuard)
@Controller('api/shops/:shopId/wb-sync')
export class WbSyncController {
  constructor(private readonly syncService: WbProductSyncService) {}

  @Post('credentials')
  saveCredentials(
    @Param('shopId') shopId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWbCredentialsDto,
  ) {
    return this.syncService.saveCredentials(shopId, user, dto.apiKey);
  }

  @Get('credentials/status')
  credentialsStatus(
    @Param('shopId') shopId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.syncService.credentialsStatus(shopId, user);
  }

  @Post('products')
  syncAll(
    @Param('shopId') shopId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SyncAllProductsDto,
  ) {
    return this.syncService.syncAll(shopId, user, dto);
  }

  @Post('products/by-article')
  syncByArticle(
    @Param('shopId') shopId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SyncProductByArticleDto,
  ) {
    return this.syncService.syncByArticle(shopId, user, dto);
  }

  @Get('runs/:syncRunId')
  getRun(
    @Param('shopId') shopId: string,
    @Param('syncRunId') syncRunId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.syncService.getRun(shopId, user, syncRunId);
  }
}
