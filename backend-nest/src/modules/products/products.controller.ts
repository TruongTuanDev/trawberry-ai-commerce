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
import { BulkProductActionDto } from './dto/bulk-product-action.dto';
import { BulkUpdateProductsDto } from './dto/bulk-update-products.dto';
import { BulkUpdateProductsResponseDto } from './dto/bulk-update-products-response.dto';
import { ListShopProductsQueryDto } from './dto/list-shop-products-query.dto';
import { PaginatedProductsResponseDto } from './dto/paginated-products-response.dto';
import { ProductDetailResponseDto } from './dto/product-detail-response.dto';
import { ProductInventoryResponseDto } from './dto/product-inventory-response.dto';
import { ProductReadinessResponseDto } from './dto/product-readiness-response.dto';
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

  @Get(':productId/readiness')
  @ApiOperation({ summary: 'Get publish readiness for a seller product.' })
  @ApiOkResponse({ type: ProductReadinessResponseDto })
  getReadiness(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ) {
    return this.productsService.getReadiness(shopId, productId);
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

  @Post(':productId/publish')
  @ApiOperation({ summary: 'Publish a seller product when it is ready.' })
  @ApiOkResponse({ type: ProductDetailResponseDto })
  publish(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ) {
    return this.productsService.publish(shopId, productId);
  }

  @Post(':productId/unpublish')
  @ApiOperation({
    summary: 'Unpublish a seller product from the public marketplace.',
  })
  @ApiOkResponse({ type: ProductDetailResponseDto })
  unpublish(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ) {
    return this.productsService.unpublish(shopId, productId);
  }

  @Post(':productId/archive')
  @ApiOperation({ summary: 'Archive a seller product.' })
  @ApiOkResponse({ type: ProductDetailResponseDto })
  archive(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ) {
    return this.productsService.archive(shopId, productId);
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Bulk publish, unpublish, or archive seller products.',
  })
  bulkAction(
    @Param('shopId') shopId: string,
    @Body() dto: BulkProductActionDto,
  ) {
    return this.productsService.bulkAction(shopId, dto);
  }

  @Post('bulk-update')
  @ApiOperation({
    summary:
      'Bulk update category, price, stock, and inventory tracking for seller products.',
  })
  @ApiOkResponse({ type: BulkUpdateProductsResponseDto })
  bulkUpdate(
    @Param('shopId') shopId: string,
    @Body() dto: BulkUpdateProductsDto,
  ) {
    return this.productsService.bulkUpdate(shopId, dto);
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
