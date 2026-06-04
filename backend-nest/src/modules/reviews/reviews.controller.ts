import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import {
  AdminJwtAuthGuard,
  CustomerJwtAuthGuard,
  SellerJwtAuthGuard,
} from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import type { ProductImageUploadFile } from '../product-images/product-image-file.type';
import { CreateCustomerReviewDto } from './dto/create-customer-review.dto';
import { HideReviewDto } from './dto/hide-review.dto';
import { ListPublicReviewsQueryDto } from './dto/list-public-reviews-query.dto';
import { ListShopReviewsQueryDto } from './dto/list-shop-reviews-query.dto';
import { ReplyToReviewDto } from './dto/reply-to-review.dto';
import { UpdateCustomerReviewDto } from './dto/update-customer-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('customer-reviews')
@ApiBearerAuth()
@UseGuards(CustomerJwtAuthGuard)
@Controller('api/customer/reviews')
export class CustomerReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  listOwn(@CurrentUser() user: AuthenticatedUser) {
    return this.reviewsService.listCustomerReviews(user);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerReviewDto,
  ) {
    return this.reviewsService.createCustomerReview(user, dto);
  }

  @Patch(':reviewId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId') reviewId: string,
    @Body() dto: UpdateCustomerReviewDto,
  ) {
    return this.reviewsService.updateCustomerReview(reviewId, user, dto);
  }

  @Post(':reviewId/images')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @HttpCode(200)
  uploadImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId') reviewId: string,
    @UploadedFile(new ParseFilePipeBuilder().build({ fileIsRequired: true }))
    file: ProductImageUploadFile,
  ) {
    return this.reviewsService.uploadCustomerReviewImage(reviewId, user, file);
  }
}

@ApiTags('public-reviews')
@Controller('api/public/products/:productId/reviews')
export class PublicReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  list(
    @Param('productId') productId: string,
    @Query() query: ListPublicReviewsQueryDto,
  ) {
    return this.reviewsService.listPublicReviews(productId, query);
  }
}

@ApiTags('seller-reviews')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
@Controller('api/shops/:shopId/reviews')
export class SellerReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  list(
    @Param('shopId') shopId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListShopReviewsQueryDto,
  ) {
    return this.reviewsService.listShopReviews(shopId, user, query);
  }

  @Patch(':reviewId/reply')
  reply(
    @Param('shopId') shopId: string,
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReplyToReviewDto,
  ) {
    return this.reviewsService.replyToReview(shopId, reviewId, user, dto.reply);
  }
}

@ApiTags('admin-reviews')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  list(@Query() query: ListShopReviewsQueryDto) {
    return this.reviewsService.listAdminReviews(query);
  }

  @Patch(':reviewId/hide')
  hide(@Param('reviewId') reviewId: string, @Body() dto: HideReviewDto) {
    return this.reviewsService.hideReview(reviewId, dto.reason);
  }

  @Patch(':reviewId/restore')
  restore(@Param('reviewId') reviewId: string) {
    return this.reviewsService.restoreReview(reviewId);
  }
}
