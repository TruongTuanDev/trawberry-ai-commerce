import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductReadinessService } from './product-readiness.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductReadinessService],
  exports: [ProductsService, ProductReadinessService],
})
export class ProductsModule {}
