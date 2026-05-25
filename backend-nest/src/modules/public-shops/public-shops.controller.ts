import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicShopResponseDto } from './dto/public-shop-response.dto';
import { PublicShopsService } from './public-shops.service';

@ApiTags('public-shops')
@Controller('api/public/shops')
export class PublicShopsController {
  constructor(private readonly publicShopsService: PublicShopsService) {}

  @Get(':slug')
  @ApiOperation({
    summary: 'Get one public shop profile for customer browsing.',
  })
  @ApiOkResponse({ type: PublicShopResponseDto })
  findOne(@Param('slug') slug: string) {
    return this.publicShopsService.findBySlug(slug);
  }
}
