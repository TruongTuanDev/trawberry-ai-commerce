import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { ProductImageResponseDto } from './dto/product-image-response.dto';
import { UpdateProductImageDto } from './dto/update-product-image.dto';
import type { ProductImageUploadFile } from './product-image-file.type';
import { ProductImagesService } from './product-images.service';

@ApiTags('product-images')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
@Controller('api/shops/:shopId/products/:productId/images')
export class ProductImagesController {
  constructor(private readonly productImagesService: ProductImagesService) {}

  @Get()
  @ApiOperation({ summary: 'List images for a product in a seller shop.' })
  @ApiOkResponse({ type: ProductImageResponseDto, isArray: true })
  findByProduct(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
  ) {
    return this.productImagesService.findByProduct(shopId, productId);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Upload one or more product images.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        imageType: {
          type: 'string',
          enum: [
            'ORIGINAL',
            'AI_GENERATED',
            'MODEL_REFERENCE',
            'FRONT',
            'BACK',
            'DETAIL',
          ],
        },
      },
      required: ['files'],
    },
  })
  @ApiCreatedResponse({ type: ProductImageResponseDto, isArray: true })
  upload(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @UploadedFiles() files: ProductImageUploadFile[],
    @Body('imageType') imageType?: string,
  ) {
    return this.productImagesService.upload(
      shopId,
      productId,
      files,
      imageType,
    );
  }

  @Patch(':imageId')
  @ApiOperation({
    summary: 'Update one product image metadata in a seller shop.',
  })
  @ApiOkResponse({ type: ProductImageResponseDto })
  update(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateProductImageDto,
  ) {
    return this.productImagesService.update(shopId, productId, imageId, dto);
  }

  @Delete(':imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one product image from a seller shop.' })
  @ApiNoContentResponse()
  async remove(
    @Param('shopId') shopId: string,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    await this.productImagesService.remove(shopId, productId, imageId);
  }
}
