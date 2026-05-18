import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { CreateShopDto } from './dto/create-shop.dto';
import { ShopResponseDto } from './dto/shop-response.dto';
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
}
