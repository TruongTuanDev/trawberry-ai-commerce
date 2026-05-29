import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import type { ProductImageUploadFile } from '../product-images/product-image-file.type';
import { CreateShopDto } from './dto/create-shop.dto';
import { ShopPaymentSettingsResponseDto } from './dto/shop-payment-settings-response.dto';
import { ShopResponseDto } from './dto/shop-response.dto';
import { UpdateShopPaymentSettingsDto } from './dto/update-shop-payment-settings.dto';
import { ShopsService } from './shops.service';

@ApiTags('shops')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard)
@Controller('api/shops')
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new shop for the current seller.' })
  @ApiCreatedResponse({ type: ShopResponseDto })
  createShop(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShopDto,
  ) {
    return this.shopsService.createShop(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List shops accessible to the current user.' })
  @ApiOkResponse({ type: ShopResponseDto, isArray: true })
  findMyShops(@CurrentUser() user: AuthenticatedUser) {
    return this.shopsService.findAccessibleShops(user);
  }

  @Get(':shopId')
  @UseGuards(ShopAccessGuard)
  @ApiOperation({ summary: 'Get one accessible shop by id.' })
  @ApiOkResponse({ type: ShopResponseDto })
  findOne(
    @Param('shopId', new ParseUUIDPipe()) shopId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shopsService.findOne(shopId, user);
  }

  @Get(':shopId/payment-settings')
  @UseGuards(ShopAccessGuard)
  @ApiOperation({ summary: 'Get direct seller payment settings for one shop.' })
  @ApiOkResponse({ type: ShopPaymentSettingsResponseDto })
  findPaymentSettings(@Param('shopId', new ParseUUIDPipe()) shopId: string) {
    return this.shopsService.findPaymentSettings(shopId);
  }

  @Patch(':shopId/payment-settings')
  @UseGuards(ShopAccessGuard)
  @ApiOperation({
    summary: 'Update direct seller payment settings for one shop.',
  })
  @ApiOkResponse({ type: ShopPaymentSettingsResponseDto })
  updatePaymentSettings(
    @Param('shopId', new ParseUUIDPipe()) shopId: string,
    @Body() dto: UpdateShopPaymentSettingsDto,
  ) {
    return this.shopsService.updatePaymentSettings(shopId, dto);
  }

  @Post(':shopId/payment-settings/qr-image')
  @UseGuards(ShopAccessGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a static seller QR image for one shop.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: ShopPaymentSettingsResponseDto })
  uploadPaymentQr(
    @Param('shopId', new ParseUUIDPipe()) shopId: string,
    @UploadedFile(
      new ParseFilePipeBuilder().build({
        fileIsRequired: true,
      }),
    )
    file: ProductImageUploadFile,
  ) {
    return this.shopsService.uploadPaymentQr(shopId, file);
  }

  @Delete(':shopId/payment-settings/qr-image')
  @UseGuards(ShopAccessGuard)
  @ApiOperation({ summary: 'Delete direct seller QR image for one shop.' })
  @ApiOkResponse({ type: ShopPaymentSettingsResponseDto })
  deletePaymentQr(@Param('shopId', new ParseUUIDPipe()) shopId: string) {
    return this.shopsService.deletePaymentQr(shopId);
  }
}
