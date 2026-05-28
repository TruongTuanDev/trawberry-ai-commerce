import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductReadinessService } from './product-readiness.service';

@Module({
  imports: [CategoriesModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductReadinessService],
  exports: [ProductsService, ProductReadinessService],
})
export class ProductsModule {}
