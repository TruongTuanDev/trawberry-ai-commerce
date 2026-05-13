import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ListShopProductsQueryDto } from './dto/list-shop-products-query.dto';
import { PaginatedProductsResponseDto } from './dto/paginated-products-response.dto';
import { ProductDetailResponseDto } from './dto/product-detail-response.dto';
import { ProductInventoryResponseDto } from './dto/product-inventory-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductInventoryDto } from './dto/update-product-inventory.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ShopAccessGuard)
@Controller('api/shops/:shopId/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List products for a shop with pagination, search, and visibility filter.',
  })
  @ApiOkResponse({ type: PaginatedProductsResponseDto })
  listByShop(
    @Param('shopId') shopId: string,
    @Query() query: ListShopProductsQueryDto,
  ) {
    return this.productsService.listByShop(shopId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new product in a seller shop.' })
  @ApiCreatedResponse({ type: ProductDetailResponseDto })
  create(@Param('shopId') shopId: string, @Body() dto: CreateProductDto) {
    return this.productsService.create(shopId, dto);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Get one product in a seller shop.' })
  @ApiOkResponse({ type: ProductDetailResponseDto })
  findOne(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ) {
    return this.productsService.findOneByShop(shopId, productId);
  }

  @Patch(':productId')
  @ApiOperation({ summary: 'Update a product in a seller shop.' })
  @ApiOkResponse({ type: ProductDetailResponseDto })
  update(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(shopId, productId, dto);
  }

  @Get(':productId/inventory')
  @ApiOperation({
    summary: 'Get inventory summary for a product in a seller shop.',
  })
  @ApiOkResponse({ type: ProductInventoryResponseDto })
  getInventory(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ) {
    return this.productsService.getInventory(shopId, productId);
  }

  @Patch(':productId/inventory')
  @ApiOperation({
    summary:
      'Update stock quantity for a product variant in a seller shop inventory view.',
  })
  @ApiOkResponse({ type: ProductInventoryResponseDto })
  updateInventory(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductInventoryDto,
  ) {
    return this.productsService.updateInventory(shopId, productId, dto);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product in a seller shop.' })
  @ApiNoContentResponse()
  async remove(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ) {
    await this.productsService.remove(shopId, productId);
  }
}
