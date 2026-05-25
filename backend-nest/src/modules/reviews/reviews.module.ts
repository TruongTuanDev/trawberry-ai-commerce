import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductsModule } from '../products/products.module';
import {
  AdminReviewsController,
  CustomerReviewsController,
  PublicReviewsController,
  SellerReviewsController,
} from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [ProductsModule],
  controllers: [
    CustomerReviewsController,
    PublicReviewsController,
    SellerReviewsController,
    AdminReviewsController,
  ],
  providers: [ReviewsService, PrismaService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
