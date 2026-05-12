import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListPublicProductsQueryDto } from './dto/list-public-products-query.dto';
import { PaginatedPublicProductsResponseDto } from './dto/paginated-public-products-response.dto';
import { PublicProductResponseDto } from './dto/public-product-response.dto';
import { PublicProductsService } from './public-products.service';

@ApiTags('public-products')
@Controller('api/public/products')
export class PublicProductsController {
  constructor(private readonly publicProductsService: PublicProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List public products for customer browsing.' })
  @ApiOkResponse({ type: PaginatedPublicProductsResponseDto })
  list(@Query() query: ListPublicProductsQueryDto) {
    return this.publicProductsService.list(query);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Get one public product for customer browsing.' })
  @ApiOkResponse({ type: PublicProductResponseDto })
  findOne(@Param('productId') productId: string) {
    return this.publicProductsService.findOne(productId);
  }
}
